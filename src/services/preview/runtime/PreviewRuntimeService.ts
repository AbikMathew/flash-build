import {
  PackageManifest,
  PreviewRuntimeMode,
  PreviewRuntimePayload,
  ProjectFile,
  ProjectMetadata,
  RuntimeHint,
} from '@/types';
import { HEAVY_PACKAGES, getBaseManifest } from '@/config/approvedPackages';
import { PreviewService } from '@/services/preview/PreviewService';

export interface RuntimeResolution {
  runtime: PreviewRuntimePayload;
  hint: RuntimeHint;
}

const SANDPACK_UNSUPPORTED_DEPENDENCIES = new Set<string>([
  // Allow vite, tailwind, postcss for vite template
]);

const SANDPACK_REMOVED_FILES = new Set<string>([
  // Keep config files
  // '/postcss.config.js',
  // '/tailwind.config.js',
]);

function sanitizeVersionMap(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {};
  const output: Record<string, string> = {};
  for (const [name, version] of Object.entries(input as Record<string, unknown>)) {
    if (typeof version !== 'string') continue;
    if (!name.trim() || !version.trim()) continue;
    output[name] = version;
  }
  return output;
}

function resolveEntry(entry: unknown, framework: 'react-tailwind' | 'vanilla'): string {
  if (typeof entry === 'string' && entry.trim()) {
    return entry.startsWith('/') ? entry : `/${entry}`;
  }
  return framework === 'react-tailwind' ? '/src/main.tsx' : '/index.html';
}

function parseManifestFromFiles(files: ProjectFile[], framework: 'react-tailwind' | 'vanilla'): PackageManifest {
  const pkg = files.find((file) => file.path === 'package.json');
  if (!pkg) return getBaseManifest(framework);
  try {
    const data = JSON.parse(pkg.content) as Record<string, unknown>;
    const base = getBaseManifest(framework);
    const scripts = typeof data.scripts === 'object' && data.scripts
      ? (data.scripts as Record<string, string>)
      : base.scripts;
    const dependencies = {
      ...base.dependencies,
      ...sanitizeVersionMap(data.dependencies),
    };
    const devDependencies = {
      ...base.devDependencies,
      ...sanitizeVersionMap(data.devDependencies),
    };
    return {
      framework,
      entry: resolveEntry(data.entry, framework),
      scripts,
      dependencies,
      devDependencies,
    };
  } catch {
    return getBaseManifest(framework);
  }
}

function hasReactSignals(files: ProjectFile[], manifest: PackageManifest): boolean {
  if (manifest.framework === 'react-tailwind') return true;
  const hasReactDep = Boolean(manifest.dependencies.react || manifest.dependencies['react-dom']);
  const hasTsxOrJsx = files.some((file) => /\.(tsx|jsx)$/.test(file.path));
  const hasModuleEntry = files.some((file) => file.path === 'src/main.tsx' || file.path === 'src/main.jsx');
  return hasReactDep || hasTsxOrJsx || hasModuleEntry;
}

function estimateComplexity(files: ProjectFile[], manifest: PackageManifest): number {
  const deps = Object.keys(manifest.dependencies);
  const depScore = Math.min(55, deps.length * 4);
  const heavyScore = deps.filter((name) => HEAVY_PACKAGES.has(name)).length * 20;
  const size = files.reduce((total, file) => total + file.content.length, 0);
  const sizeScore = Math.min(25, Math.floor(size / 60_000) * 5);
  return Math.min(100, depScore + heavyScore + sizeScore);
}

function inferHint(files: ProjectFile[], manifest: PackageManifest): RuntimeHint {
  const reactSignals = hasReactSignals(files, manifest);
  const complexityScore = estimateComplexity(files, manifest);

  if (!reactSignals) {
    return {
      preferredRuntime: 'srcdoc',
      fallbackRuntime: 'sandpack',
      reason: 'No React/module signals detected; srcdoc preview is sufficient.',
      complexityScore,
    };
  }

  if (complexityScore >= 85 || Object.keys(manifest.dependencies).length > 12) {
    return {
      preferredRuntime: 'remote',
      fallbackRuntime: 'sandpack',
      reason: 'High dependency complexity detected.',
      complexityScore,
    };
  }

  return {
    preferredRuntime: 'sandpack',
    fallbackRuntime: 'remote',
    reason: 'React/module project detected; sandpack runtime selected.',
    complexityScore,
  };
}

function stripTailwindImports(content: string): string {
  return content
    .replace(/^@import\s+['"]tailwindcss['"];?\s*$/gim, '')
    .replace(/^@tailwind\s+(base|components|utilities);?\s*$/gim, '')
    .trimStart();
}

function normalizeSandpackFiles(files: ProjectFile[]): { files: Record<string, string>; needsTailwindCdn: boolean; droppedCount: number } {
  const output: Record<string, string> = {};
  let needsTailwindCdn = false;
  let droppedCount = 0;
  for (const file of files) {
    if (!file?.path || typeof file.path !== 'string') {
      droppedCount += 1;
      continue;
    }
    const normalizedPath = file.path.startsWith('/') ? file.path : `/${file.path}`;
    if (SANDPACK_REMOVED_FILES.has(normalizedPath)) continue;

    let content = file.content;
    if (/\.css$/i.test(normalizedPath) && /@import\s+['"]tailwindcss['"];?/i.test(content)) {
      needsTailwindCdn = true;
      content = stripTailwindImports(content);
    }
    output[normalizedPath] = content;
  }
  return { files: output, needsTailwindCdn, droppedCount };
}

function buildSandpackDependencies(manifest: PackageManifest): Record<string, string> {
  const baseReactDeps = getBaseManifest('react-tailwind').dependencies;
  const dependencies = sanitizeVersionMap(manifest.dependencies);
  const devDependencies = sanitizeVersionMap(manifest.devDependencies);

  // Merge all, Sandpack Vite handles them
  return {
    ...baseReactDeps,
    ...dependencies,
    ...devDependencies
  };
}

function inferTemplate(files: ProjectFile[]): 'vite-react-ts' | 'react-ts' | 'vanilla' {
  if (files.some((file) => /\.(tsx|ts)$/.test(file.path))) return 'vite-react-ts';
  return 'vanilla';
}

function buildSrcdocRuntime(files: ProjectFile[], htmlFallback?: string): PreviewRuntimePayload {
  const html = htmlFallback || PreviewService.bundle(files);
  return {
    mode: 'srcdoc',
    srcdocHtml: html,
    warnings: [],
  };
}

function buildSandpackRuntime(files: ProjectFile[], manifest: PackageManifest): PreviewRuntimePayload {
  // Pass all files including configs
  // We still normalize but don't strip tailwind imports if we have the config
  // Actually, let's trust the vite build

  const filesObj: Record<string, string> = {};
  for (const file of files) {
    if (!file.path) continue;
    const path = file.path.startsWith('/') ? file.path : `/${file.path}`;
    filesObj[path] = file.content;
  }

  // Check if we have tailwind config to decide on CDN fallback
  const hasTailwindConfig = files.some(f => f.path.includes('tailwind.config'));
  const needsCdn = !hasTailwindConfig;
  // If we have config, we assume vite-plugin-tailwind or postcss works? 
  // Sandpack vite template supports postcss natively if deps are there.

  return {
    mode: 'sandpack',
    sandpack: {
      files: filesObj,
      template: inferTemplate(files),
      externalResources: needsCdn ? ['https://cdn.tailwindcss.com'] : [],
      customSetup: {
        entry: resolveEntry(manifest.entry, manifest.framework),
        dependencies: buildSandpackDependencies(manifest),
      },
    },
    warnings: [],
  };
}

function buildRemoteRuntime(message: string): PreviewRuntimePayload {
  return {
    mode: 'remote',
    remote: {
      status: 'idle',
      logs: [message],
    },
    warnings: [message],
  };
}

export class PreviewRuntimeService {
  static resolve(
    files: ProjectFile[],
    metadata: ProjectMetadata | null,
    htmlFallback?: string,
    runtimePreference: PreviewRuntimeMode | 'auto' = 'auto',
  ): RuntimeResolution {
    const framework: 'react-tailwind' | 'vanilla' = metadata?.packageManifest?.framework
      ?? (metadata?.framework.toLowerCase().includes('react') ? 'react-tailwind' : 'vanilla');
    const manifest = metadata?.packageManifest ?? parseManifestFromFiles(files, framework);
    const inferredHint = inferHint(files, manifest);
    const hint = metadata?.runtimeHint ?? inferredHint;

    const preferred = runtimePreference !== 'auto' ? runtimePreference : hint.preferredRuntime;
    const resolvedHint = runtimePreference !== 'auto'
      ? {
        ...hint,
        reason: `Runtime manually selected: ${runtimePreference}. ${hint.reason}`,
      }
      : hint;
    if (preferred === 'srcdoc') {
      return { runtime: buildSrcdocRuntime(files, htmlFallback), hint: resolvedHint };
    }
    if (preferred === 'remote') {
      return {
        runtime: buildRemoteRuntime('Remote runtime selected. Start a remote session to preview this app.'),
        hint: resolvedHint,
      };
    }
    return { runtime: buildSandpackRuntime(files, manifest), hint: resolvedHint };
  }
}

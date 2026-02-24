import {
  OutputStack,
  PackageManifest,
  RuntimeHint,
  ResponsiveReport,
} from '@/types';
import {
  APPROVED_PACKAGES,
  getBaseManifest,
  HEAVY_PACKAGES,
  PACKAGE_ALIASES,
} from '@/config/approvedPackages';
import { GeneratedFile } from './generateProject';

export interface PackagePolicyResult {
  files: GeneratedFile[];
  manifest: PackageManifest;
  blockedPackages: string[];
  notes: string[];
  runtimeHint: RuntimeHint;
  responsiveReport: ResponsiveReport;
}

function languageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    html: 'html',
    css: 'css',
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    json: 'json',
  };
  return map[ext] ?? 'plaintext';
}

function upsertFile(files: GeneratedFile[], path: string, content: string): GeneratedFile[] {
  const index = files.findIndex((file) => file.path === path);
  const nextFile: GeneratedFile = { path, content, language: languageFromPath(path) };
  if (index === -1) {
    return [...files, nextFile];
  }
  const next = [...files];
  next[index] = nextFile;
  return next;
}

function parsePackageJson(files: GeneratedFile[]): Record<string, unknown> | null {
  const pkg = files.find((file) => file.path === 'package.json');
  if (!pkg) return null;
  try {
    return JSON.parse(pkg.content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sanitizeDependencyMap(
  deps: Record<string, unknown> | undefined,
  blocked: string[],
  retainedUnlisted: string[],
): Record<string, string> {
  const output: Record<string, string> = {};
  if (!deps) return output;
  const strictAllowlist = process.env.FLASHBUILD_STRICT_PACKAGE_ALLOWLIST === '1';

  for (const [name, version] of Object.entries(deps)) {
    if (typeof version !== 'string') continue;
    const alias = PACKAGE_ALIASES[name] ?? name;
    const isKnown = APPROVED_PACKAGES.has(alias) || alias.startsWith('@types/');
    if (strictAllowlist && !isKnown) {
      blocked.push(name);
      continue;
    }
    if (!strictAllowlist && !isKnown) {
      retainedUnlisted.push(alias);
    }
    output[alias] = version;
  }
  return output;
}

function mergeManifest(
  base: PackageManifest,
  fromPackageJson: Record<string, unknown> | null,
  blocked: string[],
  retainedUnlisted: string[],
): PackageManifest {
  const scripts = {
    ...base.scripts,
    ...(typeof fromPackageJson?.scripts === 'object' && fromPackageJson?.scripts
      ? (fromPackageJson.scripts as Record<string, string>)
      : {}),
  };

  const dependencies = {
    ...base.dependencies,
    ...sanitizeDependencyMap(
      fromPackageJson?.dependencies as Record<string, unknown> | undefined,
      blocked,
      retainedUnlisted,
    ),
  };

  const devDependencies = {
    ...base.devDependencies,
    ...sanitizeDependencyMap(
      fromPackageJson?.devDependencies as Record<string, unknown> | undefined,
      blocked,
      retainedUnlisted,
    ),
  };

  const entry = typeof fromPackageJson?.entry === 'string' ? fromPackageJson.entry : base.entry;

  return {
    framework: base.framework,
    entry,
    scripts,
    dependencies,
    devDependencies,
  };
}

function normalizeManifestForStack(manifest: PackageManifest, outputStack: OutputStack): PackageManifest {
  if (outputStack !== 'react-tailwind') return manifest;

  const base = getBaseManifest('react-tailwind');
  const dependencies = { ...manifest.dependencies };
  const devDependencies = { ...manifest.devDependencies };

  // Keep generated extra packages, but pin core toolchain to a known-compatible set.
  for (const [name, version] of Object.entries(base.dependencies)) {
    dependencies[name] = version;
  }
  for (const [name, version] of Object.entries(base.devDependencies)) {
    devDependencies[name] = version;
  }

  return {
    framework: manifest.framework,
    entry: base.entry,
    scripts: { ...manifest.scripts, ...base.scripts },
    dependencies,
    devDependencies,
  };
}

function ensureReactScaffold(files: GeneratedFile[], manifest: PackageManifest): GeneratedFile[] {
  let next = [...files];

  const hasMain = next.some((file) => file.path === 'src/main.tsx');
  if (!hasMain) {
    next = upsertFile(next, 'src/main.tsx', `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`);
  }

  const hasApp = next.some((file) => file.path === 'src/App.tsx');
  if (!hasApp) {
    next = upsertFile(next, 'src/App.tsx', `export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-2xl font-bold tracking-tight">Generated App</h1>
        <p className="mt-2 text-slate-400">The generator will replace this with your requested UI.</p>
      </div>
    </main>
  );
}
`);
  }

  const hasStyles = next.some((file) => file.path === 'src/styles.css');
  if (!hasStyles) {
    next = upsertFile(next, 'src/styles.css', `@import "tailwindcss";

:root {
  color-scheme: dark;
}

body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
`);
  }

  const hasIndex = next.some((file) => file.path === 'index.html');
  if (!hasIndex) {
    next = upsertFile(next, 'index.html', `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);
  }

  const hasTailwindConfig = next.some((file) => file.path === 'tailwind.config.js');
  if (!hasTailwindConfig) {
    next = upsertFile(next, 'tailwind.config.js', `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
`);
  }

  const hasPostcssConfig = next.some((file) => file.path === 'postcss.config.js');
  if (!hasPostcssConfig) {
    next = upsertFile(next, 'postcss.config.js', `export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
`);
  }

  next = upsertFile(
    next,
    'package.json',
    `${JSON.stringify(
      {
        name: 'generated-app',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: manifest.scripts,
        dependencies: manifest.dependencies,
        devDependencies: manifest.devDependencies,
      },
      null,
      2,
    )}\n`,
  );

  return next;
}

function normalizeTailwindStyles(content: string): string {
  const lines = content.split('\n');
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();
    if (/^@tailwind\s+(base|components|utilities);?$/i.test(trimmed)) return false;
    if (/^@import\s+['"]tailwindcss\/(base|components|utilities)['"];?$/i.test(trimmed)) return false;
    return true;
  });

  const hasV4Import = cleaned.some((line) => /^@import\s+['"]tailwindcss['"];?$/i.test(line.trim()));
  const body = cleaned.join('\n').trim();
  const prefix = hasV4Import ? '' : '@import "tailwindcss";';

  if (!body) {
    return `${prefix}\n`;
  }

  return `${prefix}\n\n${body}\n`;
}

function ensureTailwindSyntax(files: GeneratedFile[], outputStack: OutputStack): GeneratedFile[] {
  if (outputStack !== 'react-tailwind') return files;
  const target = files.find((file) => file.path === 'src/styles.css');
  if (!target) return files;
  const normalized = normalizeTailwindStyles(target.content);
  if (normalized === target.content) return files;
  return upsertFile(files, target.path, normalized);
}

function normalizeEsmConfigFiles(files: GeneratedFile[], outputStack: OutputStack): GeneratedFile[] {
  if (outputStack !== 'react-tailwind') return files;
  let next = [...files];
  const convert = (content: string): string => {
    if (!/module\.exports\s*=/.test(content)) return content;
    const replaced = content.replace(/module\.exports\s*=\s*/g, 'export default ');
    return replaced.trimEnd().endsWith(';') ? replaced.trimEnd().slice(0, -1) : replaced;
  };

  for (const path of ['postcss.config.js', 'tailwind.config.js']) {
    const file = next.find((entry) => entry.path === path);
    if (!file) continue;
    const normalized = convert(file.content);
    if (normalized !== file.content) {
      next = upsertFile(next, path, `${normalized.trimEnd()}\n`);
    }
  }

  const postcss = next.find((entry) => entry.path === 'postcss.config.js');
  if (postcss) {
    const content = postcss.content;
    const hasTailwind4Plugin = /@tailwindcss\/postcss/.test(content);
    if (!hasTailwind4Plugin) {
      next = upsertFile(next, 'postcss.config.js', `export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
`);
    }
  }
  return next;
}

function ensureVanillaScaffold(files: GeneratedFile[], manifest: PackageManifest): GeneratedFile[] {
  let next = [...files];
  if (!next.some((file) => file.path === 'index.html')) {
    next = upsertFile(next, 'index.html', `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated App</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main id="app"></main>
    <script src="app.js"></script>
  </body>
</html>
`);
  }
  if (!next.some((file) => file.path === 'styles.css')) {
    next = upsertFile(next, 'styles.css', `body { margin: 0; font-family: system-ui, sans-serif; }`);
  }
  if (!next.some((file) => file.path === 'app.js')) {
    next = upsertFile(next, 'app.js', `document.getElementById('app').textContent = 'Generated app';`);
  }

  next = upsertFile(
    next,
    'package.json',
    `${JSON.stringify(
      {
        name: 'generated-app',
        private: true,
        version: '0.0.0',
        scripts: manifest.scripts,
        dependencies: manifest.dependencies,
        devDependencies: manifest.devDependencies,
      },
      null,
      2,
    )}\n`,
  );
  return next;
}

function estimateComplexity(manifest: PackageManifest, files: GeneratedFile[]): number {
  const depNames = Object.keys(manifest.dependencies);
  const heavyCount = depNames.filter((dep) => HEAVY_PACKAGES.has(dep)).length;
  const depScore = Math.min(55, depNames.length * 4);
  const heavyScore = heavyCount * 20;
  const codeSize = files.reduce((total, file) => total + file.content.length, 0);
  const sizeScore = Math.min(25, Math.floor(codeSize / 60_000) * 5);
  return Math.min(100, depScore + heavyScore + sizeScore);
}

function hasOverflowGuard(files: GeneratedFile[]): boolean {
  const corpus = files
    .filter((file) => /\.(css|tsx|jsx|js|ts)$/i.test(file.path))
    .map((file) => file.content)
    .join('\n');
  return /(overflow-x\s*:\s*hidden|max-width\s*:\s*100%|minmax\()/i.test(corpus);
}

function hasBreakpointSignals(files: GeneratedFile[]): boolean {
  const corpus = files
    .filter((file) => /\.(css|tsx|jsx|js|ts)$/i.test(file.path))
    .map((file) => file.content)
    .join('\n');
  return /@media\s*\(|\b(sm:|md:|lg:|xl:|2xl:)\b/.test(corpus);
}

function withOverflowGuard(content: string): string {
  if (/(overflow-x\s*:\s*hidden|max-width\s*:\s*100%)/i.test(content)) {
    return content;
  }
  const trimmed = content.trimEnd();
  const guard = `

/* FlashBuild responsive overflow guard */
html, body, #root {
  max-width: 100%;
  overflow-x: hidden;
}

img, svg, canvas, video {
  max-width: 100%;
  height: auto;
}
`;
  return `${trimmed}${guard}`;
}

function withBreakpointBaseline(content: string): string {
  if (/@media\s*\(\s*min-width\s*:\s*768px\s*\)/i.test(content)
    && /@media\s*\(\s*min-width\s*:\s*1280px\s*\)/i.test(content)) {
    return content;
  }
  const trimmed = content.trimEnd();
  const baseline = `

/* FlashBuild responsive breakpoint baseline */
:root {
  --fb-content-max: 100%;
}

main, .container, [data-layout-root="true"] {
  width: min(100%, var(--fb-content-max));
  margin-inline: auto;
}

@media (min-width: 768px) {
  :root {
    --fb-content-max: 768px;
  }
}

@media (min-width: 1280px) {
  :root {
    --fb-content-max: 1280px;
  }
}
`;
  return `${trimmed}${baseline}`;
}

function ensureResponsiveGuards(files: GeneratedFile[], outputStack: OutputStack): GeneratedFile[] {
  const needOverflowGuard = !hasOverflowGuard(files);
  const needBreakpoints = !hasBreakpointSignals(files);
  if (!needOverflowGuard && !needBreakpoints) return files;

  let next = [...files];
  const preferredPath = outputStack === 'react-tailwind' ? 'src/styles.css' : 'styles.css';
  const existing = next.find((file) => file.path === preferredPath)
    ?? next.find((file) => file.path.endsWith('.css'));

  const compose = (content: string): string => {
    let nextContent = content;
    if (needOverflowGuard) nextContent = withOverflowGuard(nextContent);
    if (needBreakpoints) nextContent = withBreakpointBaseline(nextContent);
    return nextContent;
  };

  if (existing) {
    next = upsertFile(next, existing.path, compose(existing.content));
  } else {
    next = upsertFile(next, preferredPath, compose(''));
  }
  return next;
}

function buildRuntimeHint(outputStack: OutputStack, complexityScore: number, blockedCount: number): RuntimeHint {
  if (outputStack === 'vanilla') {
    return {
      preferredRuntime: 'srcdoc',
      fallbackRuntime: 'sandpack',
      reason: 'Vanilla output can be rendered directly with srcdoc runtime.',
      complexityScore,
    };
  }

  if (complexityScore >= 85) {
    return {
      preferredRuntime: 'remote',
      fallbackRuntime: 'sandpack',
      reason: 'High dependency complexity detected; remote runtime is preferred.',
      complexityScore,
    };
  }

  return {
    preferredRuntime: 'sandpack',
    fallbackRuntime: 'remote',
    reason: blockedCount > 0
      ? 'React project with sanitized dependencies; sandpack preferred with remote fallback.'
      : 'React project detected; sandpack preview selected.',
    complexityScore,
  };
}

function buildResponsiveReport(files: GeneratedFile[]): ResponsiveReport {
  const html = files.find((file) => file.path.endsWith('.html'))?.content ?? '';
  const cssAndTsx = files
    .filter((file) => /\.(css|tsx|jsx|js|ts)$/i.test(file.path))
    .map((file) => file.content)
    .join('\n');

  const warnings: string[] = [];
  if (!/<meta[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
    warnings.push('Missing viewport meta tag.');
  }

  const hasMediaQuery = /@media\s*\(/i.test(cssAndTsx);
  const hasTailwindBreakpoints = /\b(sm:|md:|lg:|xl:|2xl:)\b/.test(cssAndTsx);
  if (!hasMediaQuery && !hasTailwindBreakpoints) {
    warnings.push('No responsive breakpoints found (media queries or utility breakpoints).');
  }

  const hasOverflowGuard =
    /(overflow-x\s*:\s*hidden|max-width\s*:\s*100%|minmax\()/i.test(cssAndTsx);
  if (!hasOverflowGuard) {
    warnings.push('No explicit horizontal overflow guard detected.');
  }

  return {
    passed: warnings.length === 0,
    warnings,
    checkedViewports: [375, 768, 1280],
  };
}

export function enforcePackagePolicy(files: GeneratedFile[], outputStack: OutputStack): PackagePolicyResult {
  const blocked: string[] = [];
  const retainedUnlisted: string[] = [];
  const notes: string[] = [];
  const fromJson = parsePackageJson(files);
  const base = getBaseManifest(outputStack);
  const mergedManifest = mergeManifest(base, fromJson, blocked, retainedUnlisted);
  const manifest = normalizeManifestForStack(mergedManifest, outputStack);

  let nextFiles = [...files];
  if (outputStack === 'react-tailwind') {
    nextFiles = ensureReactScaffold(nextFiles, manifest);
  } else {
    nextFiles = ensureVanillaScaffold(nextFiles, manifest);
  }
  nextFiles = ensureTailwindSyntax(nextFiles, outputStack);
  nextFiles = normalizeEsmConfigFiles(nextFiles, outputStack);
  nextFiles = ensureResponsiveGuards(nextFiles, outputStack);

  if (blocked.length > 0) {
    notes.push(`Strict allowlist blocked packages: ${blocked.join(', ')}`);
  }
  if (retainedUnlisted.length > 0) {
    const unique = [...new Set(retainedUnlisted)];
    notes.push(
      `Retained non-allowlisted dependencies for runtime compatibility: ${unique.slice(0, 8).join(', ')}${unique.length > 8 ? '…' : ''}`,
    );
  }

  const complexityScore = estimateComplexity(manifest, nextFiles);
  const runtimeHint = buildRuntimeHint(outputStack, complexityScore, blocked.length);
  const responsiveReport = buildResponsiveReport(nextFiles);

  if (!responsiveReport.passed) {
    notes.push(`Responsive warnings: ${responsiveReport.warnings.join(' ')}`);
  }

  return {
    files: nextFiles,
    manifest,
    blockedPackages: blocked,
    notes,
    runtimeHint,
    responsiveReport,
  };
}

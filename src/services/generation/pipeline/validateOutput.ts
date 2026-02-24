import { AIProvider, DesignSpec, OutputStack, QualityMode, QualityReport, ReferenceBundle } from '@/types';
import { AIUsage, callAI, safeJsonParse } from './aiClient';
import { GeneratedFile } from './generateProject';
import path from 'node:path';
type TypeScriptModule = typeof import('typescript');

interface ValidateOutputParams {
  provider: AIProvider;
  apiKey: string;
  model: string;
  spec: DesignSpec;
  outputStack: OutputStack;
  qualityMode: QualityMode;
  references: ReferenceBundle;
  files: GeneratedFile[];
}

interface ValidateOutputResult {
  report: QualityReport;
  usage: AIUsage;
}

interface ReviewerResponse {
  functionalPass: boolean;
  criticalIssues: string[];
  patchInstructions: string;
}

const REVIEW_PROMPT = `You are the QA Reviewer for generated web apps.

You will receive a design spec and generated files.
Return ONLY JSON:
{
  "functionalPass": boolean,
  "criticalIssues": ["..."],
  "patchInstructions": "..."
}

Rules:
1) Flag only behavior-breaking issues: missing handlers, broken flows, invalid JS references, fatal runtime errors.
2) If no critical issues are found, functionalPass must be true and criticalIssues empty.
3) patchInstructions should be concise and implementation-ready.
`;

function uniq(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseGeneratedStyleTokens(files: GeneratedFile[]): string[] {
  const combined = files.map((file) => file.content).join('\n');
  const colors = combined.match(/#(?:[0-9a-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/gi) ?? [];
  const fonts = combined.match(/font-family\s*:\s*[^;]+/gi) ?? [];
  const spacing = combined.match(/(?:padding|margin|gap|border-radius)\s*:\s*[^;]+/gi) ?? [];
  const classHints = combined.match(/\b(navbar|sidebar|hero|card|grid|flex|modal|table|form)\b/gi) ?? [];
  return uniq([...colors, ...fonts, ...spacing, ...classHints]).slice(0, 120);
}

function extractIndexHtml(files: GeneratedFile[]): string {
  return files.find((file) => file.path === 'index.html')?.content
    ?? files.find((file) => file.path.endsWith('.html'))?.content
    ?? '';
}

function checkMissingHtmlReferences(files: GeneratedFile[], html: string): string[] {
  const fileSet = new Set(files.map((file) => file.path));
  const missing: string[] = [];
  const scriptMatches = [...html.matchAll(/<script[^>]*src=["']([^"']+)["']/gi)];
  const styleMatches = [...html.matchAll(/<link[^>]*href=["']([^"']+)["']/gi)];

  for (const match of [...scriptMatches, ...styleMatches]) {
    const ref = match[1];
    if (!ref || ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('data:')) continue;
    if (!fileSet.has(ref)) missing.push(`Missing referenced file: ${ref}`);
  }
  return uniq(missing);
}

function checkRuntimeStructure(files: GeneratedFile[], outputStack: OutputStack): string[] {
  if (outputStack !== 'react-tailwind') return [];
  const issues: string[] = [];
  const fileSet = new Set(files.map((file) => file.path));
  if (!fileSet.has('package.json')) issues.push('Missing package.json for React runtime.');
  if (!fileSet.has('src/main.tsx') && !fileSet.has('src/main.jsx')) {
    issues.push('Missing React entry file (src/main.tsx or src/main.jsx).');
  }
  if (!fileSet.has('src/App.tsx') && !fileSet.has('src/App.jsx')) {
    issues.push('Missing root App component file.');
  }
  const html = extractIndexHtml(files);
  if (!/<script[^>]*type=["']module["'][^>]*src=["']\/?src\/main\.(tsx|jsx)["'][^>]*>/i.test(html)) {
    issues.push('index.html does not include module entry script for React.');
  }
  return issues;
}

function checkResponsiveReadiness(files: GeneratedFile[]): string[] {
  const html = extractIndexHtml(files);
  const corpus = files
    .filter((file) => /\.(css|scss|sass|js|jsx|ts|tsx|html)$/i.test(file.path))
    .map((file) => file.content)
    .join('\n');

  const warnings: string[] = [];
  if (!/<meta[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
    warnings.push('Missing viewport meta tag.');
  }
  const hasMedia = /@media\s*\(/i.test(corpus);
  const hasUtilityBreakpoints = /\b(sm:|md:|lg:|xl:|2xl:)\b/.test(corpus);
  if (!hasMedia && !hasUtilityBreakpoints) {
    warnings.push('No breakpoint rules detected for 375/768/1280 layouts.');
  }
  if (!/(overflow-x\s*:\s*hidden|max-width\s*:\s*100%|minmax\()/i.test(corpus)) {
    warnings.push('No explicit overflow guard detected.');
  }
  return warnings;
}

function checkTailwindCompatibility(files: GeneratedFile[], outputStack: OutputStack): string[] {
  if (outputStack !== 'react-tailwind') return [];
  const styles = files.find((file) => file.path === 'src/styles.css')?.content ?? '';
  if (!styles) return ['Missing src/styles.css for Tailwind runtime.'];

  const issues: string[] = [];
  if (/^@tailwind\s+(base|components|utilities);?/im.test(styles)) {
    issues.push('Tailwind v3 directives detected in src/styles.css. Use @import "tailwindcss"; for Tailwind v4.');
  }
  if (/^@import\s+['"]tailwindcss\/(base|components|utilities)['"];?/im.test(styles)) {
    issues.push('Legacy tailwindcss/base|components|utilities import detected. Use @import "tailwindcss";.');
  }
  return issues;
}

function checkLocalImportResolution(files: GeneratedFile[]): string[] {
  const issues: string[] = [];
  const fileSet = new Set(files.map((file) => file.path));
  const localImportRegex = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json'];
  const indexExtensions = extensions.map((ext) => `/index${ext}`);

  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx)$/i.test(file.path)) continue;
    let match: RegExpExecArray | null;
    while ((match = localImportRegex.exec(file.content)) !== null) {
      const rawSpecifier = match[1] || match[2];
      if (!rawSpecifier || (!rawSpecifier.startsWith('./') && !rawSpecifier.startsWith('../'))) {
        continue;
      }

      const baseDir = path.posix.dirname(file.path);
      const resolvedBase = path.posix.normalize(path.posix.join(baseDir, rawSpecifier));
      const candidates = [
        resolvedBase,
        ...extensions.map((ext) => `${resolvedBase}${ext}`),
        ...indexExtensions.map((indexPath) => `${resolvedBase}${indexPath}`),
      ];

      if (!candidates.some((candidate) => fileSet.has(candidate))) {
        issues.push(`Unresolved local import in ${file.path}: ${rawSpecifier}`);
      }
    }
  }

  return uniq(issues);
}

function parseDeclaredDependencies(files: GeneratedFile[]): Set<string> {
  const pkg = files.find((file) => file.path === 'package.json');
  if (!pkg) return new Set<string>();
  try {
    const data = JSON.parse(pkg.content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return new Set([
      ...Object.keys(data.dependencies ?? {}),
      ...Object.keys(data.devDependencies ?? {}),
    ]);
  } catch {
    return new Set<string>();
  }
}

function normalizePackageName(specifier: string): string {
  if (!specifier) return specifier;
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    return scope && name ? `${scope}/${name}` : specifier;
  }
  return specifier.split('/')[0] ?? specifier;
}

function checkExternalDependencyDeclarations(files: GeneratedFile[]): string[] {
  const issues: string[] = [];
  const declared = parseDeclaredDependencies(files);
  if (declared.size === 0) return issues;

  const externalImportRegex = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  const skipSpecifiers = new Set([
    'vite/client',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
  ]);

  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx)$/i.test(file.path)) continue;
    let match: RegExpExecArray | null;
    while ((match = externalImportRegex.exec(file.content)) !== null) {
      const specifier = (match[1] || match[2] || '').trim();
      if (!specifier) continue;
      if (skipSpecifiers.has(specifier)) continue;
      if (
        specifier.startsWith('./')
        || specifier.startsWith('../')
        || specifier.startsWith('/')
        || specifier.startsWith('@/')
        || specifier.startsWith('node:')
      ) {
        continue;
      }

      const packageName = normalizePackageName(specifier);
      if (!declared.has(packageName)) {
        issues.push(`Missing package dependency "${packageName}" required by ${file.path} import "${specifier}".`);
      }
    }
  }

  return uniq(issues);
}

async function checkSyntaxDiagnostics(files: GeneratedFile[]): Promise<string[]> {
  try {
    const tsImport = await import('typescript') as TypeScriptModule & { default?: TypeScriptModule };
    const ts = tsImport.default ?? tsImport;
    const issues: string[] = [];

    for (const file of files) {
      const ext = path.extname(file.path).toLowerCase();
      if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) continue;

      const transpileResult = ts.transpileModule(
        file.content,
        {
          compilerOptions: {
            allowJs: true,
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
          fileName: file.path,
          reportDiagnostics: true,
        },
      );

      for (const diagnostic of transpileResult.diagnostics ?? []) {
        if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
        const sourceFile = diagnostic.file;
        const start = diagnostic.start ?? 0;
        const pos = sourceFile
          ? sourceFile.getLineAndCharacterOfPosition(start)
          : { line: 0, character: 0 };
        issues.push(
          `Syntax error in ${file.path}:${pos.line + 1}:${pos.character + 1} - ${message}`,
        );
      }
    }

    return uniq(issues);
  } catch {
    return [];
  }
}

function scoreVisualSimilarity(referenceTokens: string[], generatedTokens: string[]): number {
  if (referenceTokens.length === 0) return 70;
  const refSet = new Set(referenceTokens.map((token) => token.toLowerCase()));
  const genSet = new Set(generatedTokens.map((token) => token.toLowerCase()));
  const overlap = [...refSet].filter((token) => genSet.has(token)).length;
  const ratio = overlap / refSet.size;
  return Math.round(Math.min(100, Math.max(0, ratio * 100)));
}

function scoreInteractionCoverage(referenceHints: string[], files: GeneratedFile[]): number {
  if (referenceHints.length === 0) return 75;
  const corpus = files.map((file) => file.content.toLowerCase()).join('\n');
  const matched = referenceHints.filter((hint) => corpus.includes(hint.split(':')[1]?.toLowerCase() ?? hint.toLowerCase())).length;
  return Math.round((matched / referenceHints.length) * 100);
}

function acceptanceThreshold(mode: QualityMode): number {
  if (mode === 'strict_visual') return 78;
  if (mode === 'balanced') return 65;
  return 45;
}

function modeRequiresVisual(mode: QualityMode): boolean {
  return mode !== 'function_first';
}

function buildReviewerInput(params: ValidateOutputParams): string {
  const filesBlob = params.files
    .map((file) => `### ${file.path}\n\`\`\`${file.language}\n${file.content}\n\`\`\``)
    .join('\n\n');

  return [
    `Output stack: ${params.outputStack}`,
    `Spec:\n${JSON.stringify(params.spec, null, 2)}`,
    `Files:\n${filesBlob}`,
  ].join('\n\n');
}

export async function validateOutput(params: ValidateOutputParams): Promise<ValidateOutputResult> {
  const reviewer = await callAI({
    provider: params.provider,
    apiKey: params.apiKey,
    model: params.model,
    systemPrompt: REVIEW_PROMPT,
    userContent: buildReviewerInput(params),
    maxTokens: 2000,
  });

  const parsed = safeJsonParse<ReviewerResponse>(reviewer.text);
  const reviewerIssues = parsed?.criticalIssues ?? [];
  const reviewerPass = Boolean(parsed?.functionalPass);
  const localImportIssues = checkLocalImportResolution(params.files);
  const missingDependencyIssues = checkExternalDependencyDeclarations(params.files);
  const syntaxIssues = await checkSyntaxDiagnostics(params.files);
  const html = extractIndexHtml(params.files);
  const missingRefs = checkMissingHtmlReferences(params.files, html);
  const runtimeStructureIssues = checkRuntimeStructure(params.files, params.outputStack);
  const tailwindIssues = checkTailwindCompatibility(params.files, params.outputStack);
  const responsiveWarnings = checkResponsiveReadiness(params.files);
  const generatedTokens = parseGeneratedStyleTokens(params.files);
  const visualScore = Math.round(
    (scoreVisualSimilarity(params.references.styleTokens, generatedTokens) * 0.7)
    + (scoreInteractionCoverage(params.references.interactionHints, params.files) * 0.3)
  );

  const deterministicIssues = uniq([
    ...missingRefs,
    ...runtimeStructureIssues,
    ...tailwindIssues,
    ...localImportIssues,
    ...missingDependencyIssues,
    ...syntaxIssues,
  ]);
  const functionalIssues = uniq([...reviewerIssues, ...deterministicIssues]);
  const functionalPass = reviewerPass && functionalIssues.length === 0;
  const threshold = acceptanceThreshold(params.qualityMode);
  const responsivePass = responsiveWarnings.length === 0;
  const visualPass = modeRequiresVisual(params.qualityMode)
    ? visualScore >= threshold
    : true;

  const accepted = functionalPass && visualPass && responsivePass;
  const issues = [...functionalIssues];
  if (!visualPass) {
    issues.push(`Visual score ${visualScore} is below threshold ${threshold} for mode ${params.qualityMode}.`);
  }
  if (!responsivePass) {
    issues.push('Responsive checks failed.');
  }

  const patchLines = uniq([...deterministicIssues, ...issues]).slice(0, 20);
  const mergedPatchInstructions = [
    parsed?.patchInstructions?.trim() || '',
    patchLines.length > 0
      ? `Fix the following issues exactly:\n${patchLines.map((line) => `- ${line}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n');

  const report: QualityReport = {
    visualScore,
    functionalPass,
    issues,
    accepted,
    retryRecommended: !accepted,
    patchInstructions: mergedPatchInstructions || undefined,
    responsiveWarnings,
  };

  return {
    report,
    usage: reviewer.usage,
  };
}

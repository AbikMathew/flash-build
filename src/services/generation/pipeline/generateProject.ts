import { AIProvider, DesignSpec, OutputStack, ReferenceBundle } from '@/types';
import { AIUsage, callAI } from './aiClient';

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

interface GenerateProjectParams {
  provider: AIProvider;
  apiKey: string;
  model: string;
  spec: DesignSpec;
  outputStack: OutputStack;
  references: ReferenceBundle;
  repairInstructions?: string;
  existingFiles?: GeneratedFile[];
}

interface GenerateProjectResult {
  files: GeneratedFile[];
  usage: AIUsage;
}

const BUILDER_PROMPT = `You are the Builder agent of FlashBuild.

Generate complete source files for the provided specification.

Critical rules:
1) Output only file blocks:
---FILE: path/to/file.ext---
<content>
---END FILE---
2) Runtime target:
   - vanilla output must run directly via srcdoc
   - react-tailwind output must be npm-runnable (vite + modules + package.json) and previewable in Sandpack
3) Include full interaction behavior from the specification (forms, navigation, state updates, edge handling).
4) Follow reference style tokens, spacing, and layout hierarchy with high visual fidelity.
5) Do not include markdown or explanations outside file blocks.
6) Files required by outputStack:
   - vanilla: index.html, styles.css, app.js
   - react-tailwind: package.json, index.html, src/main.tsx, src/App.tsx, src/styles.css, tailwind.config.js, postcss.config.js
7) Responsive baseline is mandatory:
   - include viewport meta tag
   - mobile-first rules with breakpoints at 375px, 768px, 1280px (media queries or utility breakpoints)
   - prevent horizontal overflow in each viewport
8) React output may use imports/modules and package dependencies.
`;

function buildLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const langMap: Record<string, string> = {
    html: 'html',
    htm: 'html',
    css: 'css',
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    json: 'json',
    md: 'markdown',
  };
  return langMap[ext] ?? 'plaintext';
}

function parseFiles(raw: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const fileRegex = /---FILE:\s*(.+?)---\n([\s\S]*?)---END FILE---/g;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(raw)) !== null) {
    const path = match[1].trim();
    const content = match[2].trim();
    files.push({ path, content, language: buildLanguage(path) });
  }
  return files;
}

function buildUserInput(params: GenerateProjectParams): string {
  const stackHint = params.outputStack === 'react-tailwind'
    ? 'Generate modern React + Tailwind code with component architecture, hooks, and package imports when useful.'
    : 'Use vanilla HTML/CSS/JS architecture with modular JS and semantic markup.';
  const requiredReactFiles = params.outputStack === 'react-tailwind'
    ? [
      'Required React project files:',
      '- package.json',
      '- index.html',
      '- src/main.tsx',
      '- src/App.tsx',
      '- src/components/* (as needed)',
      '- src/styles.css',
      '- tailwind.config.js',
      '- postcss.config.js',
    ].join('\n')
    : 'Required vanilla files: index.html, styles.css, app.js';

  const base = [
    `Output stack: ${params.outputStack}`,
    `Stack guidance: ${stackHint}`,
    requiredReactFiles,
    'Responsive requirements: viewport meta + mobile-first + breakpoints 375/768/1280 + no horizontal overflow.',
    `Reference confidence: ${params.references.referenceConfidence}`,
    `Style tokens to mirror:\n${params.references.styleTokens.join('\n') || '(none)'}`,
    `Interaction hints:\n${params.references.interactionHints.join('\n') || '(none)'}`,
    `Specification JSON:\n${JSON.stringify(params.spec, null, 2)}`,
  ].join('\n\n');

  if (!params.repairInstructions) return base;

  const existingFiles = (params.existingFiles ?? [])
    .map((file) => `---FILE: ${file.path}---\n${file.content}\n---END FILE---`)
    .join('\n\n');

  return [
    base,
    `Repair instructions:\n${params.repairInstructions}`,
    `Current files to patch:\n${existingFiles}`,
    'Regenerate all files with fixes applied.',
  ].join('\n\n');
}

function buildMessageParts(provider: AIProvider, references: ReferenceBundle, text: string): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [{ type: 'text', text }];
  for (const image of references.referenceScreenshots) {
    if (provider === 'anthropic') {
      parts.push({
        type: 'image',
        source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
      });
    } else {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
      });
    }
  }
  return parts;
}

export async function generateProject(params: GenerateProjectParams): Promise<GenerateProjectResult> {
  const builderInput = buildUserInput(params);
  const result = await callAI({
    provider: params.provider,
    apiKey: params.apiKey,
    model: params.model,
    systemPrompt: BUILDER_PROMPT,
    userContent: buildMessageParts(params.provider, params.references, builderInput),
    maxTokens: 16_000,
  });

  const files = parseFiles(result.text);
  if (files.length > 0) {
    return { files, usage: result.usage };
  }

  return {
    files: [{ path: 'index.html', content: result.text, language: 'html' }],
    usage: result.usage,
  };
}

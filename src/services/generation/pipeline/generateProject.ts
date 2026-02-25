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

const BUILDER_PROMPT = `You are the Builder agent of FlashBuild — an expert frontend engineer who writes stunning, production-quality UI code.

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

Visual design standards (apply always — override ONLY when reference screenshots dictate a different style):
9) COLOR & THEME:
   - Use a cohesive, curated color palette — never generic red/blue/green
   - Default to a premium dark theme: slate-900/950 backgrounds, subtle border-slate-800 dividers
   - Accent colors via gradients: bg-gradient-to-r from-blue-500 to-violet-500 (or contextually appropriate)
   - Text hierarchy: text-white for primary, text-slate-300 for secondary, text-slate-500 for muted
10) DEPTH & POLISH:
   - Cards/panels: bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-xl
   - Elevated elements: shadow-2xl, ring-1 ring-white/10 for glass effects
   - Input fields: bg-slate-800/50 border-slate-700 focus:ring-2 focus:ring-blue-500/50
   - Buttons: gradient backgrounds, hover:brightness-110, active:scale-[0.98] transition-all duration-200
11) TYPOGRAPHY & SPACING:
   - Use font-sans (system-ui/Inter) — clean and modern
   - Headings: font-bold text-2xl/3xl with tracking-tight
   - Consistent spacing scale: p-4/p-6, gap-4/gap-6 (avoid arbitrary values like p-[13px])
   - Section padding: py-8 or py-12 for breathing room
12) MICRO-INTERACTIONS & ANIMATIONS:
   - All interactive elements must have hover/focus/active states
   - Smooth transitions: transition-all duration-200 ease-in-out on buttons, cards, links
   - Use CSS animations and Tailwind's animate-* utilities for entrance effects (animate-fade-in, animate-slide-up)
   - Define @keyframes in styles.css for custom animations (fadeIn, slideUp, pulse)
   - Loading states: animated spinners or skeleton screens, never blank loading
   - Empty states: centered message with icon and call-to-action
13) ICONS & IMAGERY:
   - Use react-icons for all icons (import { FiHome, FiSettings } from 'react-icons/fi' for Feather icons, or 'react-icons/hi2' for Heroicons)
   - Icons should have size={18-20} or className="w-5 h-5"
   - Include icons in buttons, nav items, empty states, and cards for visual richness
   - If react-icons is not available, use Unicode emoji (📊 🏠 ⚙️ etc.) as fallback
14) RECOMMENDED PACKAGES for premium UI (include in package.json dependencies when used):
   - react-icons: comprehensive icon library (feather, heroicons, material, etc.)
   - Do NOT use framer-motion (causes runtime crashes in preview environment)
   - Do NOT use lucide-react (not available in preview runtime)
   - Do NOT use @shadcn/ui, Material UI, or Chakra UI (not compatible with preview runtime)
   - Do NOT use next/image, next/link, or Next.js-specific imports

When reference screenshots or images are provided (strict_visual mode):
15) PIXEL-MATCHING RULES:
   - Match the EXACT layout structure (grid columns, flex direction, spacing ratios)
   - Eyedrop colors from the screenshot — do not substitute with similar colors
   - Replicate typography hierarchy precisely (font sizes, weights, line-heights, letter-spacing)
   - Match border-radius values (sharp corners vs rounded vs pill shapes)
   - Preserve the reference's whitespace rhythm and visual density
   - Include ALL visible content/sections shown in the reference — do not simplify or omit any section
   - If the reference uses light theme, use light theme. Match what you see.

CRITICAL — Sandpack preview environment constraints:
16) TAILWIND CSS USAGE:
   - Tailwind is loaded via CDN script tag — DO NOT use @import "tailwindcss" or @tailwind directives in CSS
   - DO NOT include postcss.config.js or tailwind.config.js — they are not processed in the preview
   - Write CSS files with only custom styles (body reset, animations, etc.). All Tailwind utility classes work directly in JSX.
   - src/styles.css should contain ONLY custom CSS, not Tailwind imports
17) AVAILABLE PACKAGES (include in package.json when used):
   - react-icons: USE for all icons. Import: { FiHome } from 'react-icons/fi' or { HiOutlineHome } from 'react-icons/hi2'
   - react-router-dom: USE for multi-page navigation (BrowserRouter, Routes, Route, Link)
   - recharts: USE for data visualization (charts, graphs)
   - clsx + tailwind-merge: USE for conditional class merging
   - zustand: USE for state management in complex apps
   - Do NOT use framer-motion (crashes in preview runtime — use CSS animations instead)
   - Do NOT use lucide-react (PackageNotFound in preview CDN)
   - Do NOT use @shadcn/ui, Material UI, or Chakra UI (not compatible with preview runtime)
   - Do NOT use next/image, next/link, or Next.js-specific imports
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
    let content = match[2].trim();
    // Strip markdown code fences — the AI sometimes wraps file content in ```lang ... ```
    content = content
      .replace(/^```[\w-]*\s*\n?/, '')   // opening fence: ```tsx or ```css etc.
      .replace(/\n?```\s*$/, '')          // closing fence: ```
      .trim();
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

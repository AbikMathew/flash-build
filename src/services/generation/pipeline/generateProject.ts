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
3) Include FULL interaction behavior from the specification:
   - Forms must validate, submit, and show feedback
   - Navigation must work with react-router-dom (HashRouter, Routes, Route, Link)
   - State changes must be visually reflected (loading → loaded, empty → populated, active → disabled)
   - Buttons/links must have click handlers that DO something visible
   - Lists, cards, grids must have realistic mock data (5-8 items minimum)
4) Follow reference style tokens, spacing, and layout hierarchy with high visual fidelity.
5) Do not include markdown or explanations outside file blocks. Do NOT wrap file content in code fences.
6) Files required by outputStack:
   - vanilla: index.html, styles.css, app.js
   - react-tailwind: package.json, index.html, src/main.tsx, src/App.tsx, src/styles.css, src/components/* (as needed)
   - Do NOT include tailwind.config.js or postcss.config.js (Tailwind runs via CDN in the preview)
7) Responsive baseline is mandatory:
   - include viewport meta tag
   - Sidebar: w-64 on desktop, hidden or collapsed icon-only on mobile (use state toggle)
   - Cards: grid-cols-1 on mobile, grid-cols-2 on md, grid-cols-3 or 4 on lg
   - prevent horizontal overflow — use overflow-x-hidden on body/root
   - Test mental model: 375px phone, 768px tablet, 1280px desktop
8) React output may use imports/modules and package dependencies.

FUNCTIONALITY & INTERACTIVITY (this is critical — apps must feel alive):
9) MULTI-SCREEN APPS:
   - If the spec defines routes, implement all routes with react-router-dom using HashRouter
   - Sidebar/navbar links must navigate between screens using <Link to="/path">
   - Each route must render a distinct, fully-built screen (not a placeholder)
10) STATE MANAGEMENT:
   - Use React useState/useReducer for local state (toggling sidebar, form inputs, tab selection)
   - Use zustand for shared state in complex apps (cart, user preferences, filters)
   - Every interactive element must update state and re-render visually
11) REALISTIC MOCK DATA:
   - Populate lists with 5-8 items, tables with 5-10 rows, charts with realistic data
   - Use diverse, realistic names/values (not "Item 1", "Item 2")
   - Include edge cases: empty states, loading skeletons, error messages
12) SCROLLING & OVERFLOW:
   - Main content area must scroll independently (overflow-y-auto)
   - Sidebar and header should be fixed/sticky
   - Long lists should scroll smoothly within their container

Visual design standards (apply always — override ONLY when reference screenshots dictate a different style):
13) COLOR & THEME:
   - Use a cohesive, curated color palette — never generic red/blue/green
   - Default to a premium dark theme: slate-900/950 backgrounds, subtle border-slate-800 dividers
   - Accent colors via gradients: bg-gradient-to-r from-blue-500 to-violet-500 (or contextually appropriate)
   - Text hierarchy: text-white for primary, text-slate-300 for secondary, text-slate-500 for muted
14) DEPTH & POLISH:
   - Cards/panels: bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-xl
   - Elevated elements: shadow-2xl, ring-1 ring-white/10 for glass effects
   - Input fields: bg-slate-800/50 border-slate-700 focus:ring-2 focus:ring-blue-500/50
   - Buttons: gradient backgrounds, hover:brightness-110, active:scale-[0.98] transition-all duration-200
15) TYPOGRAPHY & SPACING:
   - Use font-sans (system-ui/Inter) — clean and modern
   - Headings: font-bold text-2xl/3xl with tracking-tight
   - Consistent spacing scale: p-4/p-6, gap-4/gap-6 (avoid arbitrary values like p-[13px])
   - Section padding: py-8 or py-12 for breathing room
16) MICRO-INTERACTIONS & ANIMATIONS:
   - All interactive elements must have hover/focus/active states
   - Smooth transitions: transition-all duration-200 ease-in-out on buttons, cards, links
   - Use framer-motion for entrance animations (fadeIn, slideUp), page transitions, and layout animations
   - Import: import { motion, AnimatePresence } from 'framer-motion'
   - Loading states: animated spinners or skeleton screens, never blank loading
   - Empty states: centered message with icon and call-to-action
17) ICONS & IMAGERY:
   - Use lucide-react for all icons (import { Home, Settings, Search } from 'lucide-react')
   - Icons should be size={18-20} with strokeWidth={1.5}
   - Fallback: use react-icons (import { FiHome } from 'react-icons/fi')
   - Include icons in buttons, nav items, empty states, and cards for visual richness
18) RECOMMENDED PACKAGES for premium UI (include in package.json dependencies when used):
   - framer-motion: entrance/exit animations, layoutId transitions, spring physics (ALWAYS use for polished UI)
   - lucide-react: clean, modern icon set (preferred). Fallback: react-icons
   - react-router-dom: multi-page navigation — MUST use HashRouter, NOT BrowserRouter (preview env limitation)
   - recharts: data visualization (charts, graphs, metrics)
   - clsx + tailwind-merge: conditional class merging
   - zustand: state management for complex apps
   - Do NOT use @shadcn/ui, Material UI, or Chakra UI (not compatible with preview runtime)
   - Do NOT use next/image, next/link, or Next.js-specific imports

When reference screenshots or images are provided (strict_visual mode):
19) PIXEL-MATCHING RULES:
   - Treat the reference screenshot as the GOLD STANDARD — your output must be visually indistinguishable
   - Count the exact number of items in lists, cards, grid columns — match them precisely
   - Replicate the EXACT text content visible in the reference (button labels, headings, placeholder text)
   - Match the EXACT layout structure (grid columns, flex direction, spacing ratios)
   - Eyedrop colors from the screenshot — do not substitute with similar colors
   - Replicate typography hierarchy precisely (font sizes, weights, line-heights, letter-spacing)
   - Match border-radius values (sharp corners vs rounded vs pill shapes)
   - Preserve the reference's whitespace rhythm and visual density
   - Include ALL visible content/sections shown in the reference — do not simplify or omit any section
   - If the reference uses light theme, use light theme. Do NOT default to dark. Match what you see.

CRITICAL — Sandpack preview environment constraints:
20) TAILWIND CSS USAGE:
   - Tailwind is loaded via CDN script tag — DO NOT use @import "tailwindcss" or @tailwind directives in CSS
   - DO NOT include postcss.config.js or tailwind.config.js — they are not processed in the preview
   - Write CSS files with only custom styles (body reset, @keyframes animations, etc.). All Tailwind utility classes work directly in JSX className.
   - src/styles.css should contain ONLY custom CSS, not Tailwind imports
21) AVAILABLE PACKAGES (include in package.json when used):
   - framer-motion: USE for entrance animations, page transitions, spring physics
   - lucide-react: USE for all icons (preferred over react-icons)
   - react-icons: USE as fallback for icons
   - react-router-dom: USE for multi-page navigation — MUST use HashRouter (NOT BrowserRouter)
   - recharts: USE for data visualization
   - clsx + tailwind-merge: USE for conditional class merging
   - zustand: USE for state management in complex apps
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
      '- package.json (with all used dependencies)',
      '- index.html (root mount + viewport meta)',
      '- src/main.tsx (React entrypoint)',
      '- src/App.tsx (app shell with routing if multi-screen)',
      '- src/components/* (one file per component)',
      '- src/styles.css (custom CSS only — NO Tailwind imports)',
      'Do NOT include tailwind.config.js or postcss.config.js',
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
    maxTokens: params.provider === 'anthropic' ? 32_000 : 16_000,
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

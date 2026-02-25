import { AIProvider, DesignSpec, OutputStack, QualityMode, ReferenceBundle } from '@/types';
import { AIUsage, callAI, safeJsonParse } from './aiClient';

interface ExtractDesignSpecParams {
  provider: AIProvider;
  apiKey: string;
  model: string;
  outputStack: OutputStack;
  qualityMode: QualityMode;
  references: ReferenceBundle;
}

interface ExtractDesignSpecResult {
  spec: DesignSpec;
  usage: AIUsage;
}

const DESIGN_SPEC_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'appName',
    'description',
    'outputStack',
    'layout',
    'visualSystem',
    'components',
    'interactions',
    'filePlan',
  ],
  properties: {
    appName: { type: 'string' },
    description: { type: 'string' },
    outputStack: { type: 'string', enum: ['react-tailwind', 'vanilla'] },
    layout: {
      type: 'object',
      additionalProperties: false,
      required: ['structure', 'sections', 'breakpoints'],
      properties: {
        structure: { type: 'string' },
        sections: { type: 'array', items: { type: 'string' } },
        breakpoints: { type: 'array', items: { type: 'string' } },
      },
    },
    visualSystem: {
      type: 'object',
      additionalProperties: false,
      required: ['palette', 'typography', 'spacing'],
      properties: {
        palette: { type: 'array', items: { type: 'string' } },
        typography: { type: 'array', items: { type: 'string' } },
        spacing: { type: 'array', items: { type: 'string' } },
      },
    },
    components: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'role', 'states'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          states: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    interactions: { type: 'array', items: { type: 'string' } },
    filePlan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'purpose'],
        properties: {
          path: { type: 'string' },
          purpose: { type: 'string' },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are the Design Architect of FlashBuild.

Generate a strict JSON specification for an app replica.

Rules:
1) Prioritize visual fidelity to references first, then functional coverage.
2) Do not invent product features that are not implied by inputs.
3) Runtime target by outputStack:
   - vanilla: direct browser execution (srcdoc-safe files)
   - react-tailwind: npm-runnable project suitable for module runtime (Sandpack/remote)
4) File plan must match outputStack:
   - vanilla: index.html, styles.css, app.js
   - react-tailwind: package.json, index.html, src/main.tsx, src/App.tsx, src/styles.css, tailwind.config.js, postcss.config.js
5) Responsive requirements are mandatory: viewport meta + mobile-first behavior with breakpoints at 375px, 768px, 1280px.
6) Use exact-like color and spacing tokens where possible.
7) Include concrete interactions for critical user flows.
8) When reference images/screenshots are present, extract GRANULAR visual tokens:
   - Exact hex colors visible in the design (eyedrop, do not guess)
   - Font size ratios between headings/body (e.g., 'heading:32px/body:14px')
   - Border-radius patterns ('rounded-xl', 'sharp corners', 'pill buttons')
   - Shadow intensity levels ('subtle drop-shadow', 'heavy elevation')
   - Layout grid structure ('2-column sidebar', '3-card grid', 'max-w-7xl centered')
9) When NO reference images exist (text-only prompt), provide premium defaults:
   - palette: dark slate theme with blue/violet accents
   - typography: system-ui/Inter font stack, bold headings, regular body
   - spacing: consistent 4px/8px grid system
   These defaults ensure beautiful output even without visual references.

Return ONLY JSON.`;

function buildFallbackSpec(references: ReferenceBundle, outputStack: OutputStack): DesignSpec {
  const reactFilePlan: DesignSpec['filePlan'] = [
    { path: 'package.json', purpose: 'Dependencies and scripts for npm runtime' },
    { path: 'index.html', purpose: 'Root HTML with #root mount and viewport meta' },
    { path: 'src/main.tsx', purpose: 'React entrypoint and root render' },
    { path: 'src/App.tsx', purpose: 'Primary app shell and layout' },
    { path: 'src/styles.css', purpose: 'Tailwind import and global styles' },
    { path: 'tailwind.config.js', purpose: 'Tailwind content scanning and theme extension' },
    { path: 'postcss.config.js', purpose: 'PostCSS + Tailwind plugin wiring' },
  ];
  const vanillaFilePlan: DesignSpec['filePlan'] = [
    { path: 'index.html', purpose: 'Main markup and application mount points' },
    { path: 'styles.css', purpose: 'Design tokens and component styling' },
    { path: 'app.js', purpose: 'State, rendering, and event handlers' },
  ];

  return {
    appName: 'Replica Studio',
    description: references.prompt.slice(0, 140) || 'Generated web app replica',
    outputStack,
    layout: {
      structure: 'Single-page app with header, main content area, and utility panels.',
      sections: ['header', 'main', 'footer'],
      breakpoints: ['375', '768', '1280'],
    },
    visualSystem: {
      palette: references.styleTokens.filter((token) => token.startsWith('#')).slice(0, 8).length > 0
        ? references.styleTokens.filter((token) => token.startsWith('#')).slice(0, 8)
        : ['#0f172a', '#1e293b', '#334155', '#3b82f6', '#8b5cf6', '#f8fafc', '#94a3b8', '#22d3ee'],
      typography: references.styleTokens.filter((token) => token.includes('font-family')).slice(0, 4).length > 0
        ? references.styleTokens.filter((token) => token.includes('font-family')).slice(0, 4)
        : ['font-family: system-ui, -apple-system, Inter, sans-serif', 'font-weight: 700 headings', 'font-weight: 400 body'],
      spacing: references.styleTokens.filter((token) => token.includes('padding') || token.includes('margin')).slice(0, 6).length > 0
        ? references.styleTokens.filter((token) => token.includes('padding') || token.includes('margin')).slice(0, 6)
        : ['padding: 1rem (p-4)', 'padding: 1.5rem (p-6)', 'gap: 1rem (gap-4)', 'gap: 1.5rem (gap-6)', 'margin: 2rem section spacing'],
    },
    components: [
      { name: 'Header', role: 'Navigation and branding', states: ['default'] },
      { name: 'MainContent', role: 'Primary UI rendering', states: ['default', 'loading'] },
      { name: 'ActionControls', role: 'Primary interactions', states: ['idle', 'active', 'disabled'] },
    ],
    interactions: references.interactionHints.slice(0, 10),
    filePlan: outputStack === 'react-tailwind' ? reactFilePlan : vanillaFilePlan,
  };
}

function buildUserText(params: ExtractDesignSpecParams): string {
  const { references, outputStack, qualityMode } = params;
  return [
    `Prompt:\n${references.prompt || '(no text prompt provided)'}`,
    `Output stack: ${outputStack}`,
    `Quality mode: ${qualityMode}`,
    `Reference confidence: ${references.referenceConfidence}`,
    `DOM summary:\n${references.domSummary || '(none)'}`,
    `Style tokens:\n${references.styleTokens.join('\n') || '(none)'}`,
    `Interaction hints:\n${references.interactionHints.join('\n') || '(none)'}`,
    `Warnings:\n${references.warnings.join('\n') || '(none)'}`,
  ].join('\n\n');
}

function buildImageParts(provider: AIProvider, references: ReferenceBundle): Array<Record<string, unknown>> {
  return references.referenceScreenshots.map((image) => {
    if (provider === 'anthropic') {
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mimeType,
          data: image.base64,
        },
      };
    }
    return {
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.base64}`,
      },
    };
  });
}

export async function extractDesignSpec(params: ExtractDesignSpecParams): Promise<ExtractDesignSpecResult> {
  const userContent: Array<Record<string, unknown>> = [
    { type: 'text', text: buildUserText(params) },
    ...buildImageParts(params.provider, params.references),
  ];

  const result = await callAI({
    provider: params.provider,
    apiKey: params.apiKey,
    model: params.model,
    systemPrompt: SYSTEM_PROMPT,
    userContent,
    maxTokens: 3500,
    jsonSchema: params.provider === 'openai' ? DESIGN_SPEC_SCHEMA : undefined,
  });

  const parsed = safeJsonParse<DesignSpec>(result.text);
  if (!parsed) {
    return {
      spec: buildFallbackSpec(params.references, params.outputStack),
      usage: result.usage,
    };
  }

  const normalized: DesignSpec = {
    ...parsed,
    outputStack: parsed.outputStack ?? params.outputStack,
    filePlan: parsed.filePlan?.length ? parsed.filePlan : buildFallbackSpec(params.references, params.outputStack).filePlan,
  };

  return { spec: normalized, usage: result.usage };
}

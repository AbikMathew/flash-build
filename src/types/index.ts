// ============================================================
// Core Types for the App Generator
// All interfaces that components and services depend on
// ============================================================

/** A single file within a generated project */
export interface ProjectFile {
  /** Relative path, e.g. "src/App.tsx" */
  path: string;
  /** Raw file content */
  content: string;
  /** Language identifier for syntax highlighting */
  language: string;
}

/** Metadata about a generated project */
export interface ProjectMetadata {
  name: string;
  description: string;
  framework: string;
  createdAt: Date;
  runtimeHint?: RuntimeHint;
  packageManifest?: PackageManifest;
  responsiveReport?: ResponsiveReport;
}

/** A complete generated project */
export interface GeneratedProject {
  files: ProjectFile[];
  metadata: ProjectMetadata;
  /** Combined HTML for preview (bundled by the preview service) */
  previewHtml?: string;
  previewRuntime?: PreviewRuntimePayload;
}

/** User-provided inputs for generation */
export interface GeneratorInput {
  prompt: string;
  images: UploadedImage[];
  urls: string[];
}

/** An uploaded image with preview */
export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
}

/** Generation progress events emitted during the generation process */
export type GenerationEventType =
  | 'ingesting'
  | 'planning'
  | 'analyzing'
  | 'coding'
  | 'compiling'
  | 'reviewing'
  | 'validating'
  | 'responsive_check'
  | 'runtime_fallback'
  | 'complete'
  | 'error';

export interface GenerationEvent {
  type: GenerationEventType;
  message: string;
  /** Optional: file being created/updated */
  file?: ProjectFile;
  /** 0-100 progress percentage */
  progress: number;
  timestamp: Date;
}

/** Generation states for UI display */
export type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

/** Preview viewport sizes */
export type ViewportSize = 'desktop' | 'tablet' | 'mobile';

/** View mode for the workspace */
export type WorkspaceView = 'code' | 'preview' | 'split';

/** Supported AI providers */
export type AIProvider = 'anthropic' | 'openai';

/** Runtime used to execute generated apps in preview */
export type PreviewRuntimeMode = 'srcdoc' | 'sandpack' | 'remote';

/** Export mode for downloaded projects */
export type ExportMode = 'full-project' | 'ui-only';

/** Output stack preferences for generated projects */
export type OutputStack = 'react-tailwind' | 'vanilla';

/** Quality gate strategy */
export type QualityMode = 'strict_visual' | 'balanced' | 'function_first';

/** Runtime guardrails for generation */
export interface GenerationConstraints {
  maxRetries: number;
  maxCostUsd: number;
}

/** Package manifest extracted or synthesized from generated files */
export interface PackageManifest {
  framework: OutputStack;
  entry: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/** Runtime recommendation derived from generated files/package complexity */
export interface RuntimeHint {
  preferredRuntime: PreviewRuntimeMode;
  fallbackRuntime?: PreviewRuntimeMode;
  reason: string;
  complexityScore: number;
}

/** Responsive health report from validation */
export interface ResponsiveReport {
  passed: boolean;
  warnings: string[];
  checkedViewports: number[];
}

/** Runtime payload used by the preview pane */
export interface PreviewRuntimePayload {
  mode: PreviewRuntimeMode;
  srcdocHtml?: string;
  sandpack?: {
    files: Record<string, string>;
    template: 'react-ts' | 'vite-react-ts' | 'vanilla';
    externalResources?: string[];
    customSetup: {
      entry: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
  };
  remote?: {
    status: 'idle' | 'starting' | 'running' | 'error';
    previewUrl?: string;
    logs?: string[];
    error?: string;
  };
  warnings?: string[];
}

/** AI configuration for BYOK */
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

/** Screenshot-style reference used by the generation pipeline */
export interface ReferenceScreenshot {
  source: 'upload' | 'url';
  origin?: string;
  mimeType: string;
  base64: string;
}

/** Structured reference information used for design extraction and validation */
export interface ReferenceBundle {
  prompt: string;
  referenceScreenshots: ReferenceScreenshot[];
  domSummary: string;
  styleTokens: string[];
  interactionHints: string[];
  referenceConfidence: number;
  warnings: string[];
}

/** Structured blueprint used to generate a project */
export interface DesignSpec {
  appName: string;
  description: string;
  outputStack: OutputStack;
  layout: {
    structure: string;
    sections: string[];
    breakpoints: string[];
  };
  visualSystem: {
    palette: string[];
    typography: string[];
    spacing: string[];
  };
  components: Array<{
    name: string;
    role: string;
    states: string[];
  }>;
  interactions: string[];
  filePlan: Array<{
    path: string;
    purpose: string;
  }>;
}

/** Quality gate output from validation stage */
export interface QualityReport {
  visualScore: number;
  functionalPass: boolean;
  issues: string[];
  accepted: boolean;
  retryRecommended: boolean;
  patchInstructions?: string;
  responsiveWarnings?: string[];
}

/** Request body for the /api/generate endpoint */
export interface GenerateAPIRequest {
  prompt: string;
  images: { name: string; base64: string; mimeType: string }[];
  urls: string[];
  config: AIConfig;
  outputStack?: OutputStack;
  qualityMode?: QualityMode;
  constraints?: Partial<GenerationConstraints>;
  previewRuntimePreference?: PreviewRuntimeMode | 'auto';
  exportMode?: ExportMode;
}

/** Streamed chunk from the /api/generate endpoint */
export interface GenerateAPIChunk {
  type: 'event' | 'file' | 'metadata' | 'error' | 'done';
  event?: GenerationEvent;
  file?: ProjectFile;
  metadata?: ProjectMetadata;
  error?: string;
}

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
}

/** A complete generated project */
export interface GeneratedProject {
  files: ProjectFile[];
  metadata: ProjectMetadata;
  /** Combined HTML for preview (bundled by the preview service) */
  previewHtml?: string;
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
  | 'planning'
  | 'analyzing'
  | 'coding'
  | 'reviewing'
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

/** AI configuration for BYOK */
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

/** Request body for the /api/generate endpoint */
export interface GenerateAPIRequest {
  prompt: string;
  images: { name: string; base64: string; mimeType: string }[];
  urls: string[];
  config: AIConfig;
}

/** Streamed chunk from the /api/generate endpoint */
export interface GenerateAPIChunk {
  type: 'event' | 'file' | 'metadata' | 'error' | 'done';
  event?: GenerationEvent;
  file?: ProjectFile;
  metadata?: ProjectMetadata;
  error?: string;
}

import { IGeneratorService } from './GeneratorService';
import {
    GeneratorInput,
    GenerationEvent,
    GeneratedProject,
    AIConfig,
    GenerateAPIChunk,
    ProjectFile,
    ProjectMetadata,
} from '@/types';
import { PreviewService } from '@/services/preview/PreviewService';
import { PreviewRuntimeService } from '@/services/preview/runtime/PreviewRuntimeService';

/**
 * AI Generator Service
 * 
 * Calls the /api/generate endpoint which proxies to Claude or GPT-4o.
 * Implements the same IGeneratorService interface as MockGenerator,
 * so swapping is transparent to the UI.
 */
export class AIGenerator implements IGeneratorService {
    readonly id = 'ai';
    readonly name = 'AI Generator';

    private config: AIConfig | null = null;

    constructor(config?: AIConfig) {
        this.config = config || this.loadConfig();
    }

    /** Load saved config from localStorage */
    private loadConfig(): AIConfig | null {
        if (typeof window === 'undefined') return null;
        try {
            const saved = localStorage.getItem('flashbuild_ai_config');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    }

    /** Save config to localStorage */
    static saveConfig(config: AIConfig): void {
        localStorage.setItem('flashbuild_ai_config', JSON.stringify(config));
    }

    /** Get saved config */
    static getConfig(): AIConfig | null {
        if (typeof window === 'undefined') return null;
        try {
            const saved = localStorage.getItem('flashbuild_ai_config');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    }

    /** Clear saved config */
    static clearConfig(): void {
        localStorage.removeItem('flashbuild_ai_config');
    }

    isAvailable(): boolean {
        return !!this.config?.apiKey;
    }

    async *generate(input: GeneratorInput): AsyncGenerator<GenerationEvent, GeneratedProject, undefined> {
        if (!this.config?.apiKey) {
            throw new Error('AI API key not configured. Please set your API key in Settings.');
        }

        // Convert uploaded images to base64
        const images = await Promise.all(
            input.images.map(async (img) => {
                const buffer = await img.file.arrayBuffer();
                const base64 = btoa(
                    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
                return {
                    name: img.name,
                    base64,
                    mimeType: img.file.type || 'image/png',
                };
            })
        );

        // Call our API route
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: input.prompt,
                images,
                urls: input.urls,
                config: this.config,
                outputStack: 'react-tailwind',
                qualityMode: 'strict_visual',
                previewRuntimePreference: 'auto',
                exportMode: 'full-project',
                constraints: {
                    maxRetries: 1,
                    maxCostUsd: 0.25,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        const collectedFiles: ProjectFile[] = [];
        let projectMetadata: ProjectMetadata | null = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete lines (NDJSON)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (!line.trim()) continue;

                let chunk: GenerateAPIChunk;
                try {
                    chunk = JSON.parse(line);
                } catch {
                    continue;
                }

                switch (chunk.type) {
                    case 'event':
                        if (chunk.event) {
                            yield {
                                ...chunk.event,
                                timestamp: new Date(chunk.event.timestamp),
                            };
                        }
                        break;

                    case 'file':
                        if (chunk.file) {
                            collectedFiles.push(chunk.file);
                            yield {
                                type: 'coding',
                                message: `Created ${chunk.file.path}`,
                                file: chunk.file,
                                progress: 70 + Math.round((collectedFiles.length / 5) * 20),
                                timestamp: new Date(),
                            };
                        }
                        break;

                    case 'metadata':
                        if (chunk.metadata) {
                            projectMetadata = {
                                ...chunk.metadata,
                                createdAt: new Date(chunk.metadata.createdAt),
                            };
                        }
                        break;

                    case 'error':
                        throw new Error(chunk.error || 'Generation failed');

                    case 'done':
                        break;
                }
            }
        }

        // Build the final project
        const metadata = projectMetadata || {
            name: 'Generated App',
            description: input.prompt,
            framework: 'React + Tailwind',
            createdAt: new Date(),
        };

        const previewHtml = PreviewService.bundle(collectedFiles);
        const previewRuntime = PreviewRuntimeService.resolve(
            collectedFiles,
            metadata,
            previewHtml,
            'auto'
        ).runtime;

        return {
            files: collectedFiles,
            metadata,
            previewHtml,
            previewRuntime,
        };
    }
}

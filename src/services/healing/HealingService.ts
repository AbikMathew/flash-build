import { ProjectFile } from '@/types';

export type HealingActionType = 'add-dependency' | 'change-template' | 'config-change';

export interface HealingAction {
    type: HealingActionType;
    description: string;
    payload: any;
}

export class HealingService {
    static analyzeError(logs: string[]): HealingAction | null {
        const fullLog = logs.join('\n');

        // Error: "linux" and architecture "x32" combination is not yet supported by the native Rollup build
        if (fullLog.includes('not yet supported by the native Rollup build') || fullLog.includes('Expected a WebAssembly.Module')) {
            return {
                type: 'add-dependency',
                description: 'Fix platform compatibility (Rollup WASM)',
                payload: {
                    dependency: '@rollup/wasm-node',
                    version: 'latest'
                }
            };
        }

        // Error: Cannot find module 'esbuild-wasm'
        if (fullLog.includes("Cannot find module 'esbuild-wasm'")) {
            return {
                type: 'add-dependency',
                description: 'Add missing esbuild-wasm',
                payload: {
                    dependency: 'esbuild-wasm',
                    version: '0.15.18'
                }
            };
        }

        return null;
    }

    static async applyFix(action: HealingAction, files: ProjectFile[]): Promise<ProjectFile[]> {
        if (action.type === 'add-dependency') {
            const pkgJson = files.find(f => f.path === 'package.json');
            if (!pkgJson) throw new Error('package.json not found');

            const content = JSON.parse(pkgJson.content);
            content.dependencies = content.dependencies || {};
            content.dependencies[action.payload.dependency] = action.payload.version;

            // If fixing rollup, we might also need to ensure vite doesn't use standard rollup?
            // Usually adding the dep is enough for Sandpack/Vite to pick it up if aliased, 
            // but just adding it is the first step.

            return files.map(f => f.path === 'package.json' ? { ...f, content: JSON.stringify(content, null, 2) } : f);
        }
        return files;
    }
}

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { Monaco } from '@monaco-editor/react';
import { ProjectFile } from '@/types';

// Lazy-load Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CodeEditorProps {
    file: ProjectFile | null;
    onContentChange?: (content: string) => void;
}

function getMonacoLanguage(language: string): string {
    const map: Record<string, string> = {
        html: 'html',
        css: 'css',
        javascript: 'javascript',
        js: 'javascript',
        typescript: 'typescript',
        ts: 'typescript',
        tsx: 'typescript',
        json: 'json',
        markdown: 'markdown',
        md: 'markdown',
    };
    return map[language] || language;
}

function inferLanguageKeyFromPath(path: string): string | null {
    const ext = path.split('.').pop()?.toLowerCase();
    if (!ext) return null;
    const map: Record<string, string> = {
        html: 'html',
        htm: 'html',
        css: 'css',
        js: 'js',
        jsx: 'jsx',
        ts: 'ts',
        tsx: 'tsx',
        json: 'json',
        md: 'md',
    };
    return map[ext] ?? null;
}

function configureMonaco(monaco: Monaco) {
    const tsApi = monaco?.languages?.typescript;
    if (!tsApi) return;

    const moduleResolutionKind =
        tsApi.ModuleResolutionKind?.Bundler
        ?? tsApi.ModuleResolutionKind?.NodeJs
        ?? undefined;

    const baseCompilerOptions = {
        allowJs: true,
        allowNonTsExtensions: true,
        esModuleInterop: true,
        jsx: tsApi.JsxEmit?.ReactJSX,
        module: tsApi.ModuleKind?.ESNext,
        moduleResolution: moduleResolutionKind,
        noEmit: true,
        resolveJsonModule: true,
        skipLibCheck: true,
        target: tsApi.ScriptTarget?.ES2022,
    };

    tsApi.typescriptDefaults.setEagerModelSync(true);
    tsApi.typescriptDefaults.setCompilerOptions(baseCompilerOptions);
    tsApi.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSuggestionDiagnostics: false,
        noSyntaxValidation: false,
    });

    tsApi.javascriptDefaults.setEagerModelSync(true);
    tsApi.javascriptDefaults.setCompilerOptions(baseCompilerOptions);
    tsApi.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSuggestionDiagnostics: false,
        noSyntaxValidation: false,
    });
}

export default function CodeEditor({ file, onContentChange }: CodeEditorProps) {
    if (!file) {
        return (
            <div className="flex items-center justify-center h-full bg-background/50 text-muted-foreground">
                <div className="text-center">
                    <div className="text-3xl mb-2">📝</div>
                    <p className="text-sm">Select a file to view its contents</p>
                </div>
            </div>
        );
    }

    const languageKey = inferLanguageKeyFromPath(file.path) ?? file.language;
    const monacoLanguage = getMonacoLanguage(languageKey);

    return (
        <div className="h-full w-full">
            <MonacoEditor
                key={file.path}
                path={file.path}
                height="100%"
                language={monacoLanguage}
                value={file.content}
                theme="vs-dark"
                beforeMount={configureMonaco}
                onChange={(value) => onContentChange?.(value || '')}
                options={{
                    readOnly: false,
                    automaticLayout: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: 'var(--font-geist-mono), monospace',
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    padding: { top: 12 },
                    renderLineHighlight: 'gutter',
                    bracketPairColorization: { enabled: true },
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                }}
            />
        </div>
    );
}

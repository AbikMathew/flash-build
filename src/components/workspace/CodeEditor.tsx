'use client';

import React from 'react';
import dynamic from 'next/dynamic';
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
        tsx: 'typescriptreact',
        json: 'json',
        markdown: 'markdown',
        md: 'markdown',
    };
    return map[language] || language;
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

    return (
        <div className="h-full w-full">
            <MonacoEditor
                height="100%"
                language={getMonacoLanguage(file.language)}
                value={file.content}
                theme="vs-dark"
                onChange={(value) => onContentChange?.(value || '')}
                options={{
                    readOnly: false,
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

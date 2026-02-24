'use client';

import React from 'react';
import {
  SandpackConsole,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  SandpackFileExplorer,
  SandpackCodeEditor,
  useErrorMessage,
} from '@codesandbox/sandpack-react';
import { PreviewRuntimePayload } from '@/types';

interface SandpackAdapterProps {
  runtime: PreviewRuntimePayload;
}

function SandpackDiagnostics() {
  const errorMessage = useErrorMessage();
  if (!errorMessage) return null;

  return (
    <div className="border-t border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
      <div className="font-medium mb-1">Preview compile/runtime error</div>
      <div className="whitespace-pre-wrap break-words">{errorMessage}</div>
    </div>
  );
}

export function SandpackAdapter({ runtime }: SandpackAdapterProps) {
  if (!runtime.sandpack) return null;

  const files = Object.entries(runtime.sandpack.files).reduce<Record<string, { code: string }>>(
    (acc, [path, code]) => {
      acc[path] = { code };
      return acc;
    },
    {},
  );

  return (
    <SandpackProvider
      template={runtime.sandpack.template}
      files={files}
      customSetup={runtime.sandpack.customSetup}
      options={{
        externalResources: runtime.sandpack.externalResources ?? [],
        autorun: true,
      }}
    >
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 text-xs border-b border-border text-muted-foreground flex justify-between items-center bg-muted/20">
          <span>Sandpack runtime: compiling React/package app</span>
        </div>
        <div className="flex-1 min-h-0">
          <SandpackLayout style={{ height: '100%', display: 'flex', flexDirection: 'row', gap: 0, borderTop: 'none' }}>
            <div className="h-full border-r border-border/50 hidden md:block" style={{ width: '200px', minWidth: '200px' }}>
              <SandpackFileExplorer style={{ height: '100%' }} />
            </div>
            <div className="flex-1 h-full flex flex-col min-w-0">
              <SandpackCodeEditor
                showTabs
                showLineNumbers
                showInlineErrors
                wrapContent
                closableTabs
                style={{ height: '50%', flex: 1 }}
              />
              <SandpackConsole
                resetOnPreviewRestart
                showHeader={true}
                style={{ height: '120px', borderTop: '1px solid var(--border)' }}
              />
            </div>
            <div className="flex-1 h-full flex flex-col border-l border-border/50 min-w-0" style={{ flex: 1.5 }}>
              <SandpackPreview
                style={{ height: '100%' }}
                showRefreshButton
                showOpenInCodeSandbox={false}
                showSandpackErrorOverlay
                showNavigator
              />
            </div>
          </SandpackLayout>
        </div>
        <SandpackDiagnostics />
      </div>
    </SandpackProvider>
  );
}

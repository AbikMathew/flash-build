'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  ExternalLink,
  RotateCcw,
  LayoutTemplate,
  Layers,
  Cloud,
  Beaker,
} from 'lucide-react';
import {
  PreviewRuntimeMode,
  ProjectFile,
  ProjectMetadata,
  ViewportSize,
} from '@/types';
import { cn } from '@/lib/utils';
import { PreviewRuntimeService } from '@/services/preview/runtime/PreviewRuntimeService';
import { SrcdocAdapter } from '@/services/preview/runtime/SrcdocAdapter';
import { SandpackAdapter } from '@/services/preview/runtime/SandpackAdapter';
import { RemoteAdapter } from '@/services/preview/runtime/RemoteAdapter';

interface PreviewPaneProps {
  html: string;
  files: ProjectFile[];
  metadata: ProjectMetadata | null;
  viewportSize: ViewportSize;
  onViewportChange: (size: ViewportSize) => void;
  onLoadTest?: () => void;
}

type RuntimeModeSelector = PreviewRuntimeMode | 'auto';
type Orientation = 'portrait' | 'landscape';

function viewportFrame(viewport: ViewportSize, orientation: Orientation): { width: string; height: string } {
  if (viewport === 'desktop') {
    return { width: '100%', height: '100%' };
  }
  if (viewport === 'tablet') {
    return orientation === 'portrait'
      ? { width: '768px', height: '1024px' }
      : { width: '1024px', height: '768px' };
  }
  return orientation === 'portrait'
    ? { width: '375px', height: '812px' }
    : { width: '812px', height: '375px' };
}

export default function PreviewPane({
  html,
  files,
  metadata,
  viewportSize,
  onViewportChange,
  onLoadTest,
}: PreviewPaneProps) {
  const [runtimeSelection, setRuntimeSelection] = useState<RuntimeModeSelector>('auto');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [refreshKey, setRefreshKey] = useState(0);
  const [runtimeWarnings, setRuntimeWarnings] = useState<string[]>([]);

  const { runtime, hint } = useMemo(
    () => PreviewRuntimeService.resolve(files, metadata, html, runtimeSelection),
    [files, metadata, html, runtimeSelection],
  );
  const frame = viewportFrame(viewportSize, orientation);

  const combinedWarnings = useMemo(() => {
    const warnings = [
      ...(metadata?.responsiveReport?.warnings ?? []),
      ...(runtime.warnings ?? []),
      ...runtimeWarnings,
    ];
    return [...new Set(warnings.filter(Boolean))];
  }, [metadata?.responsiveReport?.warnings, runtime.warnings, runtimeWarnings]);

  const handleOpenExternal = () => {
    if (runtime.mode === 'srcdoc' && runtime.srcdocHtml) {
      const blob = new Blob([runtime.srcdocHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      return;
    }
    if (runtime.mode === 'remote' && runtime.remote?.previewUrl) {
      window.open(runtime.remote.previewUrl, '_blank');
    }
  };

  if (files.length === 0 && !html) {
    return (
      <div className="flex items-center justify-center h-full bg-background/30">
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-3">🖥️</div>
          <p className="text-sm font-medium">Live Preview</p>
          <p className="text-xs mt-1 mb-4">Generate an app to see the preview</p>
          {onLoadTest && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadTest}
              className="gap-2"
            >
              <Beaker className="w-3.5 h-3.5" />
              Load Test Template
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/80">
        <div className="flex items-center gap-1">
          {([
            { size: 'desktop' as const, icon: Monitor, label: 'Desktop' },
            { size: 'tablet' as const, icon: Tablet, label: 'Tablet' },
            { size: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
          ]).map(({ size, icon: Icon, label }) => (
            <Button
              key={size}
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 w-7 p-0',
                viewportSize === size && 'bg-accent text-accent-foreground',
              )}
              onClick={() => onViewportChange(size)}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
            </Button>
          ))}

          {viewportSize !== 'desktop' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'))}
              title="Toggle orientation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {([
            { mode: 'auto' as const, icon: LayoutTemplate, label: 'Auto' },
            { mode: 'srcdoc' as const, icon: Layers, label: 'Srcdoc' },
            { mode: 'sandpack' as const, icon: Layers, label: 'Sandpack' },
            { mode: 'remote' as const, icon: Cloud, label: 'Remote' },
          ]).map(({ mode, icon: Icon, label }) => (
            <Button
              key={mode}
              variant={runtimeSelection === mode ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-[10px] gap-1"
              onClick={() => setRuntimeSelection(mode)}
              title={label}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden md:inline">{label}</span>
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            title="Refresh"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleOpenExternal}
            title="Open in new tab"
            disabled={runtime.mode === 'sandpack'}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] text-amber-500 gap-1"
            onClick={onLoadTest}
            title="Load Test Template"
          >
            <Beaker className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Test</span>
          </Button>
        </div>
      </div>

      <div className="px-3 py-1 border-b border-border text-[11px] text-muted-foreground bg-card/50">
        Runtime: <span className="text-foreground font-medium">{runtime.mode}</span> · {hint.reason}
      </div>

      {combinedWarnings.length > 0 && (
        <div className="px-3 py-2 border-b border-border bg-amber-500/10 text-[11px] text-amber-200 space-y-1">
          {combinedWarnings.map((warning, index) => (
            <div key={index}>• {warning}</div>
          ))}
        </div>
      )}

      <div className="flex-1 flex items-start justify-center overflow-auto bg-[#1a1a2e] p-4">
        <div
          className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
          style={{
            width: frame.width,
            maxWidth: '100%',
            height: viewportSize === 'desktop' ? '100%' : frame.height,
            maxHeight: '100%',
          }}
          key={`${runtime.mode}-${refreshKey}-${viewportSize}-${orientation}`}
        >
          {runtime.mode === 'srcdoc' && runtime.srcdocHtml && (
            <SrcdocAdapter
              html={runtime.srcdocHtml}
              onResponsiveWarnings={setRuntimeWarnings}
            />
          )}
          {runtime.mode === 'sandpack' && <SandpackAdapter runtime={runtime} />}
          {runtime.mode === 'remote' && (
            <RemoteAdapter
              files={files}
              packageManifest={metadata?.packageManifest}
            />
          )}
        </div>
      </div>
    </div>
  );
}


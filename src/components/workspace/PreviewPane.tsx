'use client';

import React, { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Monitor, Tablet, Smartphone, RotateCw, ExternalLink } from 'lucide-react';
import { ViewportSize } from '@/types';
import { cn } from '@/lib/utils';

interface PreviewPaneProps {
    html: string;
    viewportSize: ViewportSize;
    onViewportChange: (size: ViewportSize) => void;
}

const viewportWidths: Record<ViewportSize, string> = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
};

export default function PreviewPane({ html, viewportSize, onViewportChange }: PreviewPaneProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (iframeRef.current && html) {
            iframeRef.current.srcdoc = html;
        }
    }, [html]);

    const handleRefresh = () => {
        if (iframeRef.current) {
            iframeRef.current.srcdoc = '';
            setTimeout(() => {
                if (iframeRef.current) iframeRef.current.srcdoc = html;
            }, 50);
        }
    };

    const handleOpenExternal = () => {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    if (!html) {
        return (
            <div className="flex items-center justify-center h-full bg-background/30">
                <div className="text-center text-muted-foreground">
                    <div className="text-4xl mb-3">🖥️</div>
                    <p className="text-sm font-medium">Live Preview</p>
                    <p className="text-xs mt-1">Generate an app to see the preview</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
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
                                viewportSize === size && 'bg-accent text-accent-foreground'
                            )}
                            onClick={() => onViewportChange(size)}
                            title={label}
                        >
                            <Icon className="w-3.5 h-3.5" />
                        </Button>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleRefresh} title="Refresh">
                        <RotateCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleOpenExternal} title="Open in new tab">
                        <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 flex items-start justify-center overflow-auto bg-[#1a1a2e] p-4">
                <div
                    className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
                    style={{
                        width: viewportWidths[viewportSize],
                        maxWidth: '100%',
                        height: viewportSize === 'desktop' ? '100%' : '85%',
                    }}
                >
                    <iframe
                        ref={iframeRef}
                        title="App Preview"
                        className="w-full h-full border-0"
                        sandbox="allow-scripts allow-popups allow-forms allow-modals"
                    />
                </div>
            </div>
        </div>
    );
}

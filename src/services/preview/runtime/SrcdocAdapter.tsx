'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface SrcdocAdapterProps {
  html: string;
  className?: string;
  onResponsiveWarnings?: (warnings: string[]) => void;
}

function computeWarnings(iframe: HTMLIFrameElement): string[] {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return ['Preview runtime: unable to inspect document for responsive checks.'];

    const root = doc.documentElement;
    const body = doc.body;
    const warnings: string[] = [];
    if (root.scrollWidth > root.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1) {
      warnings.push('Horizontal overflow detected in current viewport.');
    }
    return warnings;
  } catch {
    return ['Preview runtime: responsive checks unavailable due sandbox restrictions.'];
  }
}

export function SrcdocAdapter({ html, className, onResponsiveWarnings }: SrcdocAdapterProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = html;
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="App Preview"
      className={cn('w-full h-full border-0', className)}
      sandbox="allow-scripts allow-popups allow-forms allow-modals allow-same-origin"
      onLoad={() => {
        const iframe = iframeRef.current;
        if (!iframe || !onResponsiveWarnings) return;
        onResponsiveWarnings(computeWarnings(iframe));
      }}
    />
  );
}


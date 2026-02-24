'use client';

import React, { useState } from 'react';
import { ExternalLink, PlayCircle, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PackageManifest, ProjectFile } from '@/types';
import { RemoteRunnerService, RemoteSession } from '@/services/runtime/RemoteRunnerService';

interface RemoteAdapterProps {
  files: ProjectFile[];
  packageManifest?: PackageManifest;
}

export function RemoteAdapter({ files, packageManifest }: RemoteAdapterProps) {
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const isNotConfigured = Boolean(
    session?.error && /not configured/i.test(session.error),
  );

  const startSession = async () => {
    setIsStarting(true);
    try {
      const next = await RemoteRunnerService.createSession({ files, packageManifest });
      setSession(next);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">
        Remote runtime fallback (E2B-first)
      </div>
      <div className="p-4 space-y-3">
        <div className="text-sm text-muted-foreground">
          Use remote runtime for complex apps that exceed local Sandpack limits.
        </div>
        <Button
          size="sm"
          onClick={startSession}
          disabled={isStarting}
          className="gap-2"
        >
          <PlayCircle className="w-4 h-4" />
          {isStarting ? 'Starting Remote Session...' : 'Start Remote Session'}
        </Button>

        {session?.previewUrl && (
          <a
            href={session.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
          >
            Open Remote Preview
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {session && (
          <div className="rounded-md border border-border bg-background/50 p-3">
            <div className="text-xs mb-2 flex items-center gap-1.5 text-muted-foreground">
              <Terminal className="w-3.5 h-3.5" />
              Remote logs
            </div>
            <div className="space-y-1 text-xs text-foreground/80 max-h-48 overflow-auto">
              {session.logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
              {session.error && (
                <div className="text-red-400">{session.error}</div>
              )}
            </div>
          </div>
        )}

        {isNotConfigured && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
            <div className="font-medium text-amber-100">Remote setup required</div>
            <div>1. Add <code>E2B_API_KEY=...</code> in your <code>.env.local</code>.</div>
            <div>2. Restart <code>npm run dev</code>.</div>
            <div>3. Implement sandbox create/upload/start flow in <code>src/app/api/runtime/session/route.ts</code>.</div>
          </div>
        )}
      </div>
    </div>
  );
}

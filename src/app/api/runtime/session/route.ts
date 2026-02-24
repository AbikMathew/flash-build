import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { PackageManifest, ProjectFile } from '@/types';

interface RemoteSessionResponse {
  sessionId: string;
  status: 'starting' | 'running' | 'error';
  previewUrl?: string;
  logs: string[];
  error?: string;
}

function extractPreviewHint(files: ProjectFile[], manifest?: PackageManifest): string {
  const depCount = manifest ? Object.keys(manifest.dependencies).length : 0;
  const fileCount = files.length;
  return `Prepared ${fileCount} files with ${depCount} dependencies for remote execution.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      files?: ProjectFile[];
      packageManifest?: PackageManifest;
    };
    if (!Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json({ error: 'files are required' }, { status: 400 });
    }

    const sessionId = `remote-${randomUUID()}`;
    const logs = [extractPreviewHint(body.files, body.packageManifest)];

    // E2B-first integration point. Wire this to your remote executor or E2B SDK later.
    if (!process.env.E2B_API_KEY) {
      const response: RemoteSessionResponse = {
        sessionId,
        status: 'error',
        logs: [
          ...logs,
          'Remote runtime not configured. Add E2B_API_KEY and remote executor wiring.',
        ],
        error: 'Remote runtime is not configured.',
      };
      return NextResponse.json(response, { status: 501 });
    }

    const response: RemoteSessionResponse = {
      sessionId,
      status: 'starting',
      logs: [
        ...logs,
        'E2B key detected. Implement sandbox creation/upload/start flow to return preview URL.',
      ],
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown remote runtime error' },
      { status: 500 },
    );
  }
}


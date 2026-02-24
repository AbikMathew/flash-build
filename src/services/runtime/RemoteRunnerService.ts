import { PackageManifest, ProjectFile } from '@/types';

export interface RemoteSession {
  sessionId: string;
  status: 'starting' | 'running' | 'error';
  previewUrl?: string;
  logs: string[];
  error?: string;
}

export interface CreateRemoteSessionRequest {
  files: ProjectFile[];
  packageManifest?: PackageManifest;
}

export class RemoteRunnerService {
  static async createSession(payload: CreateRemoteSessionRequest): Promise<RemoteSession> {
    const response = await fetch('/api/runtime/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as RemoteSession & { error?: string };
    if (!response.ok) {
      return {
        sessionId: 'unavailable',
        status: 'error',
        logs: body.logs ?? [],
        error: body.error || 'Remote runner unavailable',
      };
    }
    return body;
  }
}


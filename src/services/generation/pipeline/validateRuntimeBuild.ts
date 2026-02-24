import os from 'node:os';
import path from 'node:path';
import { rm, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { OutputStack } from '@/types';
import { GeneratedFile } from './generateProject';

type ValidationPhase = 'skipped' | 'install' | 'build' | 'test';

export interface RuntimeBuildValidationResult {
  passed: boolean;
  phase: ValidationPhase;
  issues: string[];
  logs: string[];
  durationMs: number;
}

interface ValidateRuntimeBuildParams {
  files: GeneratedFile[];
  outputStack: OutputStack;
  timeoutMs?: number;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const MAX_OUTPUT_CHARS = 30_000;
const DEFAULT_TIMEOUT_MS = 120_000;

function normalizePath(filePath: string): string | null {
  const normalized = path.posix.normalize(filePath.replace(/\\/g, '/'));
  if (normalized.startsWith('../') || normalized.startsWith('/')) return null;
  return normalized;
}

function appendLimited(current: string, next: string): string {
  const merged = current + next;
  if (merged.length <= MAX_OUTPUT_CHARS) return merged;
  return merged.slice(merged.length - MAX_OUTPUT_CHARS);
}

function runCommand(command: string, args: string[], cwd: string, timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        CI: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2_000);
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendLimited(stdout, chunk.toString('utf-8'));
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendLimited(stderr, chunk.toString('utf-8'));
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        code: 1,
        stdout,
        stderr: appendLimited(stderr, `\n${error.message}`),
        timedOut,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

function summarizeFailure(stage: ValidationPhase, output: string, timedOut: boolean): string[] {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const interesting = lines
    .filter((line) => /(error|failed|cannot|missing|unexpected|syntax|resolve|invalid)/i.test(line))
    .slice(0, 12);

  const selected = interesting.length > 0 ? interesting : lines.slice(-12);
  const header = timedOut
    ? `Runtime ${stage} timed out.`
    : `Runtime ${stage} command failed.`;

  return [header, ...selected].slice(0, 12);
}

function shouldRunRuntimeValidation(outputStack: OutputStack): boolean {
  if (outputStack !== 'react-tailwind') return false;
  if (process.env.FLASHBUILD_RUNTIME_VALIDATION === 'off') return false;
  if (process.env.VERCEL === '1' && process.env.FLASHBUILD_RUNTIME_VALIDATION !== 'force') {
    return false;
  }
  return true;
}

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

export async function validateRuntimeBuild(
  params: ValidateRuntimeBuildParams,
): Promise<RuntimeBuildValidationResult> {
  const start = Date.now();

  if (!shouldRunRuntimeValidation(params.outputStack)) {
    return {
      passed: true,
      phase: 'skipped',
      issues: ['Runtime build validation skipped by environment.'],
      logs: [],
      durationMs: Date.now() - start,
    };
  }

  const packageJson = params.files.find((file) => file.path === 'package.json');
  if (!packageJson) {
    return {
      passed: false,
      phase: 'install',
      issues: ['Missing package.json for runtime build validation.'],
      logs: [],
      durationMs: Date.now() - start,
    };
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'flashbuild-runtime-'));

  try {
    for (const file of params.files) {
      const safePath = normalizePath(file.path);
      if (!safePath) continue;
      const absolutePath = path.join(tempRoot, safePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.content, 'utf-8');
    }

    const npm = npmCommand();
    const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const logs: string[] = [];

    const install = await runCommand(
      npm,
      ['install', '--no-audit', '--no-fund', '--prefer-offline'],
      tempRoot,
      timeoutMs,
    );
    logs.push(`[install]\n${[install.stdout, install.stderr].filter(Boolean).join('\n').trim()}`);
    if (install.code !== 0) {
      return {
        passed: false,
        phase: 'install',
        issues: summarizeFailure('install', `${install.stdout}\n${install.stderr}`, install.timedOut),
        logs,
        durationMs: Date.now() - start,
      };
    }

    const parsedPackage = JSON.parse(packageJson.content) as {
      scripts?: Record<string, string>;
    };

    const hasBuild = Boolean(parsedPackage.scripts?.build);
    if (hasBuild) {
      const build = await runCommand(npm, ['run', 'build'], tempRoot, timeoutMs);
      logs.push(`[build]\n${[build.stdout, build.stderr].filter(Boolean).join('\n').trim()}`);
      if (build.code !== 0) {
        return {
          passed: false,
          phase: 'build',
          issues: summarizeFailure('build', `${build.stdout}\n${build.stderr}`, build.timedOut),
          logs,
          durationMs: Date.now() - start,
        };
      }
    }

    const shouldRunTests = process.env.FLASHBUILD_RUNTIME_TESTS === '1';
    if (shouldRunTests && parsedPackage.scripts?.test) {
      const test = await runCommand(npm, ['run', 'test'], tempRoot, timeoutMs);
      logs.push(`[test]\n${[test.stdout, test.stderr].filter(Boolean).join('\n').trim()}`);
      if (test.code !== 0) {
        return {
          passed: false,
          phase: 'test',
          issues: summarizeFailure('test', `${test.stdout}\n${test.stderr}`, test.timedOut),
          logs,
          durationMs: Date.now() - start,
        };
      }
    }

    return {
      passed: true,
      phase: hasBuild ? 'build' : 'install',
      issues: [],
      logs,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      passed: false,
      phase: 'build',
      issues: [
        `Runtime validator crashed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      logs: [],
      durationMs: Date.now() - start,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

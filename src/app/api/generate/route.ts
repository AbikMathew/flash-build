import { NextRequest, NextResponse } from 'next/server';
import {
  AIProvider,
  DesignSpec,
  ExportMode,
  GenerateAPIRequest,
  GenerationConstraints,
  OutputStack,
  PreviewRuntimeMode,
  QualityReport,
  QualityMode,
  RuntimeHint,
  ResponsiveReport,
  PackageManifest,
} from '@/types';
import { DEFAULT_MODELS, getProviderLabel } from '@/services/generation/pipeline/aiClient';
import { extractDesignSpec } from '@/services/generation/pipeline/extractDesignSpec';
import { generateProject, GeneratedFile } from '@/services/generation/pipeline/generateProject';
import { ingestReferences } from '@/services/generation/pipeline/ingestReferences';
import { validateOutput } from '@/services/generation/pipeline/validateOutput';
import { validateRuntimeBuild } from '@/services/generation/pipeline/validateRuntimeBuild';
import { enforcePackagePolicy } from '@/services/generation/pipeline/packagePolicy';

interface NormalizedRequest extends GenerateAPIRequest {
  outputStack: OutputStack;
  qualityMode: QualityMode;
  constraints: GenerationConstraints;
  previewRuntimePreference: PreviewRuntimeMode | 'auto';
  exportMode: ExportMode;
}

function isProvider(value: string): value is AIProvider {
  return value === 'anthropic' || value === 'openai';
}

function normalizeRequest(body: GenerateAPIRequest): NormalizedRequest {
  return {
    ...body,
    outputStack: body.outputStack ?? 'react-tailwind',
    qualityMode: body.qualityMode ?? 'strict_visual',
    constraints: {
      maxRetries: Math.max(0, Math.min(2, body.constraints?.maxRetries ?? 1)),
      maxCostUsd: Math.max(0.05, body.constraints?.maxCostUsd ?? 0.25),
    },
    previewRuntimePreference: body.previewRuntimePreference ?? 'auto',
    exportMode: body.exportMode ?? 'full-project',
  };
}

function detectProjectName(spec: DesignSpec | null, prompt: string, files: GeneratedFile[]): string {
  if (spec?.appName) return spec.appName;
  const indexFile = files.find((file) => file.path === 'index.html');
  if (indexFile) {
    const titleMatch = indexFile.content.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) return titleMatch[1];
  }
  return prompt.trim().split(/\s+/).slice(0, 4).join(' ') || 'Generated App';
}

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function cloneFiles(files: GeneratedFile[]): GeneratedFile[] {
  return files.map((file) => ({ ...file }));
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergePatchInstructions(existing: string | undefined, runtimeIssues: string[]): string | undefined {
  const runtimeBlock = runtimeIssues.length > 0
    ? `Fix runtime execution failures:\n${runtimeIssues.map((issue) => `- ${issue}`).join('\n')}`
    : '';
  return [existing?.trim() || '', runtimeBlock].filter(Boolean).join('\n\n') || undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateAPIRequest;

    if (!body.config?.apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }
    if (!isProvider(body.config.provider)) {
      return NextResponse.json({ error: 'Unsupported AI provider' }, { status: 400 });
    }

    const hasPrompt = Boolean(body.prompt?.trim());
    const hasImages = Array.isArray(body.images) && body.images.length > 0;
    const hasUrls = Array.isArray(body.urls) && body.urls.length > 0;
    if (!hasPrompt && !hasImages && !hasUrls) {
      return NextResponse.json(
        { error: 'Provide at least one input source: prompt, image, or URL.' },
        { status: 400 }
      );
    }

    const normalized = normalizeRequest(body);
    const selectedModel = normalized.config.model || DEFAULT_MODELS[normalized.config.provider];
    const providerLabel = getProviderLabel(normalized.config.provider);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (chunk: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
        };

        let totalEstimatedCost = 0;
        let files: GeneratedFile[] = [];
        let spec: DesignSpec | null = null;
        let runtimeHint: RuntimeHint | undefined;
        let packageManifest: PackageManifest | undefined;
        let responsiveReport: ResponsiveReport | undefined;
        const policyNotes: string[] = [];
        let lastRuntimeStable: {
          files: GeneratedFile[];
          runtimeHint?: RuntimeHint;
          packageManifest?: PackageManifest;
          responsiveReport?: ResponsiveReport;
          report: QualityReport;
        } | null = null;

        const addCost = (value: number) => {
          totalEstimatedCost = Number((totalEstimatedCost + value).toFixed(4));
          if (totalEstimatedCost > normalized.constraints.maxCostUsd) {
            throw new Error(
              `Generation stopped: estimated cost $${totalEstimatedCost.toFixed(2)} exceeded cap $${normalized.constraints.maxCostUsd.toFixed(2)}`
            );
          }
        };

        try {
          send({
            type: 'event',
            event: {
              type: 'ingesting',
              message: 'Ingesting references and extracting design signals...',
              progress: 5,
              timestamp: new Date(),
            },
          });

          const references = await ingestReferences(normalized);
          const warningText = references.warnings.length > 0
            ? ` (${references.warnings.length} warning${references.warnings.length > 1 ? 's' : ''})`
            : '';
          send({
            type: 'event',
            event: {
              type: 'ingesting',
              message: `Reference confidence ${Math.round(references.referenceConfidence * 100)}%${warningText}`,
              progress: 15,
              timestamp: new Date(),
            },
          });

          send({
            type: 'event',
            event: {
              type: 'planning',
              message: `Extracting design spec with ${providerLabel}...`,
              progress: 22,
              timestamp: new Date(),
            },
          });

          const designSpec = await extractDesignSpec({
            provider: normalized.config.provider,
            apiKey: normalized.config.apiKey,
            model: selectedModel,
            outputStack: normalized.outputStack,
            qualityMode: normalized.qualityMode,
            references,
          });
          spec = designSpec.spec;
          addCost(designSpec.usage.estimatedCostUsd);

          send({
            type: 'event',
            event: {
              type: 'planning',
              message: `Spec ready: ${spec.appName} with ${spec.filePlan.length} planned files`,
              progress: 35,
              timestamp: new Date(),
            },
          });

          send({
            type: 'event',
            event: {
              type: 'coding',
              message: 'Generating project files...',
              progress: 45,
              timestamp: new Date(),
            },
          });

          const generated = await generateProject({
            provider: normalized.config.provider,
            apiKey: normalized.config.apiKey,
            model: selectedModel,
            spec,
            outputStack: normalized.outputStack,
            references,
          });
          const policy = enforcePackagePolicy(generated.files, normalized.outputStack);
          files = policy.files;
          runtimeHint = policy.runtimeHint;
          packageManifest = policy.manifest;
          responsiveReport = policy.responsiveReport;
          policyNotes.push(...policy.notes);
          addCost(generated.usage.estimatedCostUsd);

          send({
            type: 'event',
            event: {
              type: 'compiling',
              message: `Resolved runtime: ${runtimeHint.preferredRuntime} (complexity ${runtimeHint.complexityScore})`,
              progress: 60,
              timestamp: new Date(),
            },
          });
          if (runtimeHint.preferredRuntime === 'remote') {
            send({
              type: 'event',
              event: {
                type: 'runtime_fallback',
                message: 'High complexity app detected. Remote runtime fallback is recommended.',
                progress: 64,
                timestamp: new Date(),
              },
            });
          }

          send({
            type: 'event',
            event: {
              type: 'validating',
              message: 'Running quality gates (visual + functional)...',
              progress: 68,
              timestamp: new Date(),
            },
          });

          let validation = await validateOutput({
            provider: normalized.config.provider,
            apiKey: normalized.config.apiKey,
            model: selectedModel,
            spec,
            outputStack: normalized.outputStack,
            qualityMode: normalized.qualityMode,
            references,
            files,
          });
          addCost(validation.usage.estimatedCostUsd);

          send({
            type: 'event',
            event: {
              type: 'compiling',
              message: 'Running runtime build validation...',
              progress: 72,
              timestamp: new Date(),
            },
          });
          const runtimeValidation = await validateRuntimeBuild({
            files,
            outputStack: normalized.outputStack,
          });
          if (!runtimeValidation.passed) {
            validation.report.accepted = false;
            validation.report.retryRecommended = true;
            validation.report.issues = uniqStrings([
              ...validation.report.issues,
              ...runtimeValidation.issues,
            ]);
            validation.report.patchInstructions = mergePatchInstructions(
              validation.report.patchInstructions,
              runtimeValidation.issues,
            );
            send({
              type: 'event',
              event: {
                type: 'compiling',
                message: `Runtime ${runtimeValidation.phase} failed. Preparing repair instructions...`,
                progress: 74,
                timestamp: new Date(),
              },
            });
          } else if (runtimeValidation.phase !== 'skipped') {
            send({
              type: 'event',
              event: {
                type: 'compiling',
                message: `Runtime build check passed in ${(runtimeValidation.durationMs / 1000).toFixed(1)}s`,
                progress: 74,
                timestamp: new Date(),
              },
            });
          } else if (runtimeValidation.issues.length > 0) {
            policyNotes.push(...runtimeValidation.issues);
          }
          if (runtimeValidation.passed) {
            lastRuntimeStable = {
              files: cloneFiles(files),
              runtimeHint,
              packageManifest,
              responsiveReport,
              report: cloneJson(validation.report),
            };
          }

          let retries = 0;
          while (
            !validation.report.accepted
            && validation.report.retryRecommended
            && retries < normalized.constraints.maxRetries
          ) {
            retries += 1;
            send({
              type: 'event',
              event: {
                type: 'reviewing',
                message: `Quality gate failed (visual ${validation.report.visualScore}%). Applying targeted repair ${retries}/${normalized.constraints.maxRetries}...`,
                progress: 76,
                timestamp: new Date(),
              },
            });

            const repaired = await generateProject({
              provider: normalized.config.provider,
              apiKey: normalized.config.apiKey,
              model: selectedModel,
              spec,
              outputStack: normalized.outputStack,
              references,
              repairInstructions: validation.report.patchInstructions || validation.report.issues.join('\n'),
              existingFiles: files,
            });
            const policy = enforcePackagePolicy(repaired.files, normalized.outputStack);
            files = policy.files;
            runtimeHint = policy.runtimeHint;
            packageManifest = policy.manifest;
            responsiveReport = policy.responsiveReport;
            policyNotes.push(...policy.notes);
            addCost(repaired.usage.estimatedCostUsd);

            validation = await validateOutput({
              provider: normalized.config.provider,
              apiKey: normalized.config.apiKey,
              model: selectedModel,
              spec,
              outputStack: normalized.outputStack,
              qualityMode: normalized.qualityMode,
              references,
              files,
            });
            addCost(validation.usage.estimatedCostUsd);

            send({
              type: 'event',
              event: {
                type: 'compiling',
                message: 'Re-running runtime build validation...',
                progress: 82,
                timestamp: new Date(),
              },
            });
            const repairedRuntimeValidation = await validateRuntimeBuild({
              files,
              outputStack: normalized.outputStack,
            });
            if (!repairedRuntimeValidation.passed) {
              send({
                type: 'event',
                event: {
                  type: 'compiling',
                  message: `Runtime ${repairedRuntimeValidation.phase} still failing after repair.`,
                  progress: 83,
                  timestamp: new Date(),
                },
              });
              validation.report.accepted = false;
              validation.report.retryRecommended = true;
              validation.report.issues = uniqStrings([
                ...validation.report.issues,
                ...repairedRuntimeValidation.issues,
              ]);
              validation.report.patchInstructions = mergePatchInstructions(
                validation.report.patchInstructions,
                repairedRuntimeValidation.issues,
              );
              if (lastRuntimeStable) {
                files = cloneFiles(lastRuntimeStable.files);
                runtimeHint = lastRuntimeStable.runtimeHint;
                packageManifest = lastRuntimeStable.packageManifest;
                responsiveReport = lastRuntimeStable.responsiveReport;
                validation.report = cloneJson(lastRuntimeStable.report);
                validation.report.retryRecommended = false;
                send({
                  type: 'event',
                  event: {
                    type: 'compiling',
                    message: 'Repair degraded runtime stability; reverted to last compile-passing output.',
                    progress: 84,
                    timestamp: new Date(),
                  },
                });
                break;
              }
            } else if (repairedRuntimeValidation.phase !== 'skipped') {
              send({
                type: 'event',
                event: {
                  type: 'compiling',
                  message: `Runtime build check passed after repair in ${(repairedRuntimeValidation.durationMs / 1000).toFixed(1)}s`,
                  progress: 83,
                  timestamp: new Date(),
                },
              });
              lastRuntimeStable = {
                files: cloneFiles(files),
                runtimeHint,
                packageManifest,
                responsiveReport,
                report: cloneJson(validation.report),
              };
            } else if (repairedRuntimeValidation.phase === 'skipped' && repairedRuntimeValidation.issues.length > 0) {
              policyNotes.push(...repairedRuntimeValidation.issues);
            }
          }

          if (validation.report.responsiveWarnings && validation.report.responsiveWarnings.length > 0) {
            send({
              type: 'event',
              event: {
                type: 'responsive_check',
                message: `Responsive warnings: ${validation.report.responsiveWarnings.length}`,
                progress: 84,
                timestamp: new Date(),
              },
            });
            responsiveReport = {
              passed: false,
              warnings: validation.report.responsiveWarnings,
              checkedViewports: [375, 768, 1280],
            };
          }

          if (normalized.previewRuntimePreference !== 'auto' && runtimeHint) {
            runtimeHint = {
              ...runtimeHint,
              preferredRuntime: normalized.previewRuntimePreference,
              reason: `Runtime overridden by request preference: ${normalized.previewRuntimePreference}`,
            };
          }

          send({
            type: 'event',
            event: {
              type: 'validating',
              message: validation.report.accepted
                ? `Quality passed: visual ${validation.report.visualScore}%`
                : `Best effort result: visual ${validation.report.visualScore}%`,
              progress: 85,
              timestamp: new Date(),
            },
          });

          for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            send({
              type: 'event',
              event: {
                type: 'coding',
                message: `Created ${file.path}`,
                progress: 86 + Math.round(((i + 1) / files.length) * 9),
                timestamp: new Date(),
              },
            });
            send({ type: 'file', file });
          }

          send({
            type: 'metadata',
            metadata: {
              name: detectProjectName(spec, normalized.prompt, files),
              description: normalized.prompt || spec.description,
              framework: normalized.outputStack === 'react-tailwind'
                ? 'React + Tailwind'
                : 'Vanilla HTML/CSS/JS',
              createdAt: new Date(),
              runtimeHint,
              packageManifest,
              responsiveReport: responsiveReport || {
                passed: true,
                warnings: [],
                checkedViewports: [375, 768, 1280],
              },
            },
          });

          const uniquePolicyNotes = [...new Set(policyNotes.map((note) => note.trim()).filter(Boolean))];
          if (uniquePolicyNotes.length > 0) {
            send({
              type: 'event',
              event: {
                type: 'reviewing',
                message: uniquePolicyNotes.join(' '),
                progress: 96,
                timestamp: new Date(),
              },
            });
          }

          send({
            type: 'event',
            event: {
              type: 'complete',
              message: `Generation complete (estimated cost: $${totalEstimatedCost.toFixed(2)})`,
              progress: 100,
              timestamp: new Date(),
            },
          });
          send({ type: 'done' });
        } catch (error) {
          send({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown generation error',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

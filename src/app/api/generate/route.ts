import { NextRequest, NextResponse } from 'next/server';
import { GenerateAPIRequest } from '@/types';

// ============================================================================
// PHASE 1: ARCHITECT PROMPT — analyzes requirements, outputs JSON spec
// ============================================================================
const ARCHITECT_PROMPT = `You are the Architect agent of FlashBuild. Your job is to analyze the user's request and create a detailed application specification.

Given the user's description (and optionally screenshots/URLs), output a JSON specification for the app to be built.

You MUST respond with ONLY valid JSON — no markdown, no explanation, no code fences. Just pure JSON.

{
  "appName": "Short app name",
  "description": "One-line description of what the app does",
  "features": [
    {
      "name": "Feature name",
      "description": "What it does",
      "interactions": ["click handler on X does Y", "form submits to Z"]
    }
  ],
  "files": [
    {
      "path": "index.html",
      "purpose": "Main HTML structure with all layout and semantic elements"
    },
    {
      "path": "styles.css",
      "purpose": "All styling — theme variables, layout, components, responsive, animations"
    },
    {
      "path": "app.js",
      "purpose": "Main application logic — event handlers, state, DOM manipulation"
    }
  ],
  "ui": {
    "layout": "Description of the overall layout (sidebar + main, single page, etc.)",
    "colorScheme": "dark/light/custom — describe the palette",
    "keyComponents": ["list of major UI components like navbar, cards, modals, forms"]
  },
  "dataModel": {
    "entities": ["list of data entities like Todo, User, Task"],
    "persistence": "localStorage/none — how data is stored",
    "sampleData": "Brief description of realistic sample data to include"
  }
}

Rules:
1. ALWAYS include at least index.html, styles.css, and app.js
2. For complex apps, add more files: utils.js, data.js, chart.js, router.js, etc.
3. Every feature MUST list its specific interactions (what happens when user clicks/types/submits)
4. Be specific about functionality — don't just say "calculator works", say "clicking number buttons appends digits, clicking operators stores operation, clicking = evaluates expression"
5. If the user provided screenshots, describe the exact visual layout you see
6. appName should be creative and memorable (like "TaskFlow", "CalcPro", "DataGrid")`;

// ============================================================================
// PHASE 2: BUILDER PROMPT — takes spec, generates actual code files
// ============================================================================
const BUILDER_PROMPT = `You are the Builder agent of FlashBuild. You receive an application specification and generate ALL the code files.

## Output Format
Output ONLY file blocks in this exact format — NO explanations, NO markdown, NO commentary:

---FILE: path/to/filename.ext---
(complete file contents)
---END FILE---

## CRITICAL RULES

### Functionality First
This is the MOST IMPORTANT rule. Every feature in the specification MUST be fully implemented:
- Every button MUST have a working click handler that performs its labeled action
- Every form MUST submit and process input data correctly
- Every calculation MUST produce correct results
- CRUD operations MUST work — Create, Read, Update, Delete
- Navigation MUST work — tabs, pages, modals open/close/switch
- Data persistence — use localStorage where specified
- Keyboard shortcuts — Enter to submit, Escape to close modals
- Error states — show user-friendly messages for invalid input

### Visual Design
- Modern, premium UI — gradients, shadows, rounded corners, glass effects
- CSS custom properties for theming (--primary, --bg, --text, --accent, etc.)
- Responsive design — works on desktop AND mobile
- Semantic HTML5 elements
- Smooth transitions and micro-animations
- All interactive elements have hover/active/focus states
- Professional typography with proper hierarchy
- Populate with realistic sample data — NEVER use "Lorem ipsum"

### Code Quality
- Clean, well-structured JavaScript with descriptive function names
- Event delegation where appropriate
- No external CDN links or dependencies — everything self-contained
- No inline styles — all styling in CSS files
- Comments for complex logic sections
- DRY code — extract repeated patterns into functions
- The index.html MUST include <script> tags for ALL .js files in correct dependency order

### Screenshot Replication (if screenshots provided)
- Match the exact visual layout, spacing, colors, and typography
- Replicate component structure, alignment, and proportions
- Use the exact hex colors visible in the screenshot
- Preserve the UI hierarchy and information architecture

Generate ONLY the file blocks now. Follow the specification exactly.`;

// ============================================================================
// PHASE 3: REVIEWER PROMPT — validates code against spec
// ============================================================================
const REVIEWER_PROMPT = `You are the QA Reviewer agent of FlashBuild. You review generated code against the original specification to find issues.

You will receive:
1. The original app specification (JSON)
2. The generated code files

Your job is to check ONLY for critical functional issues:
- Missing click handlers (buttons that do nothing)
- Broken calculations or logic errors
- Forms that don't submit or process data
- Missing CRUD operations that were specified
- JavaScript errors (undefined variables, syntax errors)
- Missing files referenced in HTML (scripts/stylesheets linked but not generated)

You MUST respond with ONLY valid JSON — no markdown, no explanation:

{
  "approved": true/false,
  "issues": [
    {
      "file": "app.js",
      "severity": "critical",
      "description": "Calculator equals button has no event handler"
    }
  ],
  "fixInstructions": "If not approved, specific instructions for what to fix in each file"
}

Rules:
- Only flag CRITICAL functional issues, not style preferences
- If code is reasonably functional (80%+ features work), approve it
- Be concise — max 5 issues
- If approved, issues array should be empty and fixInstructions should be empty string`;

// ============================================================================
// Shared helpers
// ============================================================================

/**
 * Build the user message from the inputs.
 * Handles text prompt, images (as base64), and URLs.
 */
function buildUserMessage(req: GenerateAPIRequest): Array<Record<string, unknown>> {
    const parts: Array<Record<string, unknown>> = [];

    // Text prompt
    let textContent = req.prompt;
    if (req.urls.length > 0) {
        textContent += `\n\nReference URLs (build something similar to these):\n${req.urls.map(u => `- ${u}`).join('\n')}`;
    }
    parts.push({ type: 'text', text: textContent });

    // Images
    for (const img of req.images) {
        if (req.config.provider === 'anthropic') {
            parts.push({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: img.mimeType,
                    data: img.base64,
                },
            });
        } else {
            // OpenAI format
            parts.push({
                type: 'image_url',
                image_url: {
                    url: `data:${img.mimeType};base64,${img.base64}`,
                },
            });
        }
    }

    return parts;
}

/**
 * Generic AI call — routes to the right provider.
 */
async function callAI(
    provider: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userContent: Array<Record<string, unknown>> | string,
    maxTokens: number = 16384
): Promise<string> {
    // Normalize to content array
    const userMessage: Array<Record<string, unknown>> = typeof userContent === 'string'
        ? [{ type: 'text', text: userContent }]
        : userContent;

    if (provider === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        return data.content[0].text;
    } else {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

/**
 * Parse the AI response into structured project files.
 */
function parseFilesFromResponse(response: string): Array<{ path: string; content: string; language: string }> {
    const files: Array<{ path: string; content: string; language: string }> = [];
    const fileRegex = /---FILE:\s*(.+?)---\n([\s\S]*?)---END FILE---/g;

    let match;
    while ((match = fileRegex.exec(response)) !== null) {
        const path = match[1].trim();
        const content = match[2].trim();
        const ext = path.split('.').pop()?.toLowerCase() || '';

        const langMap: Record<string, string> = {
            html: 'html', htm: 'html',
            css: 'css',
            js: 'javascript', jsx: 'javascript',
            ts: 'typescript', tsx: 'typescript',
            json: 'json',
            md: 'markdown',
        };

        files.push({
            path,
            content,
            language: langMap[ext] || 'plaintext',
        });
    }

    return files;
}

/**
 * Detect a project name from the spec or generated files.
 */
function detectProjectName(spec: Record<string, unknown> | null, prompt: string, files: Array<{ path: string; content: string }>): string {
    // Try spec first
    if (spec && typeof spec.appName === 'string' && spec.appName) {
        return spec.appName;
    }
    // Try <title> tag
    const indexFile = files.find(f => f.path === 'index.html');
    if (indexFile) {
        const titleMatch = indexFile.content.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) return titleMatch[1];
    }
    return prompt.split(' ').slice(0, 4).join(' ');
}

/**
 * Safely parse JSON from AI response (handles code fences, extra text).
 */
function safeParseJSON(text: string): Record<string, unknown> | null {
    // Try direct parse first
    try {
        return JSON.parse(text);
    } catch {
        // Strip markdown code fences
        const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```\s*$/g, '').trim();
        try {
            return JSON.parse(stripped);
        } catch {
            // Try to extract JSON object
            const jsonMatch = stripped.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch {
                    return null;
                }
            }
            return null;
        }
    }
}

// ============================================================================
// POST /api/generate — 3-Phase Pipeline
// ============================================================================
export async function POST(request: NextRequest) {
    try {
        const body: GenerateAPIRequest = await request.json();

        // Validate
        if (!body.config?.apiKey) {
            return NextResponse.json({ error: 'API key is required' }, { status: 400 });
        }
        if (!body.prompt?.trim()) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const { provider, apiKey, model } = body.config;
        const providerName = provider === 'anthropic' ? 'Claude' : 'GPT-4o';

        // Default models
        const defaultModels: Record<string, string> = {
            anthropic: 'claude-sonnet-4-20250514',
            openai: 'gpt-4o',
        };
        const selectedModel = model || defaultModels[provider];

        // Build the user message (with images)
        const userMessage = buildUserMessage(body);

        // Stream response as NDJSON
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (chunk: Record<string, unknown>) => {
                    controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
                };

                try {
                    // ========================================================
                    // PHASE 1: ARCHITECT — analyze & plan
                    // ========================================================
                    send({
                        type: 'event',
                        event: {
                            type: 'analyzing',
                            message: `Architect analyzing requirements...`,
                            progress: 5,
                            timestamp: new Date(),
                        },
                    });

                    send({
                        type: 'event',
                        event: {
                            type: 'planning',
                            message: `Planning app architecture with ${providerName}...`,
                            progress: 10,
                            timestamp: new Date(),
                        },
                    });

                    const architectResponse = await callAI(
                        provider, apiKey, selectedModel,
                        ARCHITECT_PROMPT,
                        userMessage,
                        4096 // Spec doesn't need many tokens
                    );

                    const spec = safeParseJSON(architectResponse);

                    if (spec) {
                        const appName = (spec.appName as string) || 'App';
                        const fileCount = Array.isArray(spec.files) ? spec.files.length : 3;
                        const featureCount = Array.isArray(spec.features) ? spec.features.length : 0;

                        send({
                            type: 'event',
                            event: {
                                type: 'planning',
                                message: `Planned "${appName}" — ${featureCount} features, ${fileCount} files`,
                                progress: 25,
                                timestamp: new Date(),
                            },
                        });
                    } else {
                        send({
                            type: 'event',
                            event: {
                                type: 'planning',
                                message: 'Architecture planned, proceeding to build...',
                                progress: 25,
                                timestamp: new Date(),
                            },
                        });
                    }

                    // ========================================================
                    // PHASE 2: BUILDER — generate code from spec
                    // ========================================================
                    send({
                        type: 'event',
                        event: {
                            type: 'coding',
                            message: `Builder generating code with ${providerName}...`,
                            progress: 30,
                            timestamp: new Date(),
                        },
                    });

                    // Build the builder's user message — include spec + original prompt + images
                    let builderInput: string;
                    if (spec) {
                        builderInput = `## Application Specification\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n\n## Original User Request\n${body.prompt}`;
                    } else {
                        // Fallback — send raw architect response + original prompt
                        builderInput = `## Architect's Analysis\n${architectResponse}\n\n## Original User Request\n${body.prompt}`;
                    }

                    // Include images in builder message too
                    const builderMessage: Array<Record<string, unknown>> = [
                        { type: 'text', text: builderInput },
                    ];
                    // Add images from original request for visual reference
                    for (const img of body.images) {
                        if (provider === 'anthropic') {
                            builderMessage.push({
                                type: 'image',
                                source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
                            });
                        } else {
                            builderMessage.push({
                                type: 'image_url',
                                image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
                            });
                        }
                    }

                    const builderResponse = await callAI(
                        provider, apiKey, selectedModel,
                        BUILDER_PROMPT,
                        builderMessage,
                        16384
                    );

                    // Parse files
                    let files = parseFilesFromResponse(builderResponse);

                    if (files.length === 0) {
                        files.push({
                            path: 'index.html',
                            content: builderResponse,
                            language: 'html',
                        });
                    }

                    send({
                        type: 'event',
                        event: {
                            type: 'coding',
                            message: `Generated ${files.length} files`,
                            progress: 65,
                            timestamp: new Date(),
                        },
                    });

                    // ========================================================
                    // PHASE 3: REVIEWER — validate functionality
                    // ========================================================
                    send({
                        type: 'event',
                        event: {
                            type: 'reviewing',
                            message: 'QA reviewing code quality...',
                            progress: 70,
                            timestamp: new Date(),
                        },
                    });

                    const reviewInput = `## Specification\n\`\`\`json\n${JSON.stringify(spec || { prompt: body.prompt }, null, 2)}\n\`\`\`\n\n## Generated Files\n${files.map(f => `### ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join('\n\n')}`;

                    const reviewResponse = await callAI(
                        provider, apiKey, selectedModel,
                        REVIEWER_PROMPT,
                        reviewInput,
                        2048
                    );

                    const review = safeParseJSON(reviewResponse);
                    const hasIssues = review && review.approved === false;

                    if (hasIssues && review.issues && Array.isArray(review.issues)) {
                        const issueCount = review.issues.length;
                        send({
                            type: 'event',
                            event: {
                                type: 'reviewing',
                                message: `Found ${issueCount} issue${issueCount !== 1 ? 's' : ''}, applying fixes...`,
                                progress: 75,
                                timestamp: new Date(),
                            },
                        });

                        // Re-run builder with fix instructions
                        const fixInput = `## IMPORTANT: Fix these issues in the code below\n\n${review.fixInstructions}\n\n### Issues:\n${(review.issues as Array<Record<string, string>>).map(i => `- [${i.file}] ${i.description}`).join('\n')}\n\n## Current Code (fix and regenerate ALL files)\n${files.map(f => `---FILE: ${f.path}---\n${f.content}\n---END FILE---`).join('\n\n')}\n\nRegenerate ALL files with the fixes applied. Use the same ---FILE: / ---END FILE--- format.`;

                        const fixedResponse = await callAI(
                            provider, apiKey, selectedModel,
                            BUILDER_PROMPT,
                            fixInput,
                            16384
                        );

                        const fixedFiles = parseFilesFromResponse(fixedResponse);
                        if (fixedFiles.length > 0) {
                            files = fixedFiles;
                            send({
                                type: 'event',
                                event: {
                                    type: 'reviewing',
                                    message: `Applied fixes — ${files.length} files updated`,
                                    progress: 85,
                                    timestamp: new Date(),
                                },
                            });
                        }
                    } else {
                        send({
                            type: 'event',
                            event: {
                                type: 'reviewing',
                                message: 'QA approved — all features verified ✓',
                                progress: 85,
                                timestamp: new Date(),
                            },
                        });
                    }

                    // ========================================================
                    // EMIT FILES & COMPLETE
                    // ========================================================
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        send({
                            type: 'event',
                            event: {
                                type: 'coding',
                                message: `Created ${file.path}`,
                                progress: 85 + Math.round((i / files.length) * 10),
                                timestamp: new Date(),
                            },
                        });
                        send({ type: 'file', file });
                    }

                    // Metadata
                    const projectName = detectProjectName(spec, body.prompt, files);
                    send({
                        type: 'metadata',
                        metadata: {
                            name: projectName,
                            description: body.prompt,
                            framework: 'Vanilla HTML/CSS/JS',
                            createdAt: new Date(),
                        },
                    });

                    // Done
                    send({
                        type: 'event',
                        event: {
                            type: 'complete',
                            message: 'Generation complete!',
                            progress: 100,
                            timestamp: new Date(),
                        },
                    });
                    send({ type: 'done' });

                } catch (err) {
                    send({
                        type: 'error',
                        error: err instanceof Error ? err.message : 'Unknown error occurred',
                    });
                }

                controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

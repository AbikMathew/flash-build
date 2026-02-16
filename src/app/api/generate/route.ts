import { NextRequest, NextResponse } from 'next/server';
import { GenerateAPIRequest } from '@/types';

/**
 * System prompt that instructs the AI to generate a complete web application.
 * Returns structured output with file markers for parsing.
 */
const SYSTEM_PROMPT = `You are FlashBuild, an expert web developer AI that generates complete, working web applications.

Given a user's description (and optionally screenshots/URLs of reference apps), generate a complete, self-contained web application using vanilla HTML, CSS, and JavaScript.

## Output Format
You MUST output your response in this exact format. Each file starts with a marker line and ends with another:

---FILE: filename.ext---
(file contents here)
---END FILE---

## Rules
1. Always generate at minimum: index.html, styles.css, and app.js
2. The index.html must link to styles.css and app.js
3. Use modern, beautiful CSS with gradients, shadows, and smooth transitions
4. Include responsive design (mobile-friendly)
5. Use semantic HTML5 elements
6. Add meaningful sample data so the app looks populated
7. Ensure the app is FULLY FUNCTIONAL — all buttons, forms, and interactions must work
8. Use CSS custom properties for theming
9. Add subtle animations for polish
10. No external dependencies — everything must be self-contained
11. Generate ONLY the file blocks, no explanations before or after
12. Make the UI visually stunning — use modern design patterns

## Quality Standards
- The app should look like it was built by a professional developer
- All interactive elements must have hover/active states
- Forms must have proper validation
- Lists should have add/remove functionality
- Use localStorage for data persistence where appropriate`;

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
 * Call the Anthropic Claude API.
 */
async function callAnthropic(apiKey: string, model: string, userMessage: Array<Record<string, unknown>>) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: userMessage,
                },
            ],
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

/**
 * Call the OpenAI GPT API.
 */
async function callOpenAI(apiKey: string, model: string, userMessage: Array<Record<string, unknown>>) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            max_tokens: 8192,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
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
 * Detect a project name from the generated files or prompt.
 */
function detectProjectName(prompt: string, files: Array<{ path: string; content: string }>): string {
    // Try to find a <title> tag in index.html
    const indexFile = files.find(f => f.path === 'index.html');
    if (indexFile) {
        const titleMatch = indexFile.content.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) return titleMatch[1];
    }
    // Fallback: use first few words of prompt
    return prompt.split(' ').slice(0, 4).join(' ');
}

/**
 * POST /api/generate
 * 
 * Accepts GenerateAPIRequest, calls the AI provider, parses files,
 * and returns a streaming NDJSON response with events.
 */
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

        // Default models
        const defaultModels: Record<string, string> = {
            anthropic: 'claude-sonnet-4-20250514',
            openai: 'gpt-4o',
        };
        const selectedModel = model || defaultModels[provider];

        // Build the user message
        const userMessage = buildUserMessage(body);

        // Stream response as NDJSON
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (chunk: Record<string, unknown>) => {
                    controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
                };

                try {
                    // Event: analyzing
                    send({
                        type: 'event',
                        event: {
                            type: 'analyzing',
                            message: 'Analyzing your requirements...',
                            progress: 10,
                            timestamp: new Date(),
                        },
                    });

                    // Event: planning
                    send({
                        type: 'event',
                        event: {
                            type: 'planning',
                            message: `Sending to ${provider === 'anthropic' ? 'Claude' : 'GPT-4o'}...`,
                            progress: 20,
                            timestamp: new Date(),
                        },
                    });

                    // Call AI
                    let aiResponse: string;
                    if (provider === 'anthropic') {
                        aiResponse = await callAnthropic(apiKey, selectedModel, userMessage);
                    } else {
                        aiResponse = await callOpenAI(apiKey, selectedModel, userMessage);
                    }

                    // Event: coding
                    send({
                        type: 'event',
                        event: {
                            type: 'coding',
                            message: 'Parsing generated code...',
                            progress: 70,
                            timestamp: new Date(),
                        },
                    });

                    // Parse files from response
                    const files = parseFilesFromResponse(aiResponse);

                    if (files.length === 0) {
                        // If parsing failed, treat entire response as a single HTML file
                        files.push({
                            path: 'index.html',
                            content: aiResponse,
                            language: 'html',
                        });
                    }

                    // Send each file
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        send({
                            type: 'event',
                            event: {
                                type: 'coding',
                                message: `Creating ${file.path}...`,
                                progress: 70 + Math.round((i / files.length) * 20),
                                timestamp: new Date(),
                            },
                        });
                        send({ type: 'file', file });
                    }

                    // Send metadata
                    const projectName = detectProjectName(body.prompt, files);
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

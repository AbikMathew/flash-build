import { NextRequest, NextResponse } from 'next/server';
import { GenerateAPIRequest } from '@/types';

/**
 * System prompt that instructs the AI to generate a complete web application.
 * Returns structured output with file markers for parsing.
 */
const SYSTEM_PROMPT = `You are FlashBuild, an expert senior full-stack web developer AI. You generate complete, production-ready, FULLY FUNCTIONAL web applications.

Given a user's description (and optionally screenshots/URLs of reference apps), generate a complete web application.

## Output Format
You MUST output ONLY file blocks in this exact format — NO explanations, NO markdown, NO commentary before or after:

---FILE: path/to/filename.ext---
(complete file contents)
---END FILE---

## File Structure Rules
1. Always generate at minimum: index.html, styles.css, and app.js
2. For complex apps, split code into multiple files:
   - utils.js — helper/utility functions
   - data.js — sample data, constants, mock API responses
   - Additional .js files for distinct features (e.g., chart.js, router.js)
3. The index.html must include <script> tags for ALL .js files in correct dependency order
4. The index.html must link to styles.css via <link> tag
5. For apps that would benefit from a package manager, also generate a package.json

## CRITICAL: Full Functionality Requirements
This is the MOST IMPORTANT requirement. The generated app must be FULLY FUNCTIONAL, not just a visual mockup:

- **Every button must have a working click handler** that performs its labeled action
- **Every form must submit** and process input data correctly
- **Calculations must work** — arithmetic, aggregations, sorting, filtering
- **CRUD operations must work** — Create, Read, Update, Delete for any data shown
- **Navigation must work** — tabs, pages, modals must open/close/switch
- **Data persistence** — use localStorage to persist user data across page reloads
- **Keyboard shortcuts** — Enter to submit forms, Escape to close modals
- **Error handling** — show user-friendly messages for invalid input

### Concrete quality examples:
- Calculator → ALL arithmetic operations (+, -, ×, ÷, %, =, C, backspace) must compute correct results
- Todo app → add items, mark complete, delete items, filter by status, persist in localStorage
- Dashboard → charts must render with real data, filters must update charts
- Form app → validation, submission, success/error states, data display
- Spreadsheet → cells must be editable, formulas must compute, rows/columns addable

## Visual Design Standards
- Modern, premium UI — use gradients, shadows, rounded corners, glass effects
- CSS custom properties for theming (--primary, --bg, --text, etc.)
- Responsive design — works on desktop and mobile
- Semantic HTML5 elements (header, main, nav, section, article, footer)
- Smooth transitions and micro-animations (hover states, focus rings, loading states)
- All interactive elements must have hover/active/focus states
- Use a cohesive color palette — no clashing colors
- Professional typography with proper hierarchy (h1 > h2 > h3 > p)
- Populate with meaningful, realistic sample data — never use "Lorem ipsum"

## Code Quality
- Clean, well-structured JavaScript with clear function names
- Event delegation where appropriate
- No external CDN links or dependencies — everything self-contained
- No inline styles — all styling in CSS files
- Comments for complex logic sections
- DRY code — extract repeated patterns into functions

## If the user provides a screenshot:
- Replicate the exact visual layout, spacing, colors, and typography as closely as possible
- Match component structure, alignment, and proportions
- Use the exact hex colors visible in the screenshot
- Preserve the UI hierarchy and information architecture

## If the user provides a URL:
- Build an app inspired by the referenced website's design and functionality
- Match the general layout, color scheme, and interaction patterns

Generate ONLY the file blocks now.`;

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
            max_tokens: 16384,
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
            max_tokens: 16384,
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

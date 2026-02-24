# FlashBuild ⚡

AI-powered web app generator. Describe what you want → get a working app with code + live preview.

## Features

- 🎨 **Describe anything** — natural language prompt to HTML/CSS/JS
- 📸 **Screenshot to code** — upload a screenshot, get matching code
- 🔗 **URL analysis** — paste a URL to generate a similar app
- ✏️ **Monaco editor** — edit generated code with full syntax highlighting
- 👁️ **Live preview runtimes** — `srcdoc` for static apps, Sandpack for React/npm apps, remote fallback for heavy projects
- 📦 **Dual export** — download full runnable project or `ui-only` package + integration manifest

## Getting Started

```bash
# Install
npm install

# Dev server
npm run dev

# Build
npm run build
```

Open [http://localhost:3000](http://localhost:3000).

## AI Configuration (BYOK)

Click **Settings** in the header to configure your API key:

| Provider | Model | Get Key |
|----------|-------|---------|
| Anthropic | Claude Sonnet 4 | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| OpenAI | GPT-4o | [platform.openai.com](https://platform.openai.com/api-keys) |

Your key is stored in browser localStorage and passed to the AI provider through our API route. Cost: ~$0.02–$0.05 per generation.

### Default Quality Mode

- `outputStack`: `react-tailwind` (browser-runnable, componentized architecture style)
- `qualityMode`: `strict_visual`
- `maxRetries`: `1`
- `maxCostUsd`: `0.25`
- responsive baseline: `375 / 768 / 1280`

The generation pipeline runs:
1. Reference ingestion (prompt/image/url normalization)
2. Design spec extraction (strict JSON)
3. Project generation
4. Quality gates (functional + visual score)
5. Runtime gate (isolated install/build before acceptance for React outputs)
6. One targeted repair retry if needed

Optional: set `FIRECRAWL_API_KEY` for stronger URL ingestion on JS-heavy sites.
Optional: set `E2B_API_KEY` to enable remote runtime sessions for complex dependency-heavy apps.

### Runtime Gate Controls

- `FLASHBUILD_RUNTIME_VALIDATION=off` disables install/build gate.
- `FLASHBUILD_RUNTIME_VALIDATION=force` forces runtime gate even in serverless environments.
- `FLASHBUILD_RUNTIME_TESTS=1` additionally runs `npm run test` if present.

Without an API key, the app uses a **mock generator** with pre-built templates.

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui**
- **Monaco Editor**
- **Sandpack** (React/npm runtime preview)
- **Zustand** (state)
- **JSZip** (export)

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

```bash
# Or via CLI
npm i -g vercel
vercel
```

## Architecture

```
src/
├── app/
│   ├── api/generate/     # AI proxy route (Claude/GPT-4o)
│   └── page.tsx          # Main entry
├── components/
│   ├── input/            # Prompt, image upload, URL input
│   ├── workspace/        # Editor, preview, file explorer
│   ├── generation/       # Progress status
│   ├── settings/         # API key config modal
│   └── layout/           # AppWorkspace orchestrator
├── services/
│   ├── generator/        # IGeneratorService → Mock + AI adapters
│   ├── preview/          # Runtime resolver + srcdoc/sandpack/remote adapters
│   └── export/           # ZIP download
├── store/                # Zustand project state
└── types/                # Shared TypeScript types
```

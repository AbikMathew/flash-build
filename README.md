# FlashBuild ⚡

AI-powered web app generator. Describe what you want → get a working app with code + live preview.

## Features

- 🎨 **Describe anything** — natural language prompt to HTML/CSS/JS
- 📸 **Screenshot to code** — upload a screenshot, get matching code
- 🔗 **URL analysis** — paste a URL to generate a similar app
- ✏️ **Monaco editor** — edit generated code with full syntax highlighting
- 👁️ **Live preview** — real-time iframe preview with viewport toggles
- 📦 **Export** — download the entire project as a ZIP

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

Without an API key, the app uses a **mock generator** with pre-built templates.

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui**
- **Monaco Editor**
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
│   ├── preview/          # Bundles files → iframe HTML
│   └── export/           # ZIP download
├── store/                # Zustand project state
└── types/                # Shared TypeScript types
```

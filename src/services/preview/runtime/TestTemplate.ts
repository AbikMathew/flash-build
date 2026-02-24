import { ProjectFile } from '@/types';

export const TEST_TEMPLATE_FILES: ProjectFile[] = [
  {
    path: 'package.json',
    language: 'json',
    content: JSON.stringify({
      "name": "test-app",
      "private": true,
      "version": "0.0.0",
      "type": "module",
      "scripts": {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
      },
      "dependencies": {
        "react": "^18.3.1",
        "react-dom": "^18.3.1"
      },
      "devDependencies": {
        "@types/react": "^18.3.3",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.0.0",
        "autoprefixer": "^10.4.19",
        "postcss": "^8.4.38",
        "tailwindcss": "^3.4.4",
        "typescript": "^5.2.2",
        "vite": "^4.4.5"
      }
    }, null, 2)
  },
  {
    path: 'vite.config.ts',
    language: 'typescript',
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`
  },
  {
    path: 'index.html',
    language: 'html',
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Test App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
  },
  {
    path: 'src/main.tsx',
    language: 'tsx',
    content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
  },
  {
    path: 'src/App.tsx',
    language: 'tsx',
    content: `import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <span className="text-2xl">⚡</span>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Sandpack Test
            </h1>
            <p className="text-sm text-slate-400">Verifying live preview</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-800/50 rounded-lg flex items-center justify-between">
            <span className="text-slate-300">Interaction Check</span>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setCount(c => c - 1)}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all"
              >
                -
              </button>
              <span className="font-mono text-lg min-w-[2ch] text-center">{count}</span>
              <button 
                onClick={() => setCount(c => c + 1)}
                className="w-8 h-8 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all"
              >
                +
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg">
            <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <span>📊</span>
              Environment Status
            </h3>
            <div className="space-y-1 text-xs text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>React</span>
                <span className="text-slate-200">v18+</span>
              </div>
              <div className="flex justify-between">
                <span>Tailwind</span>
                <span className="text-slate-200">CDN</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
          If you can see this, Sandpack is working! 🎉
        </div>
      </div>
    </div>
  )
}
`
  },
  {
    path: 'src/index.css',
    language: 'css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;`
  },
  {
    path: 'tailwind.config.js',
    language: 'javascript',
    content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`
  },
  {
    path: 'postcss.config.js',
    language: 'javascript',
    content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
  }
];

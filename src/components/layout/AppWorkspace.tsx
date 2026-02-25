'use client';

import React, { useCallback, useState, useMemo } from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Code2,
    Eye,
    Columns2,
    Zap,
    Menu,
} from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from '@/components/ui/sheet';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackFileExplorer,
    SandpackCodeEditor,
    SandpackPreview,
    SandpackConsole,
} from '@codesandbox/sandpack-react';

import HealingConsoleWrapper from '@/components/workspace/HealingConsoleWrapper';

import InputPanel from '@/components/input/InputPanel';
import GenerationStatus from '@/components/generation/GenerationStatus';
import SettingsModal from '@/components/settings/SettingsModal';
import { SandpackExportButton } from '@/components/workspace/SandpackExportButton';

import { useProjectStore } from '@/store/useProjectStore';
import { createGenerator, getPreferredGeneratorType } from '@/services/generator';
import { PreviewService } from '@/services/preview/PreviewService';
import { UploadedImage, WorkspaceView, AIConfig } from '@/types';
import { TEST_TEMPLATE_FILES } from '@/services/preview/runtime/TestTemplate';

export default function AppWorkspace() {
    const {
        files,
        activeFilePath,
        metadata,
        status,
        events,
        workspaceView,
        viewportSize,
        setFiles,
        setActiveFile,
        setMetadata,
        setPreviewHtml,
        setStatus,
        addEvent,
        clearEvents,
        setWorkspaceView,
        setViewportSize,
    } = useProjectStore();

    const isGenerating = status === 'generating';
    const [, setAiConfig] = useState<AIConfig | null>(null);

    // ---------- Detect project type ----------
    const isReactProject = useMemo(() => {
        if (files.length === 0) return true; // default to react-ts when empty
        return files.some(
            f =>
                f.path.endsWith('.tsx') ||
                f.path.endsWith('.jsx') ||
                f.content.includes('ReactDOM') ||
                f.content.includes('react-dom'),
        );
    }, [files]);

    // ---------- Extract dependencies from project package.json ----------
    const projectDeps = useMemo(() => {
        const pkgFile = files.find(f => f.path === 'package.json');
        if (!pkgFile) return {};
        try {
            const pkg = JSON.parse(pkgFile.content);
            const deps: Record<string, string> = {};
            // Merge dependencies + devDependencies (Sandpack installs them all)
            if (pkg.dependencies) Object.assign(deps, pkg.dependencies);
            if (pkg.devDependencies) Object.assign(deps, pkg.devDependencies);
            // Remove packages Sandpack provides internally / that cause issues
            delete deps.react;
            delete deps['react-dom'];
            delete deps.vite;
            delete deps['@vitejs/plugin-react'];
            delete deps['react-scripts'];
            delete deps.typescript;
            delete deps['@types/react'];
            delete deps['@types/react-dom'];
            // Tailwind build tools — not needed, we use CDN
            delete deps.tailwindcss;
            delete deps['@tailwindcss/postcss'];
            delete deps.postcss;
            delete deps.autoprefixer;

            // Pin known-good versions for common packages
            // (AI often generates outdated versions that Sandpack CDN can't find)
            const PINNED_VERSIONS: Record<string, string> = {
                'lucide-react': '^0.460.0',
                'framer-motion': '^11.15.0',
                'react-router-dom': '^6.28.0',
                'react-icons': '^5.4.0',
                'recharts': '^2.14.0',
                'zustand': '^5.0.0',
                'clsx': '^2.1.0',
                'tailwind-merge': '^2.6.0',
            };
            for (const [pkg, version] of Object.entries(PINNED_VERSIONS)) {
                if (deps[pkg]) {
                    deps[pkg] = version;
                }
            }

            // Everything else passes through
            return deps;
        } catch {
            return {};
        }
    }, [files]);

    // ---------- Transform files for Sandpack ----------
    const sandpackFiles = useMemo(() => {
        if (files.length === 0) return {};

        // ---- VANILLA projects (HTML/CSS/JS) ----
        if (!isReactProject) {
            const filesMap: Record<string, { code: string }> = {};
            for (const file of files) {
                // Sandpack requires paths starting with /
                const key = file.path.startsWith('/') ? file.path : `/${file.path}`;
                filesMap[key] = { code: file.content };
            }
            return filesMap;
        }

        // ---- REACT projects: Vite → CRA transformation ----
        // The react-ts template expects files at ROOT level:
        //   /App.tsx, /index.tsx, /public/index.html, /styles.css
        // NOT under /src/

        // Find the React entry point
        let entryFile: typeof files[0] | null = null;
        files.forEach(file => {
            if (
                (file.path.endsWith('.tsx') || file.path.endsWith('.ts') ||
                    file.path.endsWith('.jsx') || file.path.endsWith('.js')) &&
                (file.content.includes('ReactDOM.createRoot') || file.content.includes('ReactDOM.render'))
            ) {
                entryFile = file;
            }
        });
        if (!entryFile) {
            entryFile = files.find(
                f => f.path === 'src/main.tsx' || f.path === 'main.tsx' ||
                    f.path === 'src/index.tsx' || f.path === 'index.tsx',
            ) || null;
        }

        const filesMap: Record<string, { code: string }> = {};

        for (const file of files) {
            // Skip vite config — not needed in CRA/react-ts template
            if (file.path === 'vite.config.ts' || file.path === 'vite.config.js') continue;

            // Skip package.json — we pass deps via customSetup instead
            if (file.path === 'package.json') continue;

            // Skip postcss/tailwind configs — we use CDN instead
            if (file.path === 'postcss.config.js' || file.path === 'postcss.config.ts') continue;
            if (file.path === 'tailwind.config.js' || file.path === 'tailwind.config.ts') continue;

            // Override index.html with Tailwind CDN injection
            // The vite-react-ts template uses /index.html at root level
            // We inject the CDN script since externalResources doesn't work with node env
            if (file.path === 'index.html' || file.path === 'public/index.html') {
                filesMap['/index.html'] = {
                    code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>`
                };
                continue;
            }

            // Pass the entry file through — it often wraps <App /> in 
            // <BrowserRouter> or other providers that must be preserved.
            // Fix import paths: strip .tsx extensions and remap src/ → root
            if (file === entryFile) {
                let code = file.content;
                // Fix: './App.tsx' → './App' (Vite resolves without extension)
                code = code.replace(/from\s+['"]\.\/App\.tsx['"]/g, "from './App'");
                // Fix: BrowserRouter → HashRouter (Sandpack doesn't support pushState routing)
                code = code.replace(/BrowserRouter/g, 'HashRouter');
                // Fix: './index.css' stays as-is (we map src/index.css → /index.css)
                filesMap['/index.tsx'] = { code };
                continue;
            }

            // Default: place at root level, strip src/ prefix
            let baseName = file.path;
            // Remove src/ prefix so files match template structure
            if (baseName.startsWith('src/')) {
                baseName = baseName.slice(4); // "src/App.tsx" → "App.tsx"
            }
            // Ensure leading slash
            const targetPath = baseName.startsWith('/') ? baseName : `/${baseName}`;

            // Clean CSS: strip Tailwind build directives (CDN handles this)
            // Covers both v3 (@tailwind base;) and v4 (@import "tailwindcss";) syntax
            let code = file.content;
            if (targetPath.endsWith('.css')) {
                code = code
                    .replace(/^@tailwind\s+\w+;\s*$/gm, '')           // v3: @tailwind base;
                    .replace(/^@import\s+['"]tailwindcss(\/[^'"]*)?['"];?\s*$/gm, '')  // v4: @import "tailwindcss";
                    .trim();
            }

            // Fix router: BrowserRouter → HashRouter (BrowserRouter needs server-side URL handling, Sandpack doesn't have it)
            if (targetPath.endsWith('.tsx') || targetPath.endsWith('.jsx') || targetPath.endsWith('.ts') || targetPath.endsWith('.js')) {
                code = code.replace(/BrowserRouter/g, 'HashRouter');
            }

            filesMap[targetPath] = { code };
        }

        // Always ensure index.html has the Tailwind CDN for React projects
        if (!filesMap['/index.html']) {
            filesMap['/index.html'] = {
                code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>`
            };
        }

        return filesMap;
    }, [files, isReactProject]);

    // ---------- Template selection ----------
    const template = isReactProject ? 'vite-react-ts' : ('vanilla' as const);

    // ---------- Stable key for SandpackProvider ----------
    // Sandpack doesn't re-initialize when the files prop changes after mount.
    // We force a full remount by deriving a key from the file paths + template.
    const sandpackKey = useMemo(() => {
        const paths = Object.keys(sandpackFiles).sort().join('|');
        return `${template}::${paths}`;
    }, [sandpackFiles, template]);



    const handleGenerate = useCallback(
        async (prompt: string, images: UploadedImage[], urls: string[]) => {
            setStatus('generating');
            clearEvents();
            setFiles([]);
            setPreviewHtml('');

            const genType = getPreferredGeneratorType();
            const generator = createGenerator(genType);
            const collectedFiles: typeof files = [];

            try {
                const gen = generator.generate({ prompt, images, urls });
                let result = await gen.next();

                while (!result.done) {
                    const event = result.value;
                    addEvent(event);

                    if (event.file) {
                        collectedFiles.push(event.file);
                        setFiles([...collectedFiles]);
                        if (!activeFilePath || collectedFiles.length === 1) {
                            setActiveFile(event.file.path);
                        }
                    }

                    result = await gen.next();
                }

                // Generator returned the final project
                const project = result.value;
                setFiles(project.files);
                setMetadata(project.metadata);
                setStatus('complete');

                // Auto-switch to split view to show preview
                if (workspaceView === 'code') {
                    setWorkspaceView('split');
                }
            } catch (err) {
                console.error('Generation failed:', err);
                addEvent({
                    type: 'error',
                    message: `Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
                    progress: 0,
                    timestamp: new Date(),
                });
                setStatus('error');
            }
        },
        [activeFilePath, workspaceView, setStatus, clearEvents, setFiles, setPreviewHtml, addEvent, setActiveFile, setMetadata, setWorkspaceView],
    );

    const handleLoadTest = useCallback(() => {
        setFiles(TEST_TEMPLATE_FILES);
        setActiveFile('src/App.tsx');
        setMetadata({
            name: 'Test Template',
            description: 'Hardcoded test template for debugging',
            framework: 'react-tailwind',
            createdAt: new Date(),
            packageManifest: JSON.parse(TEST_TEMPLATE_FILES.find(f => f.path === 'package.json')?.content || '{}'),
            runtimeHint: {
                preferredRuntime: 'sandpack',
                fallbackRuntime: 'remote',
                reason: 'Test template loaded',
                complexityScore: 10,
            },
        });
        setStatus('complete');
        if (workspaceView === 'code') {
            setWorkspaceView('split');
        }
    }, [setFiles, setActiveFile, setMetadata, setStatus, setWorkspaceView, workspaceView]);

    const viewButtons: { view: WorkspaceView; icon: React.ElementType; label: string }[] = [
        { view: 'code', icon: Code2, label: 'Code' },
        { view: 'split', icon: Columns2, label: 'Split' },
        { view: 'preview', icon: Eye, label: 'Preview' },
    ];

    return (
        <SandpackProvider
            key={sandpackKey}
            template={template}
            files={sandpackFiles}
            theme="dark"
            options={{
                externalResources: ['https://cdn.tailwindcss.com'],
            }}
            customSetup={{
                dependencies: projectDeps,
            }}
            className="flex flex-col h-screen bg-background w-full"
        >
            <div className="flex flex-col h-screen bg-background text-foreground">
                {/* Top Header Bar */}
                <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Mobile Menu Trigger */}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="md:hidden">
                                    <Menu className="w-5 h-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-80">
                                <InputPanel onGenerate={handleGenerate} isGenerating={isGenerating} />
                            </SheetContent>
                        </Sheet>

                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-purple-400" />
                            <span className="font-bold text-sm tracking-tight hidden sm:inline">
                                Flash<span className="text-purple-400">Build</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View toggle */}
                        <div className="flex items-center bg-muted rounded-md p-0.5">
                            {viewButtons.map(({ view, icon: Icon, label }) => (
                                <Button
                                    key={view}
                                    variant={workspaceView === view ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className={cn(
                                        "h-7 px-2.5 text-xs gap-1.5",
                                        view === 'split' && "hidden md:flex"
                                    )}
                                    onClick={() => setWorkspaceView(view)}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span className="hidden md:inline">{label}</span>
                                </Button>
                            ))}
                        </div>

                        {/* Export using Sandpack context */}
                        <SandpackExportButton metadata={metadata} />

                        {/* Test Load Button (Debug) */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] text-amber-500 gap-1 hidden md:flex"
                            onClick={handleLoadTest}
                        >
                            Test
                        </Button>

                        {/* Settings */}
                        <SettingsModal onConfigChange={setAiConfig} />
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Input */}
                    <div className="hidden md:block w-80 shrink-0 border-r border-border">
                        <InputPanel onGenerate={handleGenerate} isGenerating={isGenerating} />
                    </div>

                    {/* Center + Right: Workspace */}
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        <div className="flex flex-col h-full">
                            {/* Workspace Area */}
                            <div className="flex-1 overflow-hidden relative">
                                <ResizablePanelGroup direction="horizontal">
                                    {/* File Explorer + Code Editor */}
                                    {workspaceView !== 'preview' && (
                                        <>
                                            <ResizablePanel defaultSize={workspaceView === 'code' ? 100 : 50} minSize={20}>
                                                <div className="flex h-full">
                                                    <div className="w-[200px] shrink-0 border-r border-border h-full overflow-hidden hidden md:block">
                                                        <SandpackFileExplorer style={{ height: '100%' }} />
                                                    </div>
                                                    <div className="flex-1 h-full min-w-0">
                                                        <SandpackCodeEditor
                                                            showTabs
                                                            showLineNumbers
                                                            showInlineErrors
                                                            wrapContent
                                                            closableTabs
                                                            style={{ height: '100%' }}
                                                        />
                                                    </div>
                                                </div>
                                            </ResizablePanel>

                                            {workspaceView === 'split' && <ResizableHandle withHandle />}
                                        </>
                                    )}

                                    {/* Preview Pane */}
                                    {workspaceView !== 'code' && (
                                        <ResizablePanel defaultSize={workspaceView === 'preview' ? 100 : 50} minSize={30}>
                                            <ResizablePanelGroup direction="vertical">
                                                <ResizablePanel defaultSize={75} minSize={20}>
                                                    <SandpackPreview
                                                        style={{ height: '100%' }}
                                                        showRefreshButton
                                                        showOpenInCodeSandbox={false}
                                                        showNavigator
                                                    />
                                                </ResizablePanel>
                                                <ResizableHandle />
                                                <ResizablePanel defaultSize={25} minSize={10}>
                                                    <HealingConsoleWrapper style={{ height: '100%' }} />
                                                </ResizablePanel>
                                            </ResizablePanelGroup>
                                        </ResizablePanel>
                                    )}
                                </ResizablePanelGroup>
                            </div>

                            {/* Generation Status Bar */}
                            {(status === 'generating' || status === 'error') && (
                                <GenerationStatus events={events} isGenerating={isGenerating} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SandpackProvider>
    );
}

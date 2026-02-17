'use client';

import React, { useCallback, useState } from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Download,
    Code2,
    Eye,
    Columns2,
    PanelLeftClose,
    PanelLeft,
    Zap,
    Menu,
} from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from '@/components/ui/sheet';

import InputPanel from '@/components/input/InputPanel';
import FileExplorer from '@/components/workspace/FileExplorer';
import CodeEditor from '@/components/workspace/CodeEditor';
import PreviewPane from '@/components/workspace/PreviewPane';
import GenerationStatus from '@/components/generation/GenerationStatus';
import SettingsModal from '@/components/settings/SettingsModal';

import { useProjectStore } from '@/store/useProjectStore';
import { createGenerator, getPreferredGeneratorType } from '@/services/generator';
import { PreviewService } from '@/services/preview/PreviewService';
import { ExportService } from '@/services/export/ExportService';
import { UploadedImage, WorkspaceView, AIConfig } from '@/types';

export default function AppWorkspace() {
    const {
        files,
        activeFilePath,
        metadata,
        previewHtml,
        status,
        events,
        workspaceView,
        viewportSize,
        isSidebarOpen,
        setFiles,
        setActiveFile,
        updateFileContent,
        setMetadata,
        setPreviewHtml,
        setStatus,
        addEvent,
        clearEvents,
        setWorkspaceView,
        setViewportSize,
        toggleSidebar,
    } = useProjectStore();

    const activeFile = files.find((f) => f.path === activeFilePath) || null;
    const isGenerating = status === 'generating';
    const [, setAiConfig] = useState<AIConfig | null>(null);

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
                const html = project.previewHtml || PreviewService.bundle(project.files);
                setPreviewHtml(html);
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
        [activeFilePath, workspaceView, setStatus, clearEvents, setFiles, setPreviewHtml, addEvent, setActiveFile, setMetadata, setWorkspaceView]
    );

    const handleExport = async () => {
        if (files.length === 0 || !metadata) return;
        await ExportService.downloadZip(files, metadata);
    };

    const handleFileContentChange = (content: string) => {
        if (!activeFilePath) return;
        updateFileContent(activeFilePath, content);
        // Rebuild preview
        const updatedFiles = files.map((f) =>
            f.path === activeFilePath ? { ...f, content } : f
        );
        setPreviewHtml(PreviewService.bundle(updatedFiles));
    };

    const viewButtons: { view: WorkspaceView; icon: React.ElementType; label: string }[] = [
        { view: 'code', icon: Code2, label: 'Code' },
        { view: 'split', icon: Columns2, label: 'Split' },
        { view: 'preview', icon: Eye, label: 'Preview' },
    ];

    return (
        <div className="flex flex-col h-screen bg-background">
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
                                    view === 'split' && "hidden md:flex" // Hide split view on mobile
                                )}
                                onClick={() => setWorkspaceView(view)}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">{label}</span>
                            </Button>
                        ))}
                    </div>

                    {/* Export */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={handleExport}
                        disabled={files.length === 0}
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Export</span>
                    </Button>

                    {/* Settings */}
                    <SettingsModal onConfigChange={setAiConfig} />
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Input - fixed sidebar on desktop, hidden on mobile */}
                <div className="hidden md:block w-80 shrink-0 border-r border-border">
                    <InputPanel onGenerate={handleGenerate} isGenerating={isGenerating} />
                </div>

                {/* Center + Right: Workspace */}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="flex flex-col h-full">
                        {/* Workspace Area */}
                        <div className="flex-1 overflow-hidden">
                            <ResizablePanelGroup direction="horizontal">
                                {/* File Explorer + Code Editor */}
                                {workspaceView !== 'preview' && (
                                    <>
                                        <ResizablePanel defaultSize={workspaceView === 'code' ? 100 : 50} minSize={30}>
                                            <div className="flex h-full">
                                                {/* File Explorer sidebar toggle */}
                                                {files.length > 0 && (
                                                    <>
                                                        <div className="shrink-0 border-r border-border">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 rounded-none"
                                                                onClick={toggleSidebar}
                                                            >
                                                                {isSidebarOpen ? (
                                                                    <PanelLeftClose className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <PanelLeft className="w-3.5 h-3.5" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                        {isSidebarOpen && (
                                                            <div className="w-48 shrink-0">
                                                                <FileExplorer
                                                                    files={files}
                                                                    activeFilePath={activeFilePath}
                                                                    onSelectFile={setActiveFile}
                                                                />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                <div className="flex-1">
                                                    <CodeEditor
                                                        file={activeFile}
                                                        onContentChange={handleFileContentChange}
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
                                        <PreviewPane
                                            html={previewHtml}
                                            viewportSize={viewportSize}
                                            onViewportChange={setViewportSize}
                                        />
                                    </ResizablePanel>
                                )}
                            </ResizablePanelGroup>
                        </div>

                        {/* Generation Status Bar */}
                        <GenerationStatus events={events} isGenerating={isGenerating} />
                    </div>
                </div>
            </div>
        </div>
    );
}

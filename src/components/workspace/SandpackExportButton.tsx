import React, { useState } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { ExportService } from '@/services/export/ExportService';
import { ProjectMetadata, ExportMode } from '@/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface SandpackExportButtonProps {
    metadata: ProjectMetadata | null;
}

export function SandpackExportButton({ metadata }: SandpackExportButtonProps) {
    const { sandpack } = useSandpack();
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleExportClick = () => {
        if (!metadata) return;
        setIsExportDialogOpen(true);
    };

    const handleExportMode = async (mode: ExportMode) => {
        if (!metadata) return;

        // Convert Sandpack files object { path: { code: string } } to ProjectFile[]
        const files = Object.entries(sandpack.files).map(([path, file]) => ({
            path: path.startsWith('/') ? path.substring(1) : path, // Remove leading slash
            content: file.code,
            language: 'typescript' // Default/inferred
        }));

        try {
            setIsExporting(true);
            await ExportService.downloadZip(files, metadata, mode);
            setIsExportDialogOpen(false);
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handleExportClick}
                disabled={!metadata}
            >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
            </Button>

            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Export Project</DialogTitle>
                        <DialogDescription>
                            Download the current state of your code from the editor.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Button
                            className="w-full justify-start"
                            onClick={() => handleExportMode('full-project')}
                            disabled={isExporting}
                        >
                            Full project (runnable)
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => handleExportMode('ui-only')}
                            disabled={isExporting}
                        >
                            UI only (with manifest)
                        </Button>
                    </div>
                    <DialogFooter showCloseButton />
                </DialogContent>
            </Dialog>
        </>
    );
}

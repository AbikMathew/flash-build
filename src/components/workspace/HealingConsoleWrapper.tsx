'use client';

import React, { useEffect, useState } from 'react';
import { useSandpack, SandpackConsole, useSandpackConsole } from '@codesandbox/sandpack-react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { HealingService, HealingAction } from '@/services/healing/HealingService';

export default function HealingConsoleWrapper({ style }: { style?: React.CSSProperties }) {
    const { sandpack } = useSandpack();
    const { logs } = useSandpackConsole({ resetOnPreviewRestart: true });
    const [action, setAction] = useState<HealingAction | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    useEffect(() => {
        // Collect error logs
        const errorLogs = logs
            .filter(log => log.method === 'error' || log.method === 'warn') // Sometimes build errors are warnings? No, usually errors.
            .map(log => log.data?.join(' ') || '');

        if (errorLogs.length > 0) {
            const possibleAction = HealingService.analyzeError(errorLogs);
            if (possibleAction) {
                setAction(possibleAction);
            }
        } else {
            setAction(null);
        }
    }, [logs]);

    const handleApplyFix = async () => {
        if (!action) return;
        setIsApplying(true);
        try {
            // Transform current files
            const currentFiles = Object.entries(sandpack.files).map(([path, file]) => ({
                path,
                content: file.code,
                language: 'plaintext' // language doesn't matter for this simple transform
            }));

            const fixedFiles = await HealingService.applyFix(action, currentFiles);

            // Build updates object for Sandpack
            const updates = fixedFiles.reduce((acc, output) => {
                acc[output.path] = output.content;
                return acc;
            }, {} as Record<string, string>);

            sandpack.updateFile(updates);

            // Clear action so it doesn't flash again immediately (though logs might persist until refresh)
            setAction(null);

            // Trigger a refresh/restart if needed?
            // updating package.json usually triggers restart in Sandpack.
        } catch (err) {
            console.error('Failed to apply fix:', err);
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="relative h-full flex flex-col">
            {action && (
                <div className="absolute bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2">
                    <Button
                        onClick={handleApplyFix}
                        disabled={isApplying}
                        className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg gap-2"
                    >
                        {isApplying ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        {isApplying ? 'Applying Fix...' : `Fix: ${action.description}`}
                    </Button>
                </div>
            )}
            <SandpackConsole style={style} />
        </div>
    );
}

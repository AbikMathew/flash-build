'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GenerationEvent } from '@/types';
import { cn } from '@/lib/utils';
import {
    DatabaseZap,
    Brain,
    Search,
    Code2,
    Hammer,
    ShieldCheck,
    ScanLine,
    Smartphone,
    Cloud,
    CheckCircle2,
    AlertCircle,
    Loader2,
} from 'lucide-react';

interface GenerationStatusProps {
    events: GenerationEvent[];
    isGenerating: boolean;
}

const eventConfig: Record<string, { icon: React.ElementType; color: string }> = {
    ingesting: { icon: DatabaseZap, color: 'text-cyan-400' },
    planning: { icon: Brain, color: 'text-purple-400' },
    analyzing: { icon: Search, color: 'text-blue-400' },
    coding: { icon: Code2, color: 'text-green-400' },
    compiling: { icon: Hammer, color: 'text-orange-400' },
    reviewing: { icon: ShieldCheck, color: 'text-yellow-400' },
    validating: { icon: ScanLine, color: 'text-indigo-400' },
    responsive_check: { icon: Smartphone, color: 'text-cyan-400' },
    runtime_fallback: { icon: Cloud, color: 'text-sky-400' },
    complete: { icon: CheckCircle2, color: 'text-emerald-400' },
    error: { icon: AlertCircle, color: 'text-red-400' },
};

function ElapsedTimer({ isRunning }: { isRunning: boolean }) {
    const [elapsed, setElapsed] = useState(0);
    const startRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isRunning) {
            startRef.current = null;
            return;
        }
        startRef.current = Date.now();
        const interval = setInterval(() => {
            if (!startRef.current) return;
            setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [isRunning]);

    const displayElapsed = isRunning ? elapsed : 0;
    const mins = Math.floor(displayElapsed / 60);
    const secs = displayElapsed % 60;

    return (
        <span className="text-xs text-muted-foreground tabular-nums">
            {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
        </span>
    );
}

export default function GenerationStatus({ events, isGenerating }: GenerationStatusProps) {
    if (events.length === 0 && !isGenerating) return null;

    const latestEvent = events[events.length - 1];
    const progress = latestEvent?.progress ?? 0;

    return (
        <div className="border-t border-border bg-card/80">
            {/* Progress bar */}
            <div className="h-0.5 bg-border/50">
                <div
                    className={cn(
                        'h-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all duration-700 ease-out',
                        isGenerating && progress < 100 && 'animate-pulse'
                    )}
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="px-4 py-2">
                <div className="flex items-center gap-2 mb-2">
                    {isGenerating ? (
                        <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                    ) : latestEvent?.type === 'error' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className="text-xs font-medium">
                        {isGenerating
                            ? 'Agent is working...'
                            : latestEvent?.type === 'error'
                                ? 'Generation failed'
                                : 'Generation complete'}
                    </span>
                    <div className="ml-auto flex items-center gap-3">
                        {isGenerating && (
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                        )}
                        <ElapsedTimer isRunning={isGenerating} />
                    </div>
                </div>

                <ScrollArea className="max-h-32">
                    <div className="flex flex-col gap-1">
                        {events.map((event, i) => {
                            const config = eventConfig[event.type] || eventConfig.planning;
                            const Icon = config.icon;
                            const isLatest = i === events.length - 1;
                            const isActive = isLatest && isGenerating;

                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        'flex items-center gap-2 text-xs py-0.5 transition-all duration-300',
                                        isActive && 'opacity-100',
                                        !isLatest && !isActive && 'opacity-50'
                                    )}
                                >
                                    {isActive ? (
                                        <div className="relative w-3 h-3 shrink-0">
                                            <Icon className={cn('w-3 h-3 absolute', config.color)} />
                                            <div className={cn('w-3 h-3 rounded-full animate-ping opacity-30', config.color.replace('text-', 'bg-'))} />
                                        </div>
                                    ) : (
                                        <Icon className={cn('w-3 h-3 shrink-0', config.color)} />
                                    )}
                                    <span className={cn(
                                        'text-muted-foreground',
                                        isActive && 'text-foreground font-medium'
                                    )}>
                                        {event.message}
                                    </span>
                                    {event.type === 'coding' && event.message?.startsWith('Created') && (
                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 ml-auto shrink-0" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}

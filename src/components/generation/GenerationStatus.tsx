'use client';

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GenerationEvent } from '@/types';
import { cn } from '@/lib/utils';
import {
    Brain,
    Search,
    Code2,
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    Loader2,
} from 'lucide-react';

interface GenerationStatusProps {
    events: GenerationEvent[];
    isGenerating: boolean;
}

const eventConfig: Record<string, { icon: React.ElementType; color: string }> = {
    planning: { icon: Brain, color: 'text-purple-400' },
    analyzing: { icon: Search, color: 'text-blue-400' },
    coding: { icon: Code2, color: 'text-green-400' },
    reviewing: { icon: ShieldCheck, color: 'text-yellow-400' },
    complete: { icon: CheckCircle2, color: 'text-emerald-400' },
    error: { icon: AlertCircle, color: 'text-red-400' },
};

export default function GenerationStatus({ events, isGenerating }: GenerationStatusProps) {
    if (events.length === 0 && !isGenerating) return null;

    const latestEvent = events[events.length - 1];
    const progress = latestEvent?.progress ?? 0;

    return (
        <div className="border-t border-border bg-card/80">
            {/* Progress bar */}
            {isGenerating && (
                <div className="h-0.5 bg-border/50">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            <div className="px-4 py-2">
                <div className="flex items-center gap-2 mb-2">
                    {isGenerating ? (
                        <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className="text-xs font-medium">
                        {isGenerating ? 'Agent is working...' : 'Generation complete'}
                    </span>
                    {isGenerating && (
                        <span className="text-xs text-muted-foreground ml-auto">{progress}%</span>
                    )}
                </div>

                <ScrollArea className="max-h-32">
                    <div className="flex flex-col gap-1">
                        {events.map((event, i) => {
                            const config = eventConfig[event.type] || eventConfig.planning;
                            const Icon = config.icon;
                            const isLatest = i === events.length - 1;

                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        'flex items-center gap-2 text-xs py-0.5 transition-opacity',
                                        !isLatest && 'opacity-50'
                                    )}
                                >
                                    <Icon className={cn('w-3 h-3 shrink-0', config.color)} />
                                    <span className="text-muted-foreground">{event.message}</span>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}

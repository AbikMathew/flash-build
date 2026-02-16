'use client';

import React, { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Sparkles,
    Upload,
    Link2,
    X,
    ImageIcon,
    Globe,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { UploadedImage } from '@/types';

interface InputPanelProps {
    onGenerate: (prompt: string, images: UploadedImage[], urls: string[]) => void;
    isGenerating: boolean;
}

export default function InputPanel({ onGenerate, isGenerating }: InputPanelProps) {
    const [prompt, setPrompt] = useState('');
    const [images, setImages] = useState<UploadedImage[]>([]);
    const [urls, setUrls] = useState<string[]>([]);
    const [urlInput, setUrlInput] = useState('');
    const [isExpanded, setIsExpanded] = useState(true);

    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList) return;
        const newImages: UploadedImage[] = Array.from(fileList).map(file => ({
            id: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(file),
            name: file.name,
        }));
        setImages(prev => [...prev, ...newImages]);
    }, []);

    const removeImage = (id: string) => {
        setImages(prev => {
            const img = prev.find(i => i.id === id);
            if (img) URL.revokeObjectURL(img.previewUrl);
            return prev.filter(i => i.id !== id);
        });
    };

    const addUrl = () => {
        const trimmed = urlInput.trim();
        if (trimmed && !urls.includes(trimmed)) {
            setUrls(prev => [...prev, trimmed]);
            setUrlInput('');
        }
    };

    const removeUrl = (url: string) => {
        setUrls(prev => prev.filter(u => u !== url));
    };

    const handleSubmit = () => {
        if (!prompt.trim() && images.length === 0 && urls.length === 0) return;
        onGenerate(prompt, images, urls);
    };

    const inputCount = (prompt.trim() ? 1 : 0) + images.length + urls.length;

    return (
        <div className="flex flex-col h-full bg-card border-r border-border">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-semibold">Input</span>
                    {inputCount > 0 && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {inputCount}
                        </Badge>
                    )}
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
            </div>

            {isExpanded && (
                <ScrollArea className="flex-1">
                    <div className="flex flex-col gap-4 p-4">
                        {/* Prompt Section */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                Describe the app you want to build
                            </label>
                            <Textarea
                                placeholder="e.g. Build a modern dashboard with analytics charts, user stats, and a sidebar navigation..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="min-h-[120px] resize-none bg-background/50 border-border/50 focus:border-purple-500/50 transition-colors text-sm"
                            />
                        </div>

                        {/* Image Upload Section */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5" />
                                Screenshots / Reference Images
                            </label>
                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all">
                                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                                <span className="text-xs text-muted-foreground">Click or drag to upload</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                />
                            </label>
                            {images.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {images.map(img => (
                                        <div
                                            key={img.id}
                                            className="relative group rounded-md overflow-hidden border border-border"
                                        >
                                            <img
                                                src={img.previewUrl}
                                                alt={img.name}
                                                className="w-16 h-16 object-cover"
                                            />
                                            <button
                                                onClick={() => removeImage(img.id)}
                                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                            >
                                                <X className="w-4 h-4 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* URL Section */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5" />
                                Reference URLs
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="https://example.com"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addUrl()}
                                    className="bg-background/50 border-border/50 text-sm"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addUrl}
                                    className="shrink-0"
                                >
                                    <Link2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                            {urls.length > 0 && (
                                <div className="flex flex-col gap-1.5 mt-2">
                                    {urls.map(url => (
                                        <div
                                            key={url}
                                            className="flex items-center gap-2 text-xs bg-background/50 px-2 py-1.5 rounded-md border border-border/50"
                                        >
                                            <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                                            <span className="truncate flex-1">{url}</span>
                                            <button onClick={() => removeUrl(url)}>
                                                <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            )}

            {/* Generate Button */}
            <div className="p-4 border-t border-border">
                <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-purple-500/20 transition-all hover:shadow-purple-500/30 hover:-translate-y-0.5"
                    onClick={handleSubmit}
                    disabled={isGenerating || inputCount === 0}
                >
                    {isGenerating ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate App
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

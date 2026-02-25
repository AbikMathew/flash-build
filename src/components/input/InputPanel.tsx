'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
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
import { useProjectStore } from '@/store/useProjectStore';

interface InputPanelProps {
    onGenerate: (prompt: string, images: UploadedImage[], urls: string[]) => void;
    isGenerating: boolean;
}

const MAX_PROMPT_LENGTH = 5000;
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE_MB = 5;
const MAX_URLS = 3;

export default function InputPanel({ onGenerate, isGenerating }: InputPanelProps) {
    const prompt = useProjectStore((s) => s.inputPrompt);
    const images = useProjectStore((s) => s.inputImages);
    const urls = useProjectStore((s) => s.inputUrls);
    const setPrompt = useProjectStore((s) => s.setInputPrompt);
    const setImages = useProjectStore((s) => s.setInputImages);
    const setUrls = useProjectStore((s) => s.setInputUrls);

    const [urlInput, setUrlInput] = useState('');
    const [isExpanded, setIsExpanded] = useState(true);

    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList) return;

        const remaining = MAX_IMAGES - images.length;
        const filesToAdd = Array.from(fileList).slice(0, remaining);

        const validFiles = filesToAdd.filter(file => {
            if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
                alert(`${file.name} exceeds ${MAX_IMAGE_SIZE_MB}MB limit`);
                return false;
            }
            return true;
        });

        const newImages: UploadedImage[] = validFiles.map(file => ({
            id: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(file),
            name: file.name,
        }));
        setImages([...images, ...newImages]);
    }, [images, setImages]);

    const removeImage = (id: string) => {
        const img = images.find(i => i.id === id);
        if (img) URL.revokeObjectURL(img.previewUrl);
        setImages(images.filter(i => i.id !== id));
    };

    const addUrl = () => {
        if (urls.length >= MAX_URLS) return;
        const trimmed = urlInput.trim();
        if (trimmed && !urls.includes(trimmed)) {
            setUrls([...urls, trimmed]);
            setUrlInput('');
        }
    };

    const removeUrl = (url: string) => {
        setUrls(urls.filter(u => u !== url));
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
                                onChange={(e) => {
                                    if (e.target.value.length <= MAX_PROMPT_LENGTH) {
                                        setPrompt(e.target.value);
                                    }
                                }}
                                className="min-h-[120px] max-h-[200px] resize-none overflow-y-auto bg-background/50 border-border/50 focus:border-purple-500/50 transition-colors text-sm"
                            />
                            <div className="flex justify-end mt-1">
                                <span className={`text-xs ${prompt.length > MAX_PROMPT_LENGTH * 0.9 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                                    {prompt.length}/{MAX_PROMPT_LENGTH}
                                </span>
                            </div>
                        </div>

                        {/* Image Upload Section */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5" />
                                Screenshots / Reference Images
                            </label>
                            {images.length < MAX_IMAGES ? (
                                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all">
                                    <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                                    <span className="text-xs text-muted-foreground">Click or drag to upload</span>
                                    <span className="text-xs text-muted-foreground/60">{images.length}/{MAX_IMAGES} · Max {MAX_IMAGE_SIZE_MB}MB each</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/png,image/jpeg,image/webp"
                                        multiple
                                        onChange={handleImageUpload}
                                    />
                                </label>
                            ) : (
                                <div className="flex items-center justify-center w-full h-16 border-2 border-dashed border-yellow-500/30 rounded-lg bg-yellow-500/5">
                                    <span className="text-xs text-yellow-400">Maximum {MAX_IMAGES} images reached</span>
                                </div>
                            )}
                            {images.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {images.map(img => (
                                        <div
                                            key={img.id}
                                            className="relative group rounded-md overflow-hidden border border-border"
                                        >
                                            <Image
                                                src={img.previewUrl}
                                                alt={img.name}
                                                width={64}
                                                height={64}
                                                className="w-16 h-16 object-cover"
                                                unoptimized
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
                                    disabled={urls.length >= MAX_URLS}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addUrl}
                                    className="shrink-0"
                                    disabled={urls.length >= MAX_URLS}
                                >
                                    <Link2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                            {urls.length > 0 && (
                                <span className="text-xs text-muted-foreground/60">{urls.length}/{MAX_URLS} URLs</span>
                            )}
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

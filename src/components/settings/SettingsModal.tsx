'use client';

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, Key, AlertCircle } from 'lucide-react';
import { AIConfig, AIProvider } from '@/types';
import { AIGenerator } from '@/services/generator/AIGenerator';

interface SettingsModalProps {
    onConfigChange?: (config: AIConfig | null) => void;
}

function readInitialConfig(): AIConfig | null {
    if (typeof window === 'undefined') return null;
    return AIGenerator.getConfig();
}

export default function SettingsModal({ onConfigChange }: SettingsModalProps) {
    const initialConfig = readInitialConfig();
    const [open, setOpen] = useState(false);
    const [provider, setProvider] = useState<AIProvider>(initialConfig?.provider || 'anthropic');
    const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
    const [model, setModel] = useState(initialConfig?.model || '');

    const handleSave = () => {
        if (!apiKey.trim()) return;
        const config: AIConfig = {
            provider,
            apiKey: apiKey.trim(),
            model: model.trim() || undefined,
        };
        AIGenerator.saveConfig(config);
        onConfigChange?.(config);
        setOpen(false);
    };

    const handleClear = () => {
        AIGenerator.clearConfig();
        setApiKey('');
        setModel('');
        onConfigChange?.(null);
    };

    const defaultModels: Record<AIProvider, string> = {
        anthropic: 'claude-sonnet-4-20250514',
        openai: 'gpt-4o',
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1.5"
                >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Settings</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-purple-400" />
                        AI Configuration
                    </DialogTitle>
                    <DialogDescription>
                        Bring your own API key to enable real AI code generation.
                        Your key is stored locally in your browser.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Provider Select */}
                    <div className="space-y-2">
                        <Label htmlFor="provider">AI Provider</Label>
                        <Select
                            value={provider}
                            onValueChange={(v) => {
                                setProvider(v as AIProvider);
                                setModel('');
                            }}
                        >
                            <SelectTrigger id="provider">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="anthropic">
                                    Anthropic (Claude)
                                </SelectItem>
                                <SelectItem value="openai">
                                    OpenAI (GPT-4o)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* API Key */}
                    <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <Input
                            id="apiKey"
                            type="password"
                            placeholder={
                                provider === 'anthropic'
                                    ? 'sk-ant-...'
                                    : 'sk-...'
                            }
                            value={apiKey}
                            onChange={(e) => {
                                setApiKey(e.target.value);
                            }}
                        />
                        <p className="text-xs text-muted-foreground">
                            {provider === 'anthropic' ? (
                                <>Get your key from{' '}
                                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                                        console.anthropic.com
                                    </a>
                                </>
                            ) : (
                                <>Get your key from{' '}
                                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                                        platform.openai.com
                                    </a>
                                </>
                            )}
                        </p>
                    </div>

                    {/* Model Override */}
                    <div className="space-y-2">
                        <Label htmlFor="model">Model (optional)</Label>
                        <Input
                            id="model"
                            placeholder={`Default: ${defaultModels[provider]}`}
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave blank to use the recommended model.
                        </p>
                    </div>

                    {/* Cost info */}
                    <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 mb-1">
                            <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="font-medium text-foreground">Default quality guardrails</span>
                        </div>
                        Strict visual mode is enabled by default, with max 1 repair retry and a $0.25 run cap. Typical run cost is ~$0.12–$0.22. Your key remains in browser localStorage and is sent only to {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}.
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="text-red-400 hover:text-red-300"
                        disabled={!apiKey}
                    >
                        Clear Key
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!apiKey.trim()}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            Save Configuration
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileCode, FileText, FileJson, Image, ChevronRight, Folder, Download } from 'lucide-react';
import { ProjectFile } from '@/types';
import { cn } from '@/lib/utils';

interface FileExplorerProps {
    files: ProjectFile[];
    activeFilePath: string | null;
    onSelectFile: (path: string) => void;
}

function getFileIcon(path: string) {
    if (path.endsWith('.html')) return <FileCode className="w-3.5 h-3.5 text-orange-400" />;
    if (path.endsWith('.css')) return <FileText className="w-3.5 h-3.5 text-blue-400" />;
    if (path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.tsx'))
        return <FileCode className="w-3.5 h-3.5 text-yellow-400" />;
    if (path.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 text-green-400" />;
    if (path.match(/\.(png|jpg|svg|gif)$/)) return <Image className="w-3.5 h-3.5 text-pink-400" />;
    return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
}

export default function FileExplorer({ files, activeFilePath, onSelectFile }: FileExplorerProps) {
    // Build tree structure from flat file paths
    const tree = buildFileTree(files);

    return (
        <div className="flex flex-col h-full border-r border-border bg-card/50">
            <div className="px-3 py-2.5 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Explorer
                </span>
            </div>
            <ScrollArea className="flex-1">
                <div className="py-1">
                    {tree.map(node => (
                        <TreeNode
                            key={node.path}
                            node={node}
                            activeFilePath={activeFilePath}
                            onSelectFile={onSelectFile}
                            depth={0}
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

interface TreeNodeData {
    name: string;
    path: string;
    isDirectory: boolean;
    children: TreeNodeData[];
    file?: ProjectFile;
}

function TreeNode({
    node,
    activeFilePath,
    onSelectFile,
    depth,
}: {
    node: TreeNodeData;
    activeFilePath: string | null;
    onSelectFile: (path: string) => void;
    depth: number;
}) {
    const [isOpen, setIsOpen] = React.useState(true);

    if (node.isDirectory) {
        return (
            <div>
                <button
                    className="flex items-center gap-1.5 w-full px-2 py-1 text-xs hover:bg-accent/50 transition-colors text-muted-foreground"
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <ChevronRight
                        className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-90')}
                    />
                    <Folder className="w-3.5 h-3.5 text-blue-400" />
                    <span>{node.name}</span>
                </button>
                {isOpen &&
                    node.children.map(child => (
                        <TreeNode
                            key={child.path}
                            node={child}
                            activeFilePath={activeFilePath}
                            onSelectFile={onSelectFile}
                            depth={depth + 1}
                        />
                    ))}
            </div>
        );
    }

    return (
        <button
            className={cn(
                'group flex items-center gap-1.5 w-full px-2 py-1 text-xs transition-colors',
                activeFilePath === node.path
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground/80 hover:bg-accent/50'
            )}
            style={{ paddingLeft: `${depth * 12 + 20}px` }}
            onClick={() => onSelectFile(node.path)}
        >
            {getFileIcon(node.path)}
            <span className="truncate flex-1 text-left">{node.name}</span>
            {node.file && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (node.file) {
                            const blob = new Blob([node.file.content], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = node.file.path.split('/').pop() || 'file';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded transition-all text-muted-foreground hover:text-foreground"
                    title="Download file"
                >
                    <Download className="w-3 h-3" />
                </button>
            )}
        </button>
    );
}

function buildFileTree(files: ProjectFile[]): TreeNodeData[] {
    const root: TreeNodeData[] = [];

    files.forEach(file => {
        const parts = file.path.split('/');
        let current = root;

        parts.forEach((part, i) => {
            const isLast = i === parts.length - 1;
            const existing = current.find(n => n.name === part);

            if (existing) {
                current = existing.children;
            } else {
                const node: TreeNodeData = {
                    name: part,
                    path: parts.slice(0, i + 1).join('/'),
                    isDirectory: !isLast,
                    children: [],
                    file: isLast ? file : undefined,
                };
                current.push(node);
                current = node.children;
            }
        });
    });

    // Sort: directories first, then files alphabetically
    const sortTree = (nodes: TreeNodeData[]) => {
        nodes.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(n => sortTree(n.children));
    };
    sortTree(root);

    return root;
}

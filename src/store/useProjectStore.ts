import { create } from 'zustand';
import {
    ProjectFile,
    ProjectMetadata,
    GenerationStatus,
    GenerationEvent,
    WorkspaceView,
    ViewportSize,
} from '@/types';

interface ProjectState {
    // Project data
    files: ProjectFile[];
    activeFilePath: string | null;
    metadata: ProjectMetadata | null;
    previewHtml: string;

    // Generation status
    status: GenerationStatus;
    events: GenerationEvent[];
    error: string | null;

    // UI state
    workspaceView: WorkspaceView;
    viewportSize: ViewportSize;
    isSidebarOpen: boolean;

    // Actions - Project
    setFiles: (files: ProjectFile[]) => void;
    addFile: (file: ProjectFile) => void;
    updateFileContent: (path: string, content: string) => void;
    setActiveFile: (path: string | null) => void;
    setMetadata: (metadata: ProjectMetadata) => void;
    setPreviewHtml: (html: string) => void;
    resetProject: () => void;

    // Actions - Generation
    setStatus: (status: GenerationStatus) => void;
    addEvent: (event: GenerationEvent) => void;
    clearEvents: () => void;
    setError: (error: string | null) => void;

    // Actions - UI
    setWorkspaceView: (view: WorkspaceView) => void;
    setViewportSize: (size: ViewportSize) => void;
    toggleSidebar: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
    // Initial state
    files: [],
    activeFilePath: null,
    metadata: null,
    previewHtml: '',
    status: 'idle',
    events: [],
    error: null,
    workspaceView: 'split',
    viewportSize: 'desktop',
    isSidebarOpen: true,

    // Project actions
    setFiles: (files) =>
        set({ files, activeFilePath: files.length > 0 ? files[0].path : null }),
    addFile: (file) =>
        set((state) => ({ files: [...state.files, file] })),
    updateFileContent: (path, content) =>
        set((state) => ({
            files: state.files.map((f) =>
                f.path === path ? { ...f, content } : f
            ),
        })),
    setActiveFile: (path) => set({ activeFilePath: path }),
    setMetadata: (metadata) => set({ metadata }),
    setPreviewHtml: (html) => set({ previewHtml: html }),
    resetProject: () =>
        set({
            files: [],
            activeFilePath: null,
            metadata: null,
            previewHtml: '',
            status: 'idle',
            events: [],
            error: null,
        }),

    // Generation actions
    setStatus: (status) => set({ status }),
    addEvent: (event) =>
        set((state) => ({ events: [...state.events, event] })),
    clearEvents: () => set({ events: [] }),
    setError: (error) => set({ error }),

    // UI actions
    setWorkspaceView: (view) => set({ workspaceView: view }),
    setViewportSize: (size) => set({ viewportSize: size }),
    toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));

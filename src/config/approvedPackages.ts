import { OutputStack, PackageManifest } from '@/types';

export const HEAVY_PACKAGES = new Set([
  'monaco-editor',
  '@monaco-editor/react',
  '@mui/x-data-grid',
  'ag-grid-react',
  'ag-grid-community',
  'handsontable',
  '@handsontable/react',
  'react-data-grid',
  'fabric',
  'konva',
  'react-konva',
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  'pptxgenjs',
]);

export const PACKAGE_ALIASES: Record<string, string> = {
  'react-table': '@tanstack/react-table',
  'chartjs': 'chart.js',
  'react-chartjs': 'react-chartjs-2',
};

export const APPROVED_PACKAGES = new Set([
  'react',
  'react-dom',
  'react-icons',
  'react-router-dom',
  'zustand',
  'framer-motion',
  'clsx',
  'tailwind-merge',
  'lucide-react',
  'date-fns',
  'dayjs',
  'lodash',
  'zod',
  'axios',
  '@tanstack/react-query',
  '@tanstack/react-table',
  'chart.js',
  'react-chartjs-2',
  'recharts',
  'd3',
  '@mui/material',
  '@mui/icons-material',
  '@emotion/react',
  '@emotion/styled',
  'antd',
  '@chakra-ui/react',
  '@headlessui/react',
  '@heroicons/react',
  '@floating-ui/react',
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  'react-hook-form',
  '@hookform/resolvers',
  'yup',
  'react-select',
  'react-virtualized',
  'react-window',
  'ag-grid-react',
  'ag-grid-community',
  '@mui/x-data-grid',
  'react-data-grid',
  'handsontable',
  '@handsontable/react',
  'react-pdf',
  'pdfjs-dist',
  'quill',
  'react-quill',
  '@tiptap/react',
  '@tiptap/starter-kit',
  'slate',
  'slate-react',
  'fabric',
  'konva',
  'react-konva',
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  'tailwindcss',
  '@tailwindcss/postcss',
  'postcss',
  'autoprefixer',
  'vite',
  '@vitejs/plugin-react',
  'typescript',
]);

const REACT_FULL_MANIFEST: PackageManifest = {
  framework: 'react-tailwind',
  entry: '/src/main.tsx',
  scripts: {
    dev: 'vite',
    build: 'vite build',
    preview: 'vite preview',
  },
  dependencies: {
    react: '^19.2.0',
    'react-dom': '^19.2.0',
  },
  devDependencies: {
    typescript: '^5.8.0',
    vite: '^5.4.0',
    '@vitejs/plugin-react': '^4.3.0',
    tailwindcss: '^4.1.0',
    '@tailwindcss/postcss': '^4.1.0',
  },
};

const VANILLA_FULL_MANIFEST: PackageManifest = {
  framework: 'vanilla',
  entry: '/index.html',
  scripts: {
    dev: 'npx serve .',
  },
  dependencies: {},
  devDependencies: {},
};

export function getBaseManifest(outputStack: OutputStack): PackageManifest {
  return outputStack === 'react-tailwind'
    ? {
      framework: REACT_FULL_MANIFEST.framework,
      entry: REACT_FULL_MANIFEST.entry,
      scripts: { ...REACT_FULL_MANIFEST.scripts },
      dependencies: { ...REACT_FULL_MANIFEST.dependencies },
      devDependencies: { ...REACT_FULL_MANIFEST.devDependencies },
    }
    : {
      framework: VANILLA_FULL_MANIFEST.framework,
      entry: VANILLA_FULL_MANIFEST.entry,
      scripts: { ...VANILLA_FULL_MANIFEST.scripts },
      dependencies: { ...VANILLA_FULL_MANIFEST.dependencies },
      devDependencies: { ...VANILLA_FULL_MANIFEST.devDependencies },
    };
}

import { ProjectFile } from '@/types';

/**
 * Preview Service - bundles project files into renderable HTML for iframe preview.
 * Abstracted so we can swap from srcdoc → WebContainers later.
 */
export class PreviewService {
    /**
     * Bundle project files into a single self-contained HTML string.
     * Handles multi-file projects by inlining CSS and JS.
     */
    static bundle(files: ProjectFile[]): string {
        const htmlFile = files.find(f => f.path.endsWith('.html'));
        const cssFiles = files.filter(f => f.path.endsWith('.css'));
        const jsFiles = files.filter(f => f.path.endsWith('.js'));

        if (!htmlFile) {
            // Fallback: create a simple HTML wrapper from available files
            const css = cssFiles.map(f => f.content).join('\n');
            const js = jsFiles.map(f => f.content).join('\n');
            return `<!DOCTYPE html><html><head><style>${css}</style></head><body><script>${js}<\/script></body></html>`;
        }

        let html = htmlFile.content;

        // Inline all CSS files
        cssFiles.forEach(cssFile => {
            const linkRegex = new RegExp(
                `<link[^>]*href=["']${cssFile.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
                'i'
            );
            html = html.replace(linkRegex, `<style>\n${cssFile.content}\n</style>`);
        });

        // Inline all JS files
        jsFiles.forEach(jsFile => {
            const scriptRegex = new RegExp(
                `<script[^>]*src=["']${jsFile.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*><\\/script>`,
                'i'
            );
            html = html.replace(scriptRegex, `<script>\n${jsFile.content}\n<\/script>`);
        });

        return html;
    }
}

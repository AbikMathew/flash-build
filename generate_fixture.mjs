import fs from 'fs';
import http from 'http';

async function generateFixture() {
    console.log('Sending request to local API...');

    const postData = JSON.stringify({
        prompt: 'Create a youtube clone app',
        images: [],
        urls: [],
        outputStack: 'react-tailwind',
        qualityMode: 'strict_visual',
        constraints: { maxRetries: 1, maxCostUsd: 0.25 },
        previewRuntimePreference: 'auto',
        exportMode: 'full-project'
    });

    const options = {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/generate',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let finalProject = null;
        let buffer = '';

        res.on('data', (chunk) => {
            buffer += chunk.toString();

            // Process SSE lines
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (let line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.type === 'complete' && data.project) {
                            finalProject = data.project;
                        } else if (data.type === 'file') {
                            console.log('Received file:', data.file.path);
                        } else if (data.type === 'status') {
                            console.log('Status:', data.message);
                        }
                    } catch (e) {
                        // Ignore parse errors for partial/malformed data chunks
                    }
                }
            }
        });

        res.on('end', () => {
            if (finalProject) {
                console.log('Generation complete! Saving fixture...');

                // Format the fixture file
                let content = `// Auto-generated test fixture for YouTube Clone\nimport { ProjectFile } from '@/types';\n\nexport const YOUTUBE_CLONE_FIXTURE: ProjectFile[] = [\n`;

                for (const file of finalProject.files) {
                    content += `  {\n`;
                    content += `    path: ${JSON.stringify(file.path)},\n`;
                    content += `    language: ${JSON.stringify(file.language)},\n`;
                    content += `    content: \`${file.content.replace(/\\/g, '\\\\').replace(/\`/g, '\\`').replace(/\\$/g, '\\\\$')}\`\n`;
                    content += `  },\n`;
                }

                content += `];\n`;

                fs.writeFileSync('./src/services/preview/runtime/YouTubeCloneFixture.ts', content);
                console.log('Saved to src/services/preview/runtime/YouTubeCloneFixture.ts');
            } else {
                console.log('Failed to capture final project from stream.');
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

generateFixture();

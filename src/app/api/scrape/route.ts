import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const MAX_SCRAPE_LENGTH = 10000;

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        console.log(`Scraping URL: ${url}`);

        // Fetch content with a realistic User-Agent to avoid blocks
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            return NextResponse.json({
                error: `Failed to fetch URL: ${response.status} ${response.statusText}`
            }, { status: response.status });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove scripts, styles, and other non-content elements
        $('script, style, noscript, iframe, svg, img, video, audio, link[rel="stylesheet"]').remove();

        // Extract key metadata
        const title = $('title').text().trim();
        const description = $('meta[name="description"]').attr('content') ||
            $('meta[property="og:description"]').attr('content') || '';

        // Extract main content
        // Focus on main, article, or body if structured
        let contentEl = $('main');
        if (contentEl.length === 0) contentEl = $('article');
        if (contentEl.length === 0) contentEl = $('body');

        // Clean up text content
        let textContent = contentEl.text()
            .replace(/\s+/g, ' ')
            .trim();

        // Truncate to avoid token limits
        if (textContent.length > MAX_SCRAPE_LENGTH) {
            textContent = textContent.substring(0, MAX_SCRAPE_LENGTH) + '... (truncated)';
        }

        return NextResponse.json({
            title,
            description,
            content: textContent,
            url
        });

    } catch (error) {
        console.error('Scraping error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown scraping error'
        }, { status: 500 });
    }
}

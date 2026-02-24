import { NextRequest, NextResponse } from 'next/server';
import { ingestUrlReference } from '@/services/generation/pipeline/ingestReferences';

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only https:// URLs are allowed' }, { status: 400 });
    }

    const reference = await ingestUrlReference(parsed.toString());
    return NextResponse.json({
      url: reference.url,
      finalUrl: reference.finalUrl,
      title: reference.title,
      description: reference.description,
      content: reference.textSnippet,
      domSummary: reference.domSummary,
      styleTokens: reference.styleTokens,
      interactionHints: reference.interactionHints,
      referenceConfidence: reference.jsHeavyLikely ? 0.55 : 0.75,
      screenshotCaptured: Boolean(reference.screenshot),
      warnings: reference.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown scraping error' },
      { status: 500 }
    );
  }
}


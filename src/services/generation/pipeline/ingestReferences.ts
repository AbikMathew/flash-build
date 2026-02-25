import dns from 'node:dns/promises';
import net from 'node:net';
import * as cheerio from 'cheerio';
import { GenerateAPIRequest, ReferenceBundle, ReferenceScreenshot } from '@/types';

const MAX_HTML_BYTES = 1_000_000;
const MAX_IMAGE_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_TEXT_SNIPPET = 4_000;
const MAX_STYLE_TOKENS = 80;
const MAX_INTERACTION_HINTS = 40;

export interface IngestedUrlReference {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  domSummary: string;
  textSnippet: string;
  styleTokens: string[];
  interactionHints: string[];
  jsHeavyLikely: boolean;
  screenshot?: ReferenceScreenshot;
  warnings: string[];
}

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]);

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;

  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) return isPrivateIPv4(address);
  if (net.isIPv6(address)) return isPrivateIPv6(address);
  return true;
}

async function assertSafeRemote(url: URL): Promise<void> {
  if (url.protocol !== 'https:') {
    throw new Error('Only https:// URLs are allowed');
  }
  const hostname = url.hostname.toLowerCase();
  if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    throw new Error('Local and private hosts are not allowed');
  }
  if (net.isIP(hostname) && isPrivateAddress(hostname)) {
    throw new Error('Private network addresses are not allowed');
  }

  try {
    const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
    if (resolved.some((entry) => isPrivateAddress(entry.address))) {
      throw new Error('Resolved host points to a private network address');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('private')) {
      throw error;
    }
    throw new Error('Unable to resolve host safely. Please verify the URL is public and reachable.');
  }
}

async function fetchTextWithLimit(url: URL, maxBytes: number, timeoutMs: number, depth = 0): Promise<{ finalUrl: string; contentType: string; body: string }> {
  if (depth > 2) throw new Error('Too many redirects');
  await assertSafeRemote(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'FlashBuildBot/1.0 (+https://flashbuild.local)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without location');
      const nextUrl = new URL(location, url);
      return fetchTextWithLimit(nextUrl, maxBytes, timeoutMs, depth + 1);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch URL (${response.status})`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) throw new Error(`Response exceeds ${maxBytes} byte limit`);
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    return {
      finalUrl: url.toString(),
      contentType,
      body: buffer.toString('utf-8'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractStyleTokens($: cheerio.CheerioAPI): string[] {
  const styleBlocks = $('style').map((_, el) => $(el).text()).get().join('\n');
  const inlineStyles = $('[style]').map((_, el) => $(el).attr('style') ?? '').get().join(';');
  const styleCorpus = `${styleBlocks}\n${inlineStyles}`;

  const colorMatches = styleCorpus.match(/#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g) ?? [];
  const fontMatches = styleCorpus.match(/font-family\s*:\s*[^;}\n]+/gi) ?? [];
  const spacingMatches = styleCorpus.match(/(?:margin|padding|gap|border-radius)\s*:\s*[^;}\n]+/gi) ?? [];
  const cssVarMatches = styleCorpus.match(/--[a-z0-9-_]+\s*:\s*[^;}\n]+/gi) ?? [];

  const classHints = ($('[class]')
    .map((_, el) => $(el).attr('class') ?? '')
    .get()
    .join(' ')
    .match(/\b(navbar|sidebar|hero|card|grid|flex|modal|form|table|badge|button)\b/gi) ?? [])
    .map((token) => token.toLowerCase());

  return uniq([
    ...colorMatches.map((token) => token.toLowerCase()),
    ...fontMatches.map((token) => token.toLowerCase()),
    ...spacingMatches.map((token) => token.toLowerCase()),
    ...cssVarMatches.map((token) => token.toLowerCase()),
    ...classHints,
  ])
    .map((token) => token.replace(/\s+/g, ' ').trim())
    .filter((token) => token.length > 0 && token.length <= 120)
    .slice(0, MAX_STYLE_TOKENS);
}

function extractInteractionHints($: cheerio.CheerioAPI): string[] {
  const hints: string[] = [];

  $('button, [role="button"]').each((_, el) => {
    const label = $(el).text().trim() || $(el).attr('aria-label') || $(el).attr('title');
    if (label) hints.push(`button:${label}`);
  });

  $('a[href]').each((_, el) => {
    const label = $(el).text().trim();
    if (label) hints.push(`link:${label}`);
  });

  $('form').each((_, formEl) => {
    const inputCount = $(formEl).find('input,select,textarea').length;
    hints.push(`form:${inputCount}-fields`);
  });

  return uniq(hints).slice(0, MAX_INTERACTION_HINTS);
}

function summarizeDom($: cheerio.CheerioAPI): string {
  const sectionCount = $('section, article, main').length;
  const navCount = $('nav').length;
  const formCount = $('form').length;
  const buttonCount = $('button, [role="button"]').length;
  const headingCount = $('h1, h2, h3').length;
  const cardLikeCount = $('[class*="card"], [class*="tile"], [class*="panel"]').length;

  return [
    `${sectionCount} major sections`,
    `${navCount} nav blocks`,
    `${formCount} forms`,
    `${buttonCount} buttons`,
    `${headingCount} headings`,
    `${cardLikeCount} card-like components`,
  ].join(', ');
}

function textSnippetFrom($: cheerio.CheerioAPI): string {
  const text = $('main, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > MAX_TEXT_SNIPPET ? `${text.slice(0, MAX_TEXT_SNIPPET)}...` : text;
}

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; base64: string } | null> {
  const parsed = new URL(url);
  await assertSafeRemote(parsed);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'User-Agent': 'FlashBuildBot/1.0' },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) return null;
    return {
      mimeType: contentType,
      base64: Buffer.from(arrayBuffer).toString('base64'),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFirecrawlScreenshot(url: string): Promise<ReferenceScreenshot | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['html', 'screenshot'],
      onlyMainContent: false,
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    data?: {
      screenshot?: string | { url?: string; data?: string };
    };
  };

  const screenshot = data.data?.screenshot;
  if (!screenshot) return null;

  const screenshotValue =
    typeof screenshot === 'string'
      ? screenshot
      : screenshot.data ?? screenshot.url ?? '';
  if (!screenshotValue) return null;

  if (screenshotValue.startsWith('data:image/')) {
    const [prefix, payload] = screenshotValue.split(',', 2);
    const mimeType = prefix.match(/^data:(.+);base64$/)?.[1] ?? 'image/png';
    if (!payload) return null;
    return {
      source: 'url',
      origin: url,
      mimeType,
      base64: payload,
    };
  }

  if (screenshotValue.startsWith('https://')) {
    const image = await fetchImageAsBase64(screenshotValue);
    if (!image) return null;
    return {
      source: 'url',
      origin: url,
      mimeType: image.mimeType,
      base64: image.base64,
    };
  }

  return null;
}

export async function ingestUrlReference(rawUrl: string): Promise<IngestedUrlReference> {
  const url = new URL(rawUrl);
  const warnings: string[] = [];
  const { finalUrl, body: html } = await fetchTextWithLimit(url, MAX_HTML_BYTES, REQUEST_TIMEOUT_MS);

  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();
  const description = $('meta[name="description"]').attr('content')
    || $('meta[property="og:description"]').attr('content')
    || '';
  const styleTokens = extractStyleTokens($);
  const interactionHints = extractInteractionHints($);
  const domSummary = summarizeDom($);
  const textSnippet = textSnippetFrom($);

  const scriptCount = $('script').length;
  const bodyTextLength = $('body').text().trim().length;
  const jsHeavyLikely = scriptCount > 15 && bodyTextLength < 400;
  if (jsHeavyLikely) {
    warnings.push(
      `Reference "${url.hostname}" appears to be a JavaScript-heavy SPA (${scriptCount} scripts, minimal server-rendered HTML). ` +
      'Static HTML scraping captured limited visual/content data. For much better results: ' +
      '(1) upload a screenshot of the page as a reference image, or ' +
      '(2) set FIRECRAWL_API_KEY in your environment for rendered screenshot capture.',
    );
  }

  let screenshot: ReferenceScreenshot | undefined;
  try {
    screenshot = (await fetchFirecrawlScreenshot(finalUrl)) ?? undefined;
  } catch {
    warnings.push('Firecrawl enrichment failed; continuing with static DOM extraction.');
  }

  return {
    url: rawUrl,
    finalUrl,
    title,
    description,
    domSummary,
    textSnippet,
    styleTokens,
    interactionHints,
    jsHeavyLikely,
    screenshot,
    warnings,
  };
}

export async function ingestReferences(request: GenerateAPIRequest): Promise<ReferenceBundle> {
  const warnings: string[] = [];
  const referenceScreenshots: ReferenceScreenshot[] = request.images.map((img) => ({
    source: 'upload',
    mimeType: img.mimeType,
    base64: img.base64,
  }));

  const styleTokens: string[] = [];
  const interactionHints: string[] = [];
  const domSegments: string[] = [];

  for (const rawUrl of request.urls) {
    try {
      const ref = await ingestUrlReference(rawUrl);
      styleTokens.push(...ref.styleTokens);
      interactionHints.push(...ref.interactionHints);
      domSegments.push(
        `URL: ${ref.finalUrl}\nTitle: ${ref.title}\nDescription: ${ref.description}\nDOM: ${ref.domSummary}\nText: ${ref.textSnippet}`
      );
      warnings.push(...ref.warnings);
      if (ref.screenshot) {
        referenceScreenshots.push(ref.screenshot);
      }
    } catch (error) {
      warnings.push(
        `Failed to ingest ${rawUrl}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  if (request.urls.length > 0 && referenceScreenshots.length === request.images.length) {
    warnings.push('No URL screenshots were captured. Upload at least one screenshot for strict visual matching.');
  }

  const hasPrompt = Boolean(request.prompt.trim());
  const hasScreenshot = referenceScreenshots.length > 0;
  const hasUrlContext = domSegments.length > 0;
  const hasStyle = styleTokens.length >= 8;
  const hasInteraction = interactionHints.length >= 5;

  let confidence = 0;
  if (hasPrompt) confidence += 0.25;
  if (hasScreenshot) confidence += 0.3;
  if (hasUrlContext) confidence += 0.25;
  if (hasStyle) confidence += 0.1;
  if (hasInteraction) confidence += 0.1;
  confidence = Math.max(0.1, Math.min(0.99, Number(confidence.toFixed(2))));

  return {
    prompt: request.prompt,
    referenceScreenshots,
    domSummary: domSegments.join('\n\n'),
    styleTokens: uniq(styleTokens).slice(0, MAX_STYLE_TOKENS),
    interactionHints: uniq(interactionHints).slice(0, MAX_INTERACTION_HINTS),
    referenceConfidence: confidence,
    warnings: uniq(warnings),
  };
}

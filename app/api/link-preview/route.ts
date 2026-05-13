import { NextRequest, NextResponse } from "next/server";

export const revalidate = 86400;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
]);

function isBlockedHost(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  // Block private IPv4 ranges
  const v4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [, a, b] = v4.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

function attr(html: string, name: string): string {
  const re = new RegExp(`${name}=["']([^"']+)["']`, "i");
  return html.match(re)?.[1] ?? "";
}

function extractMeta(html: string, property: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

function resolveUrl(base: string, relative: string): string {
  if (!relative) return "";
  if (/^https?:\/\//i.test(relative)) return relative;
  try {
    return new URL(relative, base).href;
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: true }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: true }, { status: 400 });
  }

  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: true }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(parsed.href, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FBI-EmbajadoresBot/1.0; +link-preview)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json({ error: true }, { status: 200 });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ error: true }, { status: 200 });
    }

    // Read at most 512 KB to avoid memory issues
    const reader = res.body?.getReader();
    const MAX = 512 * 1024;
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.byteLength;
        if (total >= MAX) { reader.cancel(); break; }
      }
    }
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { combined.set(c, offset); offset += c.byteLength; }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(combined);

    const finalUrl = res.url || parsed.href;

    const ogTitle = extractMeta(html, "og:title");
    const ogDescription = extractMeta(html, "og:description");
    const ogImage = extractMeta(html, "og:image");
    const ogSiteName = extractMeta(html, "og:site_name");

    const titleMatch = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
    const fallbackTitle = titleMatch?.[1]?.trim() ?? "";

    const title = ogTitle || fallbackTitle;
    const description = ogDescription;
    const image = resolveUrl(finalUrl, ogImage);
    const siteName = ogSiteName || parsed.hostname.replace(/^www\./, "");
    const url = finalUrl;

    const payload = { title, description, image, siteName, url };
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    clearTimeout(timer);
    return NextResponse.json({ error: true }, { status: 200 });
  }
}

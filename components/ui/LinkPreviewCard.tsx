"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

type PreviewData = {
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
};

// Module-level cache so the same URL is only fetched once per page session
const previewCache = new Map<string, Promise<PreviewData | null>>();

async function fetchPreview(url: string): Promise<PreviewData | null> {
  try {
    const res = await fetch(
      `/api/link-preview?url=${encodeURIComponent(url)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !data.title) return null;
    return data as PreviewData;
  } catch {
    return null;
  }
}

function getOrFetch(url: string): Promise<PreviewData | null> {
  if (!previewCache.has(url)) {
    previewCache.set(url, fetchPreview(url));
  }
  return previewCache.get(url)!;
}

export default function LinkPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<PreviewData | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    getOrFetch(url).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => { cancelled = true; };
  }, [url]);

  if (data === "loading") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-3 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 overflow-hidden no-underline hover:border-gold/30 transition-colors"
      >
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3 w-3/4 rounded bg-gray-100 animate-pulse" />
          <div className="h-2.5 w-1/2 rounded bg-gray-100 animate-pulse" />
          <div className="h-2 w-1/3 rounded bg-gray-100 animate-pulse" />
        </div>
        <div className="h-16 w-16 flex-shrink-0 rounded-xl bg-gray-100 animate-pulse" />
      </a>
    );
  }

  if (!data) {
    // No OG data — still make the URL clickable as a plain link chip
    let displayHost = url;
    try { displayHost = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-navy-dark/70 hover:border-gold/40 hover:text-gold transition-colors max-w-full overflow-hidden"
      >
        <ExternalLink size={11} className="flex-shrink-0" />
        <span className="truncate">{displayHost}</span>
      </a>
    );
  }

  const hasImage = Boolean(data.image);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-3 flex items-stretch gap-0 rounded-2xl border border-gray-100 bg-white overflow-hidden hover:border-gold/30 transition-colors no-underline group"
    >
      {hasImage && (
        <div className="flex-shrink-0 w-24 sm:w-28 relative bg-gray-50">
          <img
            src={data.image}
            alt={data.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center gap-0.5">
        <p className="text-[10px] font-semibold text-gold uppercase tracking-wide truncate">
          {data.siteName}
        </p>
        {data.title && (
          <p className="text-xs font-bold text-navy-dark leading-snug line-clamp-2 group-hover:text-gold transition-colors">
            {data.title}
          </p>
        )}
        {data.description && (
          <p className="text-[11px] text-navy-dark/50 leading-snug line-clamp-2 mt-0.5">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}

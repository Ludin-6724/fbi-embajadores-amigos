export const YT_REGEX =
  /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#][^\s]*)?/i;

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

export function extractFirstUrl(content: string): string | null {
  const matches = content.match(URL_REGEX);
  if (!matches) return null;
  for (const match of matches) {
    if (!YT_REGEX.test(match)) return match;
  }
  return null;
}

export type Segment = { type: "text" | "url"; value: string };

export function linkify(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  URL_REGEX.lastIndex = 0;
  const re = new RegExp(URL_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, m.index) });
    }
    segments.push({ type: "url", value: m[0] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: "text", value: content }];
}

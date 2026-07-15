import { createHash } from "node:crypto";

import type { SourceChunk } from "@/features/research/domain";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
]);

export const canonicalizeUrl = (rawUrl: string) => {
  const url = new URL(rawUrl);
  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  const sortedParams = Array.from(url.searchParams.entries())
    .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([left], [right]) => left.localeCompare(right));

  url.search = "";
  for (const [key, value] of sortedParams) {
    url.searchParams.append(key, value);
  }

  return url.toString();
};

export const extractDomain = (rawUrl: string) => new URL(rawUrl).hostname.toLowerCase();

export const createContentHash = (body: string) => {
  const normalizedBody = body.trim().replace(/\s+/g, " ");

  return `sha256_${createHash("sha256").update(normalizedBody).digest("hex")}`;
};

export const chunkSourceText = ({
  sourceId,
  projectId,
  text,
}: {
  sourceId: string;
  projectId: string;
  text: string;
}): SourceChunk[] => {
  const paragraphs = Array.from(text.matchAll(/\S[\s\S]*?(?=\n\n|$)/g));

  return paragraphs.map((match, chunkIndex) => {
    const chunkText = match[0].trimEnd();
    const startChar = match.index ?? 0;

    return {
      id: `${sourceId}_chunk_${chunkIndex}`,
      sourceId,
      projectId,
      chunkIndex,
      text: chunkText,
      startChar,
      endChar: startChar + chunkText.length,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
    };
  });
};

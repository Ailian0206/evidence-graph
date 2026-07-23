import { createHash } from "node:crypto";

import {
  currentEmbeddingModel,
  type SourceChunk,
} from "@/features/research/domain";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
]);
const MIN_CHUNK_CHARACTERS = 800;
const MAX_CHUNK_CHARACTERS = 1200;

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

  const slices = paragraphs.flatMap((match) => {
    const paragraph = match[0].trimEnd();
    const paragraphStart = match.index ?? 0;
    const chunkCount = Math.ceil(paragraph.length / MAX_CHUNK_CHARACTERS);
    const balancedSize = Math.floor(paragraph.length / chunkCount);
    const sizes: number[] = [];

    if (balancedSize >= MIN_CHUNK_CHARACTERS) {
      const remainder = paragraph.length % chunkCount;

      for (let index = 0; index < chunkCount; index += 1) {
        sizes.push(balancedSize + (index < remainder ? 1 : 0));
      }
    } else {
      // Keep indivisible paragraphs whole instead of creating a sub-800 character tail.
      sizes.push(paragraph.length);
    }

    let localOffset = 0;
    return sizes.map((size) => {
      const startChar = paragraphStart + localOffset;
      const chunkText = paragraph.slice(localOffset, localOffset + size);
      localOffset += size;

      return { chunkText, startChar };
    });
  });

  return slices.map(({ chunkText, startChar }, chunkIndex) => {

    return {
      id: `${sourceId}_chunk_${chunkIndex}`,
      sourceId,
      projectId,
      chunkIndex,
      text: chunkText,
      startChar,
      endChar: startChar + chunkText.length,
      embeddingModel: currentEmbeddingModel,
      embeddingDimensions: 1536,
    };
  });
};

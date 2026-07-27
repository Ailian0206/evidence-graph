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
  const sourceCharacters = Array.from(text);
  const paragraphs = Array.from(text.matchAll(/\S[\s\S]*?(?=\n\n|$)/g));
  let sourceCodePointOffset = 0;
  let sourceUtf16Offset = 0;

  const paragraphSlices = paragraphs.flatMap((match) => {
    const paragraph = match[0].trimEnd();
    const paragraphCharacters = Array.from(paragraph);
    const matchStart = match.index ?? 0;
    sourceCodePointOffset += Array.from(text.slice(sourceUtf16Offset, matchStart)).length;
    const paragraphStart = sourceCodePointOffset;
    sourceUtf16Offset = matchStart + match[0].length;
    sourceCodePointOffset += Array.from(match[0]).length;
    const chunkCount = Math.ceil(paragraphCharacters.length / MAX_CHUNK_CHARACTERS);
    const balancedSize = Math.floor(paragraphCharacters.length / chunkCount);
    const sizes: number[] = [];

    if (balancedSize >= MIN_CHUNK_CHARACTERS) {
      const remainder = paragraphCharacters.length % chunkCount;

      for (let index = 0; index < chunkCount; index += 1) {
        sizes.push(balancedSize + (index < remainder ? 1 : 0));
      }
    } else {
      // Keep indivisible paragraphs whole instead of creating a sub-800 character tail.
      sizes.push(paragraphCharacters.length);
    }

    let localOffset = 0;
    return sizes.map((size) => {
      const startChar = paragraphStart + localOffset;
      localOffset += size;

      return { startChar, endChar: startChar + size };
    });
  });

  // Pack adjacent short paragraphs while keeping every chunk an exact source slice.
  const slices = paragraphSlices.reduce<Array<{ startChar: number; endChar: number }>>(
    (merged, current) => {
      const previous = merged.at(-1);
      const currentLength = current.endChar - current.startChar;

      if (
        previous &&
        currentLength < MIN_CHUNK_CHARACTERS &&
        current.endChar - previous.startChar <= MAX_CHUNK_CHARACTERS
      ) {
        previous.endChar = current.endChar;
        return merged;
      }

      merged.push({ ...current });
      return merged;
    },
    [],
  );

  return slices.map(({ startChar, endChar }, chunkIndex) => {

    return {
      id: `${sourceId}_chunk_${chunkIndex}`,
      sourceId,
      projectId,
      chunkIndex,
      text: sourceCharacters.slice(startChar, endChar).join(""),
      startChar,
      endChar,
      embeddingModel: currentEmbeddingModel,
      embeddingDimensions: 1536,
    };
  });
};

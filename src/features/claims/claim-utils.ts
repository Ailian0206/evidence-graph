export type ExactQuoteValidationResult =
  | { ok: true; startChar: number; endChar: number }
  | { ok: false; reason: "QUOTE_NOT_FOUND" };

export const createClaimKey = (statement: string) =>
  statement
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, "")
    .replace(/\s+/g, " ");

export const validateExactQuote = ({
  chunkText,
  quote,
}: {
  chunkText: string;
  quote: string;
}): ExactQuoteValidationResult => {
  const startChar = chunkText.indexOf(quote);

  if (startChar === -1) {
    return { ok: false, reason: "QUOTE_NOT_FOUND" };
  }

  return { ok: true, startChar, endChar: startChar + quote.length };
};

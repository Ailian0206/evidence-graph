export type ExactQuoteValidationResult =
  | { ok: true; startChar: number; endChar: number }
  | { ok: false; reason: "QUOTE_NOT_FOUND" };

export const createClaimKey = (statement: string) =>
  statement
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[.,!?;:，。！？；：]+|[.,!?;:，。！？；：]+$/gu, "");

export const validateExactQuote = ({
  chunkText,
  quote,
}: {
  chunkText: string;
  quote: string;
}): ExactQuoteValidationResult => {
  if (quote.trim().length === 0) {
    return { ok: false, reason: "QUOTE_NOT_FOUND" };
  }

  const startChar = chunkText.indexOf(quote);

  if (startChar === -1) {
    return { ok: false, reason: "QUOTE_NOT_FOUND" };
  }

  return { ok: true, startChar, endChar: startChar + quote.length };
};

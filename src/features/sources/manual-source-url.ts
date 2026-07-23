import { z } from "zod";

const isExternalHttpUrl = (value: string) => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.startsWith("127.") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.endsWith(".local");

  return (url.protocol === "http:" || url.protocol === "https:") && !isLocal;
};

export const manualSourceUrlSchema = z
  .string()
  .url()
  .refine(isExternalHttpUrl, "MANUAL_SOURCE_URL_INVALID");

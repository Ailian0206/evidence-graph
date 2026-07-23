import "server-only";

export type ProviderFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

export const providerHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "content-type": "application/json",
});

export const readProviderJson = async (response: Response, errorCode: string) => {
  if (!response.ok) {
    throw new Error(errorCode);
  }

  try {
    return await response.json();
  } catch {
    throw new Error("PROVIDER_RESPONSE_INVALID");
  }
};

const isTimeoutError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  (error.name === "AbortError" || error.name === "TimeoutError");

export const requestProviderJson = async ({
  fetchImpl,
  input,
  init,
  errorCode,
}: {
  fetchImpl: ProviderFetch;
  input: RequestInfo | URL;
  init: RequestInit;
  errorCode: string;
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(input, { ...init, signal: controller.signal });
    return await readProviderJson(response, errorCode);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === errorCode || error.message === "PROVIDER_RESPONSE_INVALID")
    ) {
      throw error;
    }

    if (controller.signal.aborted || isTimeoutError(error)) {
      throw new Error("PROVIDER_REQUEST_TIMEOUT");
    }

    throw new Error(errorCode);
  } finally {
    clearTimeout(timeout);
  }
};

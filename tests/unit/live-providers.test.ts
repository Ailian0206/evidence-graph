import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createBailianEmbeddingProvider } from "@/providers/live/bailian-embedding-provider";
import { createDeepSeekLanguageModel } from "@/providers/live/deepseek-language-model";
import { modelSystemPrompt } from "@/providers/live/model-prompts";
import {
  createPaidProviderSmokeBudget,
  readPaidProviderSmokeEnvironment,
  runPaidProviderSmokeSequence,
} from "@/providers/live/smoke-gate";
import { createTavilySearchProvider } from "@/providers/live/tavily-provider";
import {
  createPaidProviderSmokeRuntime,
  createResearchProviders,
} from "@/providers/runtime";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Tavily live Provider", () => {
  it("maps search results and usage without leaking the API key", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe("https://api.tavily.com/search");
      expect(init?.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer tavily-secret" }),
      );
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        query: "traceable research",
        search_depth: "basic",
        max_results: 4,
        include_raw_content: true,
        include_usage: true,
      });
      return jsonResponse({
        results: [
          {
            url: "https://example.com/research",
            title: "Research",
            content: "Fallback content",
            raw_content: "Saved raw content",
            published_date: "2026-07-22T00:00:00Z",
          },
        ],
        response_time: 0.2,
        usage: { credits: 1 },
      });
    });

    const provider = createTavilySearchProvider({
      apiKey: "tavily-secret",
      fetchImpl,
    });
    const result = await provider.search({
      query: "traceable research",
      maxResults: 4,
      idempotencyKey: "run:search:0",
    });

    expect(result.data).toEqual([
      expect.objectContaining({
        url: "https://example.com/research",
        body: "Saved raw content",
        sourceType: "article",
        publishedAt: "2026-07-22T00:00:00.000Z",
      }),
    ]);
    expect(result.usage).toEqual({
      estimatedCostUsd: expect.any(Number),
      searchCount: 1,
      tokenCount: 0,
    });
  });

  it("filters empty bodies and enforces the requested result limit", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        results: [
          { url: "https://example.com/empty", title: "Empty", raw_content: "  " },
          { url: "https://example.com/one", title: "One", raw_content: "First" },
          { url: "https://example.com/two", title: "Two", raw_content: "Second" },
        ],
        usage: { credits: 1 },
      }),
    );
    const provider = createTavilySearchProvider({ apiKey: "tavily-secret", fetchImpl });

    const result = await provider.search({
      query: "bounded research",
      maxResults: 1,
      idempotencyKey: "run:search:0",
    });

    expect(result.data).toEqual([
      expect.objectContaining({ url: "https://example.com/one", body: "First" }),
    ]);
  });

  it("normalizes ISO dates and offsets while omitting invalid publication dates", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        results: [
          {
            url: "https://example.com/date-only",
            title: "Date only",
            raw_content: "First",
            published_date: "2026-07-22",
          },
          {
            url: "https://example.com/offset",
            title: "Offset",
            raw_content: "Second",
            published_date: "2026-07-22T08:30:00+08:00",
          },
          {
            url: "https://example.com/invalid-date",
            title: "Invalid date",
            raw_content: "Third",
            published_date: "not-an-iso-date",
          },
        ],
        usage: { credits: 1 },
      }),
    );
    const provider = createTavilySearchProvider({ apiKey: "tavily-secret", fetchImpl });

    const result = await provider.search({
      query: "publication dates",
      maxResults: 3,
      idempotencyKey: "run:search:0",
    });

    expect(result.data).toEqual([
      expect.objectContaining({ publishedAt: "2026-07-22T00:00:00.000Z" }),
      expect.objectContaining({ publishedAt: "2026-07-22T00:30:00.000Z" }),
      expect.not.objectContaining({ publishedAt: expect.anything() }),
    ]);
    expect(result.data[2]).not.toHaveProperty("publishedAt");
  });

  it("uses a conservative credit fallback when usage is temporarily zero", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        results: [
          { url: "https://example.com/one", title: "One", raw_content: "First" },
        ],
        usage: { credits: 0 },
      }),
    );
    const provider = createTavilySearchProvider({ apiKey: "tavily-secret", fetchImpl });

    const result = await provider.search({
      query: "conservative cost",
      maxResults: 1,
      idempotencyKey: "run:search:0",
    });

    expect(result.usage.estimatedCostUsd).toBe(0.008);
  });

  it("requests markdown extraction with usage credits", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        urls: ["https://example.com/manual"],
        extract_depth: "basic",
        format: "markdown",
        include_usage: true,
      });
      return jsonResponse({
        results: [{ url: "https://example.com/manual", raw_content: "Manual body" }],
        usage: { credits: 1 },
      });
    });
    const provider = createTavilySearchProvider({ apiKey: "tavily-secret", fetchImpl });

    await expect(
      provider.extract({
        urls: ["https://example.com/manual"],
        idempotencyKey: "run:manual",
      }),
    ).resolves.toMatchObject({ data: [expect.objectContaining({ body: "Manual body" })] });
  });

  it("extracts at most five manual URLs and rejects non-success responses safely", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        results: [
          {
            url: "https://example.com/manual",
            raw_content: "Manual body",
            title: "Manual",
          },
        ],
        usage: { credits: 1 },
      }),
    );
    const provider = createTavilySearchProvider({ apiKey: "tavily-secret", fetchImpl });

    await expect(
      provider.extract({
        urls: Array.from({ length: 6 }, (_, index) => `https://example.com/${index}`),
        idempotencyKey: "run:manual",
      }),
    ).rejects.toThrow("MANUAL_URL_LIMIT_EXCEEDED");
    expect(fetchImpl).not.toHaveBeenCalled();

    fetchImpl.mockResolvedValueOnce(jsonResponse({ error: "bad" }, 429));
    await expect(
      provider.extract({ urls: ["https://example.com/manual"], idempotencyKey: "run:manual" }),
    ).rejects.toThrow("TAVILY_REQUEST_FAILED");
  });

  it("maps thrown fetch errors to a stable Tavily error without leaking details", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("tavily-secret payload=https://private.example.com");
    });
    const provider = createTavilySearchProvider({ apiKey: "tavily-secret", fetchImpl });

    await expect(
      provider.search({
        query: "private research question",
        maxResults: 1,
        idempotencyKey: "run:search:0",
      }),
    ).rejects.toMatchObject({ message: "TAVILY_REQUEST_FAILED" });
  });
});

describe("DeepSeek live Provider", () => {
  it.each([
    ["plan", "focused search queries"],
    ["extract_claims", "atomic claims"],
    ["link_evidence", "exact source quotes"],
    ["detect_conflicts", "contradictions"],
    ["draft_report", "claims with stored evidence"],
  ] as const)("uses an operation-specific prompt for %s", (operation, instruction) => {
    const prompt = modelSystemPrompt(operation);

    expect(prompt).toContain(instruction);
    expect(prompt).toContain("payload.language");
  });

  it("requests deepseek-v4-flash JSON and validates structured output", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe("https://api.deepseek.com/chat/completions");
      expect(init?.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer deepseek-secret" }),
      );
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        model: "deepseek-v4-flash",
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      });
      expect(JSON.stringify(body)).toContain("untrusted");
      return jsonResponse({
        choices: [{ message: { content: '{"queries":["one","two","three"]}' } }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      });
    });
    const provider = createDeepSeekLanguageModel({ apiKey: "deepseek-secret", fetchImpl });
    const schema = z.object({ queries: z.array(z.string()).min(3) });

    const result = await provider.generateStructured({
      operation: "plan",
      schema,
      payload: { question: "How?", language: "en" },
      idempotencyKey: "run:planning",
    });

    expect(result.data.queries).toEqual(["one", "two", "three"]);
    expect(result.usage.estimatedCostUsd).toBeCloseTo(0.0000196, 12);
    expect(result.usage).toMatchObject({ searchCount: 0, tokenCount: 120 });
  });

  it("turns invalid JSON and non-success responses into stable errors", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: "not-json" } }] }),
    );
    const provider = createDeepSeekLanguageModel({ apiKey: "deepseek-secret", fetchImpl });
    const schema = z.object({ ok: z.boolean() });

    await expect(
      provider.generateStructured({
        operation: "plan",
        schema,
        payload: {},
        idempotencyKey: "run:planning",
      }),
    ).rejects.toThrow("PROVIDER_RESPONSE_INVALID");

    fetchImpl.mockResolvedValueOnce(jsonResponse({ error: "bad" }, 500));
    await expect(
      provider.generateStructured({
        operation: "plan",
        schema,
        payload: {},
        idempotencyKey: "run:planning",
      }),
    ).rejects.toThrow("DEEPSEEK_REQUEST_FAILED");
  });

  it("attaches a timeout signal and maps timeout errors without leaking details", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      throw new DOMException("deepseek-secret private payload", "TimeoutError");
    });
    const provider = createDeepSeekLanguageModel({
      apiKey: "deepseek-secret",
      fetchImpl,
    });

    await expect(
      provider.generateStructured({
        operation: "plan",
        schema: z.object({ queries: z.array(z.string()) }),
        payload: { question: "private question" },
        idempotencyKey: "run:planning",
      }),
    ).rejects.toMatchObject({ message: "PROVIDER_REQUEST_TIMEOUT" });
  });
});

describe("Bailian live Provider", () => {
  it("uses text-embedding-v4 at 1536 dimensions and preserves batch order", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe(
        "https://ws-123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/embeddings",
      );
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        model: "text-embedding-v4",
        input: ["first", "second"],
        dimensions: 1536,
      });
      return jsonResponse({
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ].map(({ index, embedding }) => ({
          index,
          embedding: Array.from({ length: 1536 }, (_, dimension) =>
            dimension < 2 ? embedding[dimension] : 0,
          ),
        })),
        usage: { total_tokens: 12 },
      });
    });
    const provider = createBailianEmbeddingProvider({
      apiKey: "bailian-secret",
      workspaceId: "ws-123",
      fetchImpl,
    });

    const result = await provider.embed({
      texts: ["first", "second"],
      idempotencyKey: "run:indexing",
    });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].slice(0, 2)).toEqual([1, 0]);
    expect(result.data[1].slice(0, 2)).toEqual([0, 1]);
    expect(result.data.every((vector) => vector.length === 1536)).toBe(true);
    expect(result.usage.estimatedCostUsd).toBeCloseTo(0.0000012, 12);
    expect(result.usage).toMatchObject({ searchCount: 0, tokenCount: 12 });
  });

  it("rejects an invalid vector response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: [{ index: 0, embedding: [1] }], usage: { total_tokens: 1 } }),
    );
    const provider = createBailianEmbeddingProvider({
      apiKey: "bailian-secret",
      workspaceId: "ws-123",
      fetchImpl,
    });

    await expect(
      provider.embed({ texts: ["one"], idempotencyKey: "run:indexing" }),
    ).rejects.toThrow("PROVIDER_RESPONSE_INVALID");
  });

  it("rejects duplicate embedding indexes", async () => {
    const embedding = Array<number>(1536).fill(0);
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          { index: 0, embedding },
          { index: 0, embedding },
        ],
        usage: { total_tokens: 2 },
      }),
    );
    const provider = createBailianEmbeddingProvider({
      apiKey: "bailian-secret",
      workspaceId: "ws-123",
      fetchImpl,
    });

    await expect(
      provider.embed({ texts: ["one", "two"], idempotencyKey: "run:indexing" }),
    ).rejects.toThrow("PROVIDER_RESPONSE_INVALID");
  });

  it("batches at ten inputs and accumulates usage in input order", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input: string[] };
      return jsonResponse({
        data: body.input.map((text, index) => ({
          index,
          embedding: Array.from({ length: 1536 }, (_, dimension) =>
            dimension === 0 ? Number(text.slice(5)) : 0,
          ),
        })),
        usage: { total_tokens: body.input.length },
      });
    });
    const provider = createBailianEmbeddingProvider({
      apiKey: "bailian-secret",
      workspaceId: "ws-123",
      fetchImpl,
    });
    const texts = Array.from({ length: 11 }, (_, index) => `text-${index}`);

    const result = await provider.embed({ texts, idempotencyKey: "run:indexing" });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.data.map((vector) => vector[0])).toEqual(
      Array.from({ length: 11 }, (_, index) => index),
    );
    expect(result.usage.tokenCount).toBe(11);
    expect(result.usage.estimatedCostUsd).toBeCloseTo(0.0000011, 12);
  });

  it("maps thrown fetch errors to a stable Bailian error without leaking details", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("bailian-secret embedding payload");
    });
    const provider = createBailianEmbeddingProvider({
      apiKey: "bailian-secret",
      workspaceId: "ws-123",
      fetchImpl,
    });

    await expect(
      provider.embed({ texts: ["private text"], idempotencyKey: "run:indexing" }),
    ).rejects.toMatchObject({ message: "BAILIAN_REQUEST_FAILED" });
  });
});

describe("Provider runtime selection", () => {
  const liveEnvironment = {
    NODE_ENV: "test",
    RESEARCH_PROVIDER_MODE: "live",
    ALLOW_PAID_PROVIDER_SMOKE: "I_CONFIRM_PAID_PROVIDER_CALLS",
    PAID_PROVIDER_SMOKE_COST_LIMIT_USD: "0.10",
    TAVILY_API_KEY: "tavily-secret",
    DEEPSEEK_API_KEY: "deepseek-secret",
    BAILIAN_API_KEY: "bailian-secret",
    BAILIAN_WORKSPACE_ID: "ws-123",
  };

  it("keeps tests on fixtures unless live mode is explicitly gated", () => {
    const providers = createResearchProviders({
      environment: { NODE_ENV: "test" },
    });
    expect(providers.mode).toBe("fixture");

    expect(() =>
      createResearchProviders({
        environment: {
          ...liveEnvironment,
          ALLOW_PAID_PROVIDER_SMOKE: "wrong",
        },
      }),
    ).toThrow("PAID_PROVIDER_SMOKE_NOT_CONFIRMED");
  });

  it("requires all live Provider credentials and selects live mode", () => {
    const providers = createResearchProviders({ environment: liveEnvironment });
    expect(providers.mode).toBe("live");

    expect(() =>
      createResearchProviders({
        environment: { ...liveEnvironment, BAILIAN_WORKSPACE_ID: undefined },
      }),
    ).toThrow("PROVIDER_CONFIGURATION_MISSING");
  });

  it("forces live Providers in production without the local smoke gate", () => {
    const providers = createResearchProviders({
      environment: {
        ...liveEnvironment,
        NODE_ENV: "production",
        RESEARCH_PROVIDER_MODE: "fixture",
        ALLOW_PAID_PROVIDER_SMOKE: undefined,
        PAID_PROVIDER_SMOKE_COST_LIMIT_USD: undefined,
      },
    });

    expect(providers.mode).toBe("live");
  });

  it("rejects a local live cost limit above ten cents", () => {
    expect(() =>
      createResearchProviders({
        environment: {
          ...liveEnvironment,
          PAID_PROVIDER_SMOKE_COST_LIMIT_USD: "0.11",
        },
      }),
    ).toThrow("PAID_PROVIDER_SMOKE_COST_LIMIT_INVALID");
  });
});

describe("paid Provider smoke gate", () => {
  const validEnvironment = {
    RESEARCH_PROVIDER_MODE: "live",
    ALLOW_PAID_PROVIDER_SMOKE: "I_CONFIRM_PAID_PROVIDER_CALLS",
    PAID_PROVIDER_SMOKE_COST_LIMIT_USD: "0.10",
  };

  it.each([undefined, "fixture"])(
    "rejects Provider mode %s before creating live Providers",
    (mode) => {
      const createProviders = vi.fn(() => ({ marker: "live" }));

      expect(() =>
        createPaidProviderSmokeRuntime({
          environment: { ...validEnvironment, RESEARCH_PROVIDER_MODE: mode },
          createProviders,
        }),
      ).toThrow("PAID_PROVIDER_SMOKE_LIVE_MODE_REQUIRED");
      expect(createProviders).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "wrong"])(
    "rejects confirmation token %s before creating live Providers",
    (confirmation) => {
      const createProviders = vi.fn(() => ({ marker: "live" }));

      expect(() =>
        createPaidProviderSmokeRuntime({
          environment: {
            ...validEnvironment,
            ALLOW_PAID_PROVIDER_SMOKE: confirmation,
          },
          createProviders,
        }),
      ).toThrow("PAID_PROVIDER_SMOKE_NOT_CONFIRMED");
      expect(createProviders).not.toHaveBeenCalled();
    },
  );

  it.each(["not-a-number", "0", "-0.01", "0.100001"])(
    "rejects cost limit %s before creating live Providers",
    (costLimit) => {
      const createProviders = vi.fn(() => ({ marker: "live" }));

      expect(() =>
        createPaidProviderSmokeRuntime({
          environment: {
            ...validEnvironment,
            PAID_PROVIDER_SMOKE_COST_LIMIT_USD: costLimit,
          },
          createProviders,
        }),
      ).toThrow("PAID_PROVIDER_SMOKE_COST_LIMIT_INVALID");
      expect(createProviders).not.toHaveBeenCalled();
    },
  );

  it("accepts the explicit ten-cent ceiling before creating live Providers", () => {
    const providers = { marker: "live" };
    const createProviders = vi.fn(() => providers);

    const runtime = createPaidProviderSmokeRuntime({
      environment: validEnvironment,
      createProviders,
    });

    expect(runtime).toMatchObject({ costLimitUsd: 0.1, providers });
    expect(runtime.budget.totalEstimatedCostUsd).toBe(0);
    expect(createProviders).toHaveBeenCalledOnce();
  });

  it("keeps the environment syntax valid below the conservative startup budget", () => {
    expect(
      readPaidProviderSmokeEnvironment({
        ...validEnvironment,
        PAID_PROVIDER_SMOKE_COST_LIMIT_USD: "0.001",
      }),
    ).toEqual({ costLimitUsd: 0.001 });
  });

  it("rejects a cap below the startup budget before creating live Providers", () => {
    const runTavily = vi.fn();
    const runDeepSeek = vi.fn();
    const runBailian = vi.fn();
    const createProviders = vi.fn(() => ({ runTavily, runDeepSeek, runBailian }));

    expect(() =>
      createPaidProviderSmokeRuntime({
        environment: {
          ...validEnvironment,
          PAID_PROVIDER_SMOKE_COST_LIMIT_USD: "0.001",
        },
        createProviders,
      }),
    ).toThrow("PAID_PROVIDER_SMOKE_BUDGET_TOO_LOW");
    expect(createProviders).not.toHaveBeenCalled();
    expect(runTavily).not.toHaveBeenCalled();
    expect(runDeepSeek).not.toHaveBeenCalled();
    expect(runBailian).not.toHaveBeenCalled();
  });

  it("stops after Tavily when its actual cost exceeds the cap", async () => {
    const budget = createPaidProviderSmokeBudget(0.01);
    const runTavily = vi.fn(async () => ({ usage: { estimatedCostUsd: 0.011 } }));
    const runDeepSeek = vi.fn(async () => ({ usage: { estimatedCostUsd: 0.001 } }));
    const runBailian = vi.fn(async () => ({ usage: { estimatedCostUsd: 0.001 } }));

    await expect(
      runPaidProviderSmokeSequence({ budget, runTavily, runDeepSeek, runBailian }),
    ).rejects.toThrow("PAID_PROVIDER_SMOKE_COST_LIMIT_EXCEEDED");
    expect(runTavily).toHaveBeenCalledOnce();
    expect(runDeepSeek).not.toHaveBeenCalled();
    expect(runBailian).not.toHaveBeenCalled();
  });

  it("stops after DeepSeek when cumulative actual cost exceeds the cap", async () => {
    const budget = createPaidProviderSmokeBudget(0.01);
    const runTavily = vi.fn(async () => ({ usage: { estimatedCostUsd: 0.008 } }));
    const runDeepSeek = vi.fn(async () => ({ usage: { estimatedCostUsd: 0.003 } }));
    const runBailian = vi.fn(async () => ({ usage: { estimatedCostUsd: 0.001 } }));

    await expect(
      runPaidProviderSmokeSequence({ budget, runTavily, runDeepSeek, runBailian }),
    ).rejects.toThrow("PAID_PROVIDER_SMOKE_COST_LIMIT_EXCEEDED");
    expect(runTavily).toHaveBeenCalledOnce();
    expect(runDeepSeek).toHaveBeenCalledOnce();
    expect(runBailian).not.toHaveBeenCalled();
  });

  it("records all three actual costs when they remain within the cap", async () => {
    const budget = createPaidProviderSmokeBudget(0.01);
    const runTavily = vi.fn(async () => ({ usage: { estimatedCostUsd: 0.008 } }));
    const runDeepSeek = vi.fn(async () => ({ usage: { estimatedCostUsd: 0.001 } }));
    const runBailian = vi.fn(async () => ({ usage: { estimatedCostUsd: 0.0001 } }));

    const result = await runPaidProviderSmokeSequence({
      budget,
      runTavily,
      runDeepSeek,
      runBailian,
    });

    expect(runTavily).toHaveBeenCalledOnce();
    expect(runDeepSeek).toHaveBeenCalledOnce();
    expect(runBailian).toHaveBeenCalledOnce();
    expect(result.totalEstimatedCostUsd).toBeCloseTo(0.0091, 12);
    expect(budget.totalEstimatedCostUsd).toBeCloseTo(0.0091, 12);
  });
});

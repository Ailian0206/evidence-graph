import { NonRetriableError } from "inngest";
import { describe, expect, it, vi } from "vitest";

import { authorizeResearchRun } from "@/inngest/authorize-run";
import type { ResearchWorkflowSnapshot } from "@/features/research/workflow-store";
import type { ProviderCallExecutor } from "@/features/research/run-research-workflow";
import {
  createWorkflowInputReader,
  type WorkflowInput,
  type WorkflowInputQueries,
} from "@/features/research/supabase-workflow-reader";
import {
  createResearchRequestedPayload,
  resolveInngestModeOverride,
} from "@/inngest/client";
import { researchRequestedEventSchema } from "@/inngest/events";
import {
  createResearchWorkflowExecutor,
  createRunResearchHandler,
  runResearchFunctionConfig,
} from "@/inngest/functions/run-research";
import { createFixtureResearchProviders } from "@/providers/fixtures/research-providers";

const eventData = {
  ownerId: "owner_1",
  projectId: "project_1",
  runId: "run_1",
};

const createWorkflowInput = (): WorkflowInput => ({
  project: {
    id: "project_1",
    ownerId: "owner_1",
    title: "真实研究",
    question: "可追溯研究如何处理相互冲突的来源？",
    language: "zh",
    status: "active",
    visibility: "private",
    slug: "real-research",
    createdAt: "2026-07-22T08:00:00.000Z",
    updatedAt: "2026-07-22T08:01:00.000Z",
  },
  run: {
    id: "run_1",
    projectId: "project_1",
    ownerId: "owner_1",
    status: "queued",
    step: "queued",
    sourceLimit: 8,
    manualUrlLimit: 5,
    maxContentChars: 120000,
    estimatedCostUsd: 0,
    searchCount: 0,
    tokenCount: 0,
    createdAt: "2026-07-22T08:00:00.000Z",
    updatedAt: "2026-07-22T08:01:00.000Z",
  },
  manualUrls: [],
});

const createMemoizingStep = () => {
  const memoizedResults = new Map<string, unknown>();
  const calls: string[] = [];

  return {
    calls,
    memoizedResults,
    step: {
      run: vi.fn(async <T>(id: string, operation: () => Promise<T>): Promise<T> => {
        calls.push(id);

        if (memoizedResults.has(id)) {
          return structuredClone(memoizedResults.get(id)) as T;
        }

        const result = await operation();
        memoizedResults.set(id, structuredClone(result));
        return result;
      }),
    },
  };
};

const createStatefulWriter = () => {
  let status: "queued" | "running" | "failed" | "ready" = "queued";
  const writer = {
    begin: vi.fn(async () => {
      if (status !== "queued") {
        throw new Error("RUN_NOT_QUEUED");
      }
      status = "running";
    }),
    persist: vi.fn(async () => {
      if (status !== "running" && status !== "ready") {
        throw new Error("RUN_NOT_RUNNING");
      }
      status = "ready";
    }),
    fail: vi.fn(async () => {
      if (status !== "running") {
        throw new Error("RUN_NOT_RUNNING");
      }
      status = "failed";
    }),
  };

  return { writer, getStatus: () => status };
};

describe("Inngest research workflow entry", () => {
  it("requires owner, project, and run identifiers", () => {
    expect(researchRequestedEventSchema.parse(eventData)).toEqual(eventData);
    expect(() =>
      researchRequestedEventSchema.parse({ ownerId: "owner_1", projectId: "project_1" }),
    ).toThrow();
    expect(() =>
      researchRequestedEventSchema.parse({ ...eventData, runId: "" }),
    ).toThrow();
  });

  it("uses the run id as the outgoing event id", () => {
    expect(createResearchRequestedPayload(eventData)).toEqual({
      name: "evidence/research.requested",
      id: "run_1",
      data: eventData,
    });
  });

  it("delegates explicit Inngest dev mode to the SDK in production", () => {
    expect(
      resolveInngestModeOverride({ NODE_ENV: "production", INNGEST_DEV: "1" }),
    ).toBeUndefined();
    expect(resolveInngestModeOverride({ NODE_ENV: "development" })).toBe(true);
    expect(resolveInngestModeOverride({ NODE_ENV: "production" })).toBe(false);
  });

  it("authorizes a run only when all three identifiers match", async () => {
    const readRun = vi.fn(async () => ({
      id: "run_1",
      ownerId: "owner_1",
      projectId: "project_1",
    }));

    await expect(authorizeResearchRun({ event: eventData, readRun })).resolves.toEqual({
      id: "run_1",
      ownerId: "owner_1",
      projectId: "project_1",
    });
    expect(readRun).toHaveBeenCalledWith(eventData);
  });

  it("reads the owned project, run limits, and manual URLs for execution", async () => {
    const queries: WorkflowInputQueries = {
      getProject: vi.fn(async () => ({
        id: "project_1",
        owner_id: "owner_1",
        title: "真实研究",
        question: "AI 研究工具如何保留可核查证据？",
        language: "zh" as const,
        status: "active" as const,
        visibility: "private" as const,
        slug: "real-research",
        created_at: "2026-07-22T08:00:00+00:00",
        updated_at: "2026-07-22T08:01:00+00:00",
      })),
      getRun: vi.fn(async () => ({
        id: "run_1",
        project_id: "project_1",
        owner_id: "owner_1",
        status: "queued" as const,
        step: "queued" as const,
        source_limit: 8,
        manual_url_limit: 5,
        manual_urls: ["https://example.com/manual"],
        max_content_chars: 120000,
        estimated_cost_usd: 0,
        search_count: 0,
        token_count: 0,
        error_message: null,
        created_at: "2026-07-22T08:00:00+00:00",
        updated_at: "2026-07-22T08:01:00+00:00",
      })),
    };

    const result = await createWorkflowInputReader(queries)(eventData);

    expect(queries.getProject).toHaveBeenCalledWith(eventData);
    expect(queries.getRun).toHaveBeenCalledWith(eventData);
    expect(result).toMatchObject({
      project: {
        id: "project_1",
        question: "AI 研究工具如何保留可核查证据？",
        language: "zh",
      },
      run: {
        id: "run_1",
        sourceLimit: 8,
        maxContentChars: 120000,
      },
      manualUrls: ["https://example.com/manual"],
    });
  });

  it.each([
    "mailto:research@example.com",
    "ftp://research.example.com/source",
    "javascript:alert(1)",
    "http://localhost/source",
    "https://app.localhost/source",
    "http://127.0.0.42/source",
    "http://0.0.0.0/source",
    "http://[::1]/source",
    "https://research.local/source",
  ])("rejects unsafe persisted manual source URL %s", async (manualUrl) => {
    const queries: WorkflowInputQueries = {
      getProject: vi.fn(async () => ({
        id: "project_1",
        owner_id: "owner_1",
        title: "真实研究",
        question: "AI 研究工具如何保留可核查证据？",
        language: "zh" as const,
        status: "active" as const,
        visibility: "private" as const,
        slug: "real-research",
        created_at: "2026-07-22T08:00:00+00:00",
        updated_at: "2026-07-22T08:01:00+00:00",
      })),
      getRun: vi.fn(async () => ({
        id: "run_1",
        project_id: "project_1",
        owner_id: "owner_1",
        status: "queued" as const,
        step: "queued" as const,
        source_limit: 8,
        manual_url_limit: 5,
        manual_urls: [manualUrl],
        max_content_chars: 120000,
        estimated_cost_usd: 0,
        search_count: 0,
        token_count: 0,
        error_message: null,
        created_at: "2026-07-22T08:00:00+00:00",
        updated_at: "2026-07-22T08:01:00+00:00",
      })),
    };

    await expect(createWorkflowInputReader(queries)(eventData)).rejects.toThrow();
  });

  it("executes the workflow with the persisted research question", async () => {
    const providers = createFixtureResearchProviders();
    const executor = createResearchWorkflowExecutor({
      readInput: async () => ({
        project: {
          id: "project_1",
          ownerId: "owner_1",
          title: "真实研究",
          question: "可追溯研究如何处理相互冲突的来源？",
          language: "zh",
          status: "active",
          visibility: "private",
          slug: "real-research",
          createdAt: "2026-07-22T08:00:00.000Z",
          updatedAt: "2026-07-22T08:01:00.000Z",
        },
        run: {
          id: "run_1",
          projectId: "project_1",
          ownerId: "owner_1",
          status: "queued",
          step: "queued",
          sourceLimit: 8,
          manualUrlLimit: 5,
          maxContentChars: 120000,
          estimatedCostUsd: 0,
          searchCount: 0,
          tokenCount: 0,
          createdAt: "2026-07-22T08:00:00.000Z",
          updatedAt: "2026-07-22T08:01:00.000Z",
        },
        manualUrls: ["https://example.com/manual"],
      }),
      createProviders: () => providers,
      now: () => "2026-07-22T09:00:00.000Z",
    });

    const result = await executor(eventData);

    expect(result.output).toMatchObject({ status: "ready" });
    expect(providers.calls.find((call) => call.operation === "plan")?.payload).toEqual({
      question: "可追溯研究如何处理相互冲突的来源？",
      language: "zh",
    });
    expect(result.snapshot.projects).toEqual([
      expect.objectContaining({ id: "project_1", question: "可追溯研究如何处理相互冲突的来源？" }),
    ]);
  });

  it.each([
    { id: "run_other", ownerId: "owner_1", projectId: "project_1" },
    { id: "run_1", ownerId: "owner_other", projectId: "project_1" },
    { id: "run_1", ownerId: "owner_1", projectId: "project_other" },
    null,
  ])("rejects a mismatched run without retrying", async (record) => {
    const operation = authorizeResearchRun({
      event: eventData,
      readRun: async () => record,
    });

    await expect(operation).rejects.toBeInstanceOf(NonRetriableError);
    await expect(operation).rejects.toThrow("RUN_PROJECT_MISMATCH");
  });

  it("uses separate durable steps for lifecycle writes and Provider calls", async () => {
    const calls: string[] = [];
    const snapshot = {} as ResearchWorkflowSnapshot;
    const authorize = vi.fn(async () => {
      calls.push("authorize");
    });
    const executeWorkflow = vi.fn(
      async (
        _event: typeof eventData,
        executeProviderCall: ProviderCallExecutor,
      ) => {
        calls.push("execute");
        await executeProviderCall("run_1:planning", async () => {
          calls.push("provider");
          return {
            data: { queries: [] },
            usage: { estimatedCostUsd: 0, searchCount: 0, tokenCount: 0 },
          };
        });
        return { output: { status: "ready" }, snapshot };
      },
    );
    const writer = {
      begin: vi.fn(async () => {
        calls.push("begin");
      }),
      persist: vi.fn(async () => {
        calls.push("persist");
      }),
      fail: vi.fn(async () => {
        calls.push("fail");
      }),
    };
    const step = {
      run: vi.fn(async (id: string, operation: () => Promise<unknown>) => {
        calls.push(`step:${id}`);
        return operation();
      }),
    };
    const handler = createRunResearchHandler({
      authorize,
      executeWorkflow,
      createWriter: async () => writer,
    });

    await expect(handler({ event: { data: eventData }, step })).resolves.toEqual({
      status: "ready",
    });
    expect(calls).toEqual([
      "authorize",
      "step:begin-research-workflow",
      "begin",
      "execute",
      "step:provider:run_1:planning",
      "provider",
      "step:persist-research-workflow",
      "persist",
    ]);
    expect(executeWorkflow).toHaveBeenCalledWith(eventData, expect.any(Function));
    expect(writer.persist).toHaveBeenCalledWith({ event: eventData, snapshot });
  });

  it("compacts durable embedding results while preserving replayed vectors", async () => {
    const vectors = Array.from({ length: 10 }, (_, rowIndex) =>
      Array.from({ length: 1536 }, (_, columnIndex) =>
        Math.sin(rowIndex * 1536 + columnIndex),
      ),
    );
    const usage = {
      estimatedCostUsd: 0.001,
      searchCount: 0,
      tokenCount: 1536,
    };
    const embeddingOperation = vi.fn(async () => ({ data: vectors, usage }));
    const snapshot = {} as ResearchWorkflowSnapshot;
    const executeWorkflow = vi.fn(
      async (
        _event: typeof eventData,
        executeProviderCall: ProviderCallExecutor,
      ) => {
        const first = await executeProviderCall(
          "run_1:indexing:0",
          embeddingOperation,
        );
        const replayed = await executeProviderCall(
          "run_1:indexing:0",
          embeddingOperation,
        );

        expect(first.usage).toEqual(usage);
        expect(replayed.usage).toEqual(usage);
        expect(first.data).toHaveLength(10);
        expect(first.data[0]).toHaveLength(1536);
        expect(replayed.data[9][1535]).toBeCloseTo(vectors[9][1535], 6);

        return { output: { status: "ready" }, snapshot };
      },
    );
    const handler = createRunResearchHandler({
      authorize: async () => undefined,
      executeWorkflow,
      createWriter: async () => ({
        begin: async () => undefined,
        persist: async () => undefined,
        fail: async () => undefined,
      }),
    });
    const { memoizedResults, step } = createMemoizingStep();

    await expect(handler({ event: { data: eventData }, step })).resolves.toEqual({
      status: "ready",
    });

    expect(embeddingOperation).toHaveBeenCalledTimes(1);
    const durableResult = memoizedResults.get("provider:run_1:indexing:0");
    expect(durableResult).toMatchObject({
      encoding: "float32-base64",
      rows: 10,
      columns: 1536,
      usage,
    });
    expect(JSON.stringify(durableResult).length).toBeLessThan(100_000);
  });

  it("rejects malformed durable embedding results with a stable error", async () => {
    const handler = createRunResearchHandler({
      authorize: async () => undefined,
      executeWorkflow: async (_event, executeProviderCall) => {
        await executeProviderCall("run_1:indexing:0", async () => ({
          data: [Array.from({ length: 1536 }, () => 0)],
          usage: { estimatedCostUsd: 0, searchCount: 0, tokenCount: 0 },
        }));
        return {
          output: { status: "ready" },
          snapshot: {} as ResearchWorkflowSnapshot,
        };
      },
      createWriter: async () => ({
        begin: async () => undefined,
        persist: async () => undefined,
        fail: async () => undefined,
      }),
    });
    const step = {
      run: vi.fn(async (id: string, operation: () => Promise<unknown>) =>
        id === "provider:run_1:indexing:0"
          ? {
              encoding: "float32-base64",
              rows: 11,
              columns: 1536,
              data: 42,
              usage: null,
            }
          : operation(),
      ),
    };

    await expect(handler({ event: { data: eventData }, step })).rejects.toThrow(
      "DURABLE_PROVIDER_RESULT_INVALID",
    );
  });

  it("marks the run failed and rethrows when durable execution fails", async () => {
    const calls: string[] = [];
    const writer = {
      begin: vi.fn(async () => {
        calls.push("begin");
      }),
      persist: vi.fn(async () => {
        calls.push("persist");
      }),
      fail: vi.fn(async () => {
        calls.push("fail");
      }),
    };
    const handler = createRunResearchHandler({
      authorize: async () => {
        calls.push("authorize");
      },
      executeWorkflow: async () => {
        calls.push("execute");
        throw new Error("WORKFLOW_FAILED");
      },
      createWriter: async () => writer,
    });
    const step = {
      run: vi.fn(async (_id: string, operation: () => Promise<unknown>) => {
        calls.push("step");
        return operation();
      }),
    };

    await expect(
      handler({
        event: { data: eventData },
        step,
        attempt: 3,
        maxAttempts: 4,
      }),
    ).rejects.toThrow("WORKFLOW_FAILED");
    expect(calls).toEqual([
      "authorize",
      "step",
      "begin",
      "execute",
      "step",
      "fail",
    ]);
    expect(step.run).toHaveBeenNthCalledWith(
      1,
      "begin-research-workflow",
      expect.any(Function),
    );
    expect(step.run).toHaveBeenNthCalledWith(
      2,
      "fail-research-workflow:WORKFLOW_FAILED",
      expect.any(Function),
    );
    expect(writer.fail).toHaveBeenCalledWith({
      ...eventData,
      errorCode: "WORKFLOW_FAILED",
    });
  });

  it("replays successful Provider calls and retries only the failed call", async () => {
    const providers = createFixtureResearchProviders({ failSearchAtCall: 2 });
    const executor = createResearchWorkflowExecutor({
      readInput: async () => createWorkflowInput(),
      createProviders: () => providers,
      now: () => "2026-07-22T09:00:00.000Z",
    });
    const { writer, getStatus } = createStatefulWriter();
    const handler = createRunResearchHandler({
      authorize: async () => undefined,
      executeWorkflow: executor,
      createWriter: async () => writer,
    });
    const { calls, step } = createMemoizingStep();

    await expect(
      handler({ event: { data: eventData }, step, attempt: 0, maxAttempts: 2 }),
    ).rejects.toThrow("WORKFLOW_FAILED");
    expect(getStatus()).toBe("running");
    await expect(
      handler({ event: { data: eventData }, step, attempt: 1, maxAttempts: 2 }),
    ).resolves.toMatchObject({ status: "ready" });
    expect(getStatus()).toBe("ready");

    expect(
      providers.calls.filter((call) => call.idempotencyKey === "run_1:planning"),
    ).toHaveLength(1);
    expect(
      providers.calls.filter(
        (call) => call.idempotencyKey === "run_1:searching:0",
      ),
    ).toHaveLength(1);
    expect(
      providers.calls.filter(
        (call) => call.idempotencyKey === "run_1:searching:1",
      ),
    ).toHaveLength(2);
    expect(calls).not.toContain("run-research-workflow");
    expect(writer.begin).toHaveBeenCalledTimes(1);
    expect(writer.fail).not.toHaveBeenCalled();
    expect(writer.persist).toHaveBeenCalledTimes(1);
  });

  it("marks the run failed only on the final function attempt", async () => {
    const { writer, getStatus } = createStatefulWriter();
    const handler = createRunResearchHandler({
      authorize: async () => undefined,
      executeWorkflow: async () => {
        throw new Error("WORKFLOW_FAILED");
      },
      createWriter: async () => writer,
    });
    const { step } = createMemoizingStep();

    await expect(
      handler({ event: { data: eventData }, step, attempt: 0, maxAttempts: 3 }),
    ).rejects.toThrow("WORKFLOW_FAILED");
    expect(getStatus()).toBe("running");
    expect(writer.fail).not.toHaveBeenCalled();

    await expect(
      handler({ event: { data: eventData }, step, attempt: 1, maxAttempts: 3 }),
    ).rejects.toThrow("WORKFLOW_FAILED");
    expect(getStatus()).toBe("running");
    expect(writer.fail).not.toHaveBeenCalled();

    await expect(
      handler({ event: { data: eventData }, step, attempt: 2, maxAttempts: 3 }),
    ).rejects.toThrow("WORKFLOW_FAILED");
    expect(getStatus()).toBe("failed");
    expect(writer.begin).toHaveBeenCalledTimes(1);
    expect(writer.fail).toHaveBeenCalledTimes(1);
  });

  it("reapplies memoized usage before allowing another paid call", async () => {
    const providers = createFixtureResearchProviders({
      costOverrides: { plan: 0.6, search: 0.4 },
    });
    const executor = createResearchWorkflowExecutor({
      readInput: async () => createWorkflowInput(),
      createProviders: () => providers,
      now: () => "2026-07-22T09:00:00.000Z",
    });
    const handler = createRunResearchHandler({
      authorize: async () => undefined,
      executeWorkflow: executor,
      createWriter: async () => ({
        begin: async () => undefined,
        persist: async () => undefined,
        fail: async () => undefined,
      }),
    });
    const { step } = createMemoizingStep();

    await expect(handler({ event: { data: eventData }, step })).rejects.toThrow(
      "RUN_COST_LIMIT_EXCEEDED",
    );
    await expect(handler({ event: { data: eventData }, step })).rejects.toThrow(
      "RUN_COST_LIMIT_EXCEEDED",
    );

    expect(
      providers.calls.filter((call) => call.idempotencyKey === "run_1:planning"),
    ).toHaveLength(1);
    expect(
      providers.calls.filter(
        (call) => call.idempotencyKey === "run_1:searching:0",
      ),
    ).toHaveLength(1);
    expect(
      providers.calls.filter(
        (call) => call.idempotencyKey === "run_1:searching:1",
      ),
    ).toHaveLength(0);
  });

  it("uses run idempotency, owner concurrency, and three retries", () => {
    expect(runResearchFunctionConfig).toMatchObject({
      id: "run-managed-research",
      idempotency: "event.data.runId",
      concurrency: {
        limit: 1,
        key: "event.data.ownerId",
      },
      retries: 3,
    });
  });
});

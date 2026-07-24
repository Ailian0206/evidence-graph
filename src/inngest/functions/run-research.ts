import { createDemoResearchFixture } from "@/features/research/fixtures";
import { gzipSync, gunzipSync } from "node:zlib";
import type { ResearchRun } from "@/features/research/domain";
import {
  runResearchWorkflow,
  type ProviderCallExecutor,
} from "@/features/research/run-research-workflow";
import type { WorkflowInput } from "@/features/research/supabase-workflow-reader";
import {
  createDurableWorkflowWriter,
  createSupabaseWorkflowPersistenceQueries,
  type DurableWorkflowWriter,
} from "@/features/research/supabase-workflow-writer";
import {
  createInMemoryResearchWorkflowStore,
  type ResearchWorkflowSnapshot,
} from "@/features/research/workflow-store";
import type {
  EmbeddingProvider,
  LanguageModel,
  ProviderResult,
  SearchProvider,
} from "@/providers/contracts";
import { providerUsageSchema, type ProviderUsage } from "@/providers/contracts";
import { createResearchProviders } from "@/providers/runtime";
import {
  authorizeResearchRun,
  createSupabaseRunAuthorizationReader,
} from "@/inngest/authorize-run";
import { inngest } from "@/inngest/client";
import {
  researchRequestedEvent,
  researchRequestedEventSchema,
  type ResearchRequestedEventData,
} from "@/inngest/events";

type DurableStep = {
  run: (id: string, operation: () => Promise<unknown>) => Promise<unknown>;
};

type RunResearchHandlerDependencies = {
  authorize: (
    event: ResearchRequestedEventData,
  ) => Promise<{ status?: ResearchRun["status"] } | void>;
  executeWorkflow: (
    event: ResearchRequestedEventData,
    executeProviderCall: ProviderCallExecutor,
  ) => Promise<{
    output: unknown;
    snapshot: ResearchWorkflowSnapshot;
  }>;
  createWriter: () => Promise<DurableWorkflowWriter>;
};

type ResearchWorkflowProviders = {
  search: SearchProvider;
  languageModel: LanguageModel;
  embedding: EmbeddingProvider;
};

type ResearchWorkflowExecutorDependencies = {
  readInput: (event: ResearchRequestedEventData) => Promise<WorkflowInput>;
  createProviders: () => ResearchWorkflowProviders & {
    maxCostUsd?: number;
    executionLimits?: {
      sourceLimit: number;
      maxContentChars: number;
      maxEmbeddingBatches: number;
    };
  };
  now: () => string;
};

const DEFAULT_RETRY_COUNT = 3 as const;
const DEFAULT_MAX_ATTEMPTS = DEFAULT_RETRY_COUNT + 1;
const FLOAT32_BYTES = 4;
const EMBEDDING_DIMENSIONS = 1536;
const MAX_EMBEDDING_BATCH_SIZE = 10;
const DURABLE_COMPRESSION_THRESHOLD_BYTES = 32 * 1024;
const MAX_DURABLE_RESULT_BYTES = 2 * 1024 * 1024;

type CompactEmbeddingResult = {
  encoding: "float32-base64" | "float32-gzip-base64";
  rows: number;
  columns: number;
  data: string;
  usage: ProviderUsage;
};

type CompressedJsonResult = {
  encoding: "gzip-json-base64";
  data: string;
};

const isEmbeddingCall = (idempotencyKey: string) =>
  /:indexing:\d+$/.test(idempotencyKey);

const compressJsonResult = <T>(result: ProviderResult<T>) => {
  let serialized;

  try {
    serialized = JSON.stringify(result);
  } catch {
    throw new Error("DURABLE_PROVIDER_RESULT_INVALID");
  }

  if (
    typeof serialized !== "string" ||
    Buffer.byteLength(serialized) > MAX_DURABLE_RESULT_BYTES
  ) {
    throw new Error("DURABLE_PROVIDER_RESULT_INVALID");
  }

  if (Buffer.byteLength(serialized) < DURABLE_COMPRESSION_THRESHOLD_BYTES) {
    return result;
  }

  return {
    encoding: "gzip-json-base64",
    data: gzipSync(serialized).toString("base64"),
  } satisfies CompressedJsonResult;
};

const compactProviderResult = <T>(
  idempotencyKey: string,
  result: ProviderResult<T>,
): ProviderResult<T> | CompactEmbeddingResult | CompressedJsonResult => {
  if (!isEmbeddingCall(idempotencyKey) || !Array.isArray(result.data)) {
    return compressJsonResult(result);
  }

  const matrix = result.data as unknown[];
  const rows = matrix.length;
  const columns = Array.isArray(matrix[0]) ? matrix[0].length : 0;

  if (
    rows === 0 ||
    columns === 0 ||
    !matrix.every(
      (row) =>
        Array.isArray(row) &&
        row.length === columns &&
        row.every((value) => typeof value === "number" && Number.isFinite(value)),
    )
  ) {
    return compressJsonResult(result);
  }

  const buffer = Buffer.allocUnsafe(rows * columns * FLOAT32_BYTES);
  let offset = 0;

  for (const row of matrix as number[][]) {
    for (const value of row) {
      buffer.writeFloatLE(value, offset);
      offset += FLOAT32_BYTES;
    }
  }

  return {
    encoding: "float32-gzip-base64",
    rows,
    columns,
    data: gzipSync(buffer).toString("base64"),
    usage: result.usage,
  };
};

const restoreProviderResult = <T>(result: unknown): ProviderResult<T> => {
  if (
    typeof result === "object" &&
    result !== null &&
    "encoding" in result &&
    result.encoding === "gzip-json-base64"
  ) {
    const compressed = result as CompressedJsonResult;

    try {
      if (typeof compressed.data !== "string") {
        throw new Error("DURABLE_PROVIDER_RESULT_INVALID");
      }

      const decompressed = gunzipSync(Buffer.from(compressed.data, "base64"), {
        maxOutputLength: MAX_DURABLE_RESULT_BYTES,
      });
      return JSON.parse(decompressed.toString("utf8")) as ProviderResult<T>;
    } catch {
      throw new Error("DURABLE_PROVIDER_RESULT_INVALID");
    }
  }

  if (
    typeof result !== "object" ||
    result === null ||
    !("encoding" in result) ||
    (result.encoding !== "float32-base64" &&
      result.encoding !== "float32-gzip-base64")
  ) {
    return result as ProviderResult<T>;
  }

  const compact = result as CompactEmbeddingResult;
  const usage = providerUsageSchema.safeParse(compact.usage);

  if (
    !Number.isSafeInteger(compact.rows) ||
    compact.rows <= 0 ||
    compact.rows > MAX_EMBEDDING_BATCH_SIZE ||
    compact.columns !== EMBEDDING_DIMENSIONS ||
    typeof compact.data !== "string" ||
    !usage.success
  ) {
    throw new Error("DURABLE_PROVIDER_RESULT_INVALID");
  }

  let buffer;

  try {
    const encoded = Buffer.from(compact.data, "base64");
    buffer =
      compact.encoding === "float32-gzip-base64"
        ? gunzipSync(encoded, { maxOutputLength: MAX_DURABLE_RESULT_BYTES })
        : encoded;
  } catch {
    throw new Error("DURABLE_PROVIDER_RESULT_INVALID");
  }
  const expectedBytes = compact.rows * compact.columns * FLOAT32_BYTES;

  if (
    !Number.isSafeInteger(expectedBytes) ||
    buffer.byteLength !== expectedBytes
  ) {
    throw new Error("DURABLE_PROVIDER_RESULT_INVALID");
  }

  const data = Array.from({ length: compact.rows }, (_, rowIndex) =>
    Array.from({ length: compact.columns }, (_, columnIndex) =>
      buffer.readFloatLE((rowIndex * compact.columns + columnIndex) * FLOAT32_BYTES),
    ),
  );

  return {
    data: data as T,
    usage: usage.data,
  };
};

const getStableErrorCode = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  return /^[A-Z][A-Z0-9_]{0,127}$/.test(message) ? message : "WORKFLOW_FAILED";
};

export const createRunResearchHandler = ({
  authorize,
  executeWorkflow,
  createWriter,
}: RunResearchHandlerDependencies) =>
  async ({
    event,
    step,
    attempt = 0,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  }: {
    event: { data: ResearchRequestedEventData };
    step: DurableStep;
    attempt?: number;
    maxAttempts?: number;
  }) => {
    const parsedEvent = researchRequestedEventSchema.parse(event.data);
    const authorization = await authorize(parsedEvent);

    if (authorization?.status === "ready") {
      return { status: "ready", completedSteps: [], reportId: null };
    }

    const writer = await createWriter();
    await step.run("begin-research-workflow", () => writer.begin(parsedEvent));
    const executeProviderCall: ProviderCallExecutor = async (
      idempotencyKey,
      operation,
    ) => {
      const durableResult = await step.run(
        `provider:${idempotencyKey}`,
        async () => compactProviderResult(idempotencyKey, await operation()),
      );

      return restoreProviderResult(durableResult);
    };

    try {
      const execution = await executeWorkflow(parsedEvent, executeProviderCall);
      await step.run("persist-research-workflow", () =>
        writer.persist({ event: parsedEvent, snapshot: execution.snapshot }),
      );
      return execution.output;
    } catch (error) {
      const errorCode = getStableErrorCode(error);

      if (attempt >= maxAttempts - 1) {
        await step.run(`fail-research-workflow:${errorCode}`, () =>
          writer.fail({
            ...parsedEvent,
            errorCode,
          }),
        );
      }

      throw error;
    }
  };

export const createResearchWorkflowExecutor = ({
  readInput,
  createProviders,
  now,
}: ResearchWorkflowExecutorDependencies) =>
  async (
    event: ResearchRequestedEventData,
    executeProviderCall?: ProviderCallExecutor,
  ) => {
    const input = await readInput(event);
    const providerRuntime = createProviders();
    const executionLimits = providerRuntime.executionLimits;
    const effectiveRun = executionLimits
      ? {
          ...input.run,
          sourceLimit: Math.min(
            input.run.sourceLimit,
            executionLimits.sourceLimit,
          ),
          maxContentChars: Math.min(
            input.run.maxContentChars,
            executionLimits.maxContentChars,
          ),
        }
      : input.run;
    const fixture = createDemoResearchFixture();
    fixture.projects = [input.project];
    fixture.researchRuns = [effectiveRun];
    fixture.sources = [];
    fixture.chunks = [];
    fixture.claims = [];
    fixture.evidenceLinks = [];
    fixture.claimRelations = [];

    const store = createInMemoryResearchWorkflowStore(fixture);
    const result = await runResearchWorkflow({
      runId: input.run.id,
      ownerId: input.project.ownerId,
      manualSources: [],
      manualUrls: input.manualUrls,
      providers: providerRuntime,
      maxCostUsd: providerRuntime.maxCostUsd ?? 1,
      maxEmbeddingBatches: executionLimits?.maxEmbeddingBatches,
      executeProviderCall,
      store,
      now,
    });

    if (result.run.status !== "ready") {
      throw new Error(result.run.errorMessage ?? "WORKFLOW_FAILED");
    }

    return {
      output: {
        status: result.run.status,
        completedSteps: result.completedSteps,
        reportId: result.report?.id ?? null,
      },
      snapshot: store.getSnapshot(),
    };
  };

const authorizeManagedRun = async (event: ResearchRequestedEventData) => {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const client = createSupabaseAdminClient();
  return authorizeResearchRun({
    event,
    readRun: createSupabaseRunAuthorizationReader(client),
  });
};

const createManagedWorkflowWriter = async () => {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  return createDurableWorkflowWriter(
    createSupabaseWorkflowPersistenceQueries(createSupabaseAdminClient()),
  );
};

const researchTriggers: [{ event: typeof researchRequestedEvent }] = [
  { event: researchRequestedEvent },
];

export const runResearchFunctionConfig = {
  id: "run-managed-research",
  triggers: researchTriggers,
  idempotency: "event.data.runId",
  concurrency: {
    limit: 1,
    key: "event.data.ownerId",
  },
  retries: DEFAULT_RETRY_COUNT,
};

const runResearchHandler = createRunResearchHandler({
  authorize: authorizeManagedRun,
  executeWorkflow: createResearchWorkflowExecutor({
    readInput: async (event) => {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const { createSupabaseWorkflowInputQueries, createWorkflowInputReader } =
        await import("@/features/research/supabase-workflow-reader");
      return createWorkflowInputReader(
        createSupabaseWorkflowInputQueries(createSupabaseAdminClient()),
      )(event);
    },
    createProviders: () => createResearchProviders(),
    now: () => new Date().toISOString(),
  }),
  createWriter: createManagedWorkflowWriter,
});

export const runManagedResearch = inngest.createFunction(
  runResearchFunctionConfig,
  async ({ event, step, attempt, maxAttempts }) =>
    runResearchHandler({
      event,
      step,
      attempt,
      maxAttempts: maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    }),
);

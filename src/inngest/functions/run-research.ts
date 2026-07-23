import { createDemoResearchFixture } from "@/features/research/fixtures";
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
  SearchProvider,
} from "@/providers/contracts";
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
  authorize: (event: ResearchRequestedEventData) => Promise<unknown>;
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
  createProviders: () => ResearchWorkflowProviders;
  now: () => string;
};

const DEFAULT_RETRY_COUNT = 3 as const;
const DEFAULT_MAX_ATTEMPTS = DEFAULT_RETRY_COUNT + 1;

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
    await authorize(parsedEvent);
    const writer = await createWriter();
    await step.run("begin-research-workflow", () => writer.begin(parsedEvent));
    const executeProviderCall: ProviderCallExecutor = async (
      idempotencyKey,
      operation,
    ) =>
      (await step.run(
        `provider:${idempotencyKey}`,
        operation,
      )) as Awaited<ReturnType<typeof operation>>;

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
    const fixture = createDemoResearchFixture();
    fixture.projects = [input.project];
    fixture.researchRuns = [input.run];
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
      providers: createProviders(),
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

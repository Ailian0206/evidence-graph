import { createDemoResearchFixture } from "@/features/research/fixtures";
import { runResearchWorkflow } from "@/features/research/run-research-workflow";
import {
  createDurableWorkflowWriter,
  createSupabaseWorkflowPersistenceQueries,
  type DurableWorkflowWriter,
} from "@/features/research/supabase-workflow-writer";
import {
  createInMemoryResearchWorkflowStore,
  type ResearchWorkflowSnapshot,
} from "@/features/research/workflow-store";
import { createFixtureResearchProviders } from "@/providers/fixtures/research-providers";
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
  executeWorkflow: (event: ResearchRequestedEventData) => Promise<{
    output: unknown;
    snapshot: ResearchWorkflowSnapshot;
  }>;
  createWriter: () => Promise<DurableWorkflowWriter>;
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
  }: {
    event: { data: ResearchRequestedEventData };
    step: DurableStep;
  }) => {
    const parsedEvent = researchRequestedEventSchema.parse(event.data);
    await authorize(parsedEvent);
    const writer = await createWriter();
    return step.run("run-deterministic-research", async () => {
      await writer.begin(parsedEvent);

      try {
        const execution = await executeWorkflow(parsedEvent);
        await writer.persist({ event: parsedEvent, snapshot: execution.snapshot });
        return execution.output;
      } catch (error) {
        await writer.fail({
          ...parsedEvent,
          errorCode: getStableErrorCode(error),
        });
        throw error;
      }
    });
  };

const authorizeManagedRun = async (event: ResearchRequestedEventData) => {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const client = createSupabaseAdminClient();
  return authorizeResearchRun({
    event,
    readRun: createSupabaseRunAuthorizationReader(client),
  });
};

const executeDeterministicWorkflow = async (event: ResearchRequestedEventData) => {
  const fixture = createDemoResearchFixture();
  fixture.projects = fixture.projects.map((project) => ({
    ...project,
    id: event.projectId,
    ownerId: event.ownerId,
  }));
  fixture.researchRuns = fixture.researchRuns.map((run) => ({
    ...run,
    id: event.runId,
    projectId: event.projectId,
    ownerId: event.ownerId,
  }));
  fixture.sources = [];
  fixture.chunks = [];
  fixture.claims = [];
  fixture.evidenceLinks = [];
  fixture.claimRelations = [];

  const store = createInMemoryResearchWorkflowStore(fixture);
  const result = await runResearchWorkflow({
    runId: event.runId,
    ownerId: event.ownerId,
    manualSources: [],
    providers: createFixtureResearchProviders(),
    store,
    now: () => new Date().toISOString(),
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
  retries: 3 as const,
};

const runResearchHandler = createRunResearchHandler({
  authorize: authorizeManagedRun,
  executeWorkflow: executeDeterministicWorkflow,
  createWriter: createManagedWorkflowWriter,
});

export const runManagedResearch = inngest.createFunction(
  runResearchFunctionConfig,
  async ({ event, step }) => runResearchHandler({ event, step }),
);

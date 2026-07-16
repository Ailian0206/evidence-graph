import { createDemoResearchFixture } from "@/features/research/fixtures";
import { runResearchWorkflow } from "@/features/research/run-research-workflow";
import { createInMemoryResearchWorkflowStore } from "@/features/research/workflow-store";
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
  executeWorkflow: (event: ResearchRequestedEventData) => Promise<unknown>;
};

export const createRunResearchHandler = ({
  authorize,
  executeWorkflow,
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
    return step.run("run-deterministic-research", () => executeWorkflow(parsedEvent));
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
  fixture.sources = fixture.sources.map((source) => ({
    ...source,
    projectId: event.projectId,
  }));
  fixture.chunks = fixture.chunks.map((chunk) => ({
    ...chunk,
    projectId: event.projectId,
  }));
  fixture.claims = fixture.claims.map((claim) => ({
    ...claim,
    projectId: event.projectId,
  }));
  fixture.evidenceLinks = fixture.evidenceLinks.map((link) => ({
    ...link,
    projectId: event.projectId,
  }));
  fixture.claimRelations = fixture.claimRelations.map((relation) => ({
    ...relation,
    projectId: event.projectId,
  }));

  const result = await runResearchWorkflow({
    runId: event.runId,
    ownerId: event.ownerId,
    manualSources: [],
    providers: createFixtureResearchProviders(),
    store: createInMemoryResearchWorkflowStore(fixture),
    now: () => new Date().toISOString(),
  });

  return {
    status: result.run.status,
    completedSteps: result.completedSteps,
    reportId: result.report?.id ?? null,
  };
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
});

export const runManagedResearch = inngest.createFunction(
  runResearchFunctionConfig,
  async ({ event, step }) => runResearchHandler({ event, step }),
);

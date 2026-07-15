import type { ResearchRun } from "@/features/research/domain";
import type { DemoResearchFixture } from "@/features/research/fixtures";
import {
  researchReportSchema,
  runLogEntrySchema,
  workflowCheckpointSchema,
  type ResearchReport,
  type RunLogEntry,
  type WorkflowCheckpoint,
  type WorkflowStep,
} from "@/features/research/workflow-types";

export type InMemoryResearchWorkflowStore = {
  requireRun: (input: { runId: string; ownerId: string }) => ResearchRun;
  getCheckpoint: (runId: string, step: WorkflowStep) => WorkflowCheckpoint | undefined;
  saveCheckpoint: (checkpoint: WorkflowCheckpoint) => WorkflowCheckpoint;
  getReport: (runId: string) => ResearchReport | undefined;
  saveReport: (report: ResearchReport) => ResearchReport;
  appendRunLog: (entry: RunLogEntry) => RunLogEntry;
  listRunLogs: (runId: string) => RunLogEntry[];
};

export const createInMemoryResearchWorkflowStore = (
  fixture: DemoResearchFixture,
): InMemoryResearchWorkflowStore => {
  const runs = new Map(fixture.researchRuns.map((run) => [run.id, run]));
  const sources = new Map(fixture.sources.map((source) => [source.id, source]));
  const chunks = new Map(fixture.chunks.map((chunk) => [chunk.id, chunk]));
  const evidenceLinks = new Map(fixture.evidenceLinks.map((link) => [link.id, link]));
  const checkpoints = new Map<string, WorkflowCheckpoint>();
  const reports = new Map<string, ResearchReport>();
  const runLogs = new Map<string, RunLogEntry>();
  const createCheckpointKey = (runId: string, step: WorkflowStep) => `${runId}:${step}`;

  return {
    requireRun: ({ runId, ownerId }) => {
      const run = runs.get(runId);

      if (!run || run.ownerId !== ownerId) {
        throw new Error("RUN_NOT_FOUND");
      }

      return run;
    },
    getCheckpoint: (runId, step) => checkpoints.get(createCheckpointKey(runId, step)),
    saveCheckpoint: (input) => {
      const checkpoint = workflowCheckpointSchema.parse(input);

      if (!runs.has(checkpoint.runId)) {
        throw new Error("RUN_NOT_FOUND");
      }

      const key = createCheckpointKey(checkpoint.runId, checkpoint.step);
      const current = checkpoints.get(key);

      if (current) {
        if (current.idempotencyKey !== checkpoint.idempotencyKey) {
          throw new Error("STEP_ALREADY_COMPLETED");
        }

        return current;
      }

      checkpoints.set(key, checkpoint);
      return checkpoint;
    },
    getReport: (runId) => reports.get(runId),
    saveReport: (input) => {
      const report = researchReportSchema.parse(input);
      const run = runs.get(report.runId);

      if (!run || run.projectId !== report.projectId) {
        throw new Error("RUN_NOT_FOUND");
      }

      const citations = new Map(
        report.citations.map((citation) => [citation.evidenceLinkId, citation]),
      );

      for (const section of report.sections) {
        if (section.factual && section.citationIds.length === 0) {
          throw new Error("REPORT_CITATION_REQUIRED");
        }

        for (const citationId of section.citationIds) {
          if (!citations.has(citationId)) {
            throw new Error("REPORT_CITATION_NOT_FOUND");
          }
        }
      }

      for (const citation of report.citations) {
        const link = evidenceLinks.get(citation.evidenceLinkId);
        const chunk = chunks.get(citation.chunkId);
        const source = sources.get(citation.sourceId);

        if (!link) {
          throw new Error("EVIDENCE_LINK_NOT_FOUND");
        }

        if (
          !chunk ||
          !source ||
          link.claimId !== citation.claimId ||
          link.chunkId !== citation.chunkId ||
          link.quote !== citation.quote ||
          chunk.sourceId !== citation.sourceId ||
          source.canonicalUrl !== citation.sourceUrl ||
          source.title !== citation.sourceTitle
        ) {
          throw new Error("REPORT_CITATION_INVALID");
        }
      }

      const current = reports.get(report.runId);

      if (current) {
        if (current.id !== report.id) {
          throw new Error("REPORT_ALREADY_EXISTS");
        }

        return current;
      }

      reports.set(report.runId, report);
      return report;
    },
    appendRunLog: (input) => {
      const entry = runLogEntrySchema.parse(input);

      if (!runs.has(entry.runId)) {
        throw new Error("RUN_NOT_FOUND");
      }

      const current = runLogs.get(entry.id);

      if (current) {
        return current;
      }

      runLogs.set(entry.id, entry);
      return entry;
    },
    listRunLogs: (runId) =>
      Array.from(runLogs.values())
        .filter((entry) => entry.runId === runId)
        .sort(
          (left, right) =>
            left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id),
        ),
  };
};

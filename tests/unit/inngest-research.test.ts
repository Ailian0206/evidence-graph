import { NonRetriableError } from "inngest";
import { describe, expect, it, vi } from "vitest";

import { authorizeResearchRun } from "@/inngest/authorize-run";
import { createResearchRequestedPayload } from "@/inngest/client";
import { researchRequestedEventSchema } from "@/inngest/events";
import {
  createRunResearchHandler,
  runResearchFunctionConfig,
} from "@/inngest/functions/run-research";

const eventData = {
  ownerId: "owner_1",
  projectId: "project_1",
  runId: "run_1",
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

  it("authorizes before running the deterministic workflow in a durable step", async () => {
    const calls: string[] = [];
    const authorize = vi.fn(async () => {
      calls.push("authorize");
    });
    const executeWorkflow = vi.fn(async () => {
      calls.push("execute");
      return { status: "ready" };
    });
    const step = {
      run: vi.fn(async (id: string, operation: () => Promise<unknown>) => {
        calls.push(`step:${id}`);
        return operation();
      }),
    };
    const handler = createRunResearchHandler({ authorize, executeWorkflow });

    await expect(handler({ event: { data: eventData }, step })).resolves.toEqual({
      status: "ready",
    });
    expect(calls).toEqual(["authorize", "step:run-deterministic-research", "execute"]);
    expect(executeWorkflow).toHaveBeenCalledWith(eventData);
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

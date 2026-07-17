import { describe, expect, it, vi } from "vitest";

import type { ProjectStore } from "@/features/projects/project-store";
import { submitManagedResearch } from "@/features/projects/research-submission";

const input = {
  title: "Durable research",
  question: "How are workflow results persisted?",
  language: "en" as const,
  manualUrls: ["https://example.com/source"],
};

const createdResearch = {
  project: {
    id: "project_1",
    ownerId: "owner_1",
    title: input.title,
    question: input.question,
    language: input.language,
    status: "active" as const,
    visibility: "private" as const,
    slug: "research-project_1",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  },
  run: {
    id: "run_1",
    ownerId: "owner_1",
    projectId: "project_1",
    status: "queued" as const,
    step: "queued" as const,
    sourceLimit: 12,
    manualUrlLimit: 5,
    maxContentChars: 200000,
    estimatedCostUsd: 0,
    searchCount: 0,
    tokenCount: 0,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  },
};

const createStore = (overrides: Partial<ProjectStore> = {}): ProjectStore => ({
  listProjects: vi.fn(async () => []),
  getProject: vi.fn(async () => createdResearch.project),
  createResearch: vi.fn(async () => createdResearch),
  markResearchDispatchFailed: vi.fn(async () => undefined),
  updateProject: vi.fn(async () => createdResearch.project),
  deleteProject: vi.fn(async () => undefined),
  ...overrides,
});

describe("managed research submission", () => {
  it("authorizes, creates, and dispatches in order", async () => {
    const calls: string[] = [];
    const store = createStore({
      createResearch: vi.fn(async () => {
        calls.push("create");
        return createdResearch;
      }),
    });
    const requireUser = vi.fn(async () => {
      calls.push("authorize");
      return { id: "owner_1" };
    });
    const sendEvent = vi.fn(async () => {
      calls.push("dispatch");
    });

    await expect(
      submitManagedResearch({
        locale: "en",
        input,
        dependencies: {
          requireUser,
          createStore: async () => store,
          sendEvent,
        },
      }),
    ).resolves.toEqual({
      ok: true,
      projectId: "project_1",
      runId: "run_1",
      dispatchFailed: false,
    });
    expect(calls).toEqual(["authorize", "create", "dispatch"]);
    expect(sendEvent).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
      runId: "run_1",
    });
  });

  it("does not dispatch when the atomic create fails", async () => {
    const store = createStore({
      createResearch: vi.fn(async () => {
        throw new Error("MONTHLY_RUN_LIMIT_EXCEEDED");
      }),
    });
    const sendEvent = vi.fn();

    await expect(
      submitManagedResearch({
        locale: "zh",
        input,
        dependencies: {
          requireUser: async () => ({ id: "owner_1" }),
          createStore: async () => store,
          sendEvent,
        },
      }),
    ).resolves.toEqual({ ok: false, code: "MONTHLY_RUN_LIMIT_EXCEEDED" });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it("marks the created run when dispatch fails", async () => {
    const markResearchDispatchFailed = vi.fn(async () => undefined);
    const store = createStore({ markResearchDispatchFailed });

    await expect(
      submitManagedResearch({
        locale: "zh",
        input,
        dependencies: {
          requireUser: async () => ({ id: "owner_1" }),
          createStore: async () => store,
          sendEvent: async () => {
            throw new Error("INNGEST_UNAVAILABLE");
          },
        },
      }),
    ).resolves.toEqual({
      ok: true,
      projectId: "project_1",
      runId: "run_1",
      dispatchFailed: true,
    });
    expect(markResearchDispatchFailed).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
      runId: "run_1",
    });
  });
});

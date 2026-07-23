import { describe, expect, it, vi } from "vitest";

import { createResearchInputSchema } from "@/features/projects/project-store";
import {
  createSupabaseProjectRepository,
  type ProjectQueryAdapter,
  type ProjectRow,
  type ResearchRunRow,
} from "@/features/projects/supabase-project-repository";
import { manualSourceUrlSchema } from "@/features/sources/manual-source-url";

const projectRow: ProjectRow = {
  id: "project_1",
  owner_id: "owner_1",
  title: "可核查的 AI 研究",
  question: "精确引用如何降低研究审核成本？",
  language: "zh",
  status: "active",
  visibility: "private",
  slug: "research-project_1",
  created_at: "2026-07-16T08:00:00.000Z",
  updated_at: "2026-07-16T08:00:00.000Z",
};

const runRow: ResearchRunRow = {
  id: "run_1",
  project_id: "project_1",
  owner_id: "owner_1",
  status: "queued",
  step: "queued",
  source_limit: 12,
  manual_url_limit: 5,
  manual_urls: ["https://research.example.com/source-1"],
  max_content_chars: 200000,
  estimated_cost_usd: 0,
  search_count: 0,
  token_count: 0,
  error_message: null,
  created_at: "2026-07-16T08:00:00.000Z",
  updated_at: "2026-07-16T08:00:00.000Z",
};

const createQueries = (
  overrides: Partial<ProjectQueryAdapter> = {},
): ProjectQueryAdapter => ({
  listProjects: vi.fn(async () => [projectRow]),
  getProject: vi.fn(async () => projectRow),
  createResearch: vi.fn(async () => ({ project: projectRow, run: runRow })),
  markResearchDispatchFailed: vi.fn(async () => undefined),
  updateProject: vi.fn(async () => projectRow),
  deleteProject: vi.fn(async () => projectRow),
  ...overrides,
});

const createRepository = (queries: ProjectQueryAdapter) =>
  createSupabaseProjectRepository({
    queries,
    createProjectId: () => "project_1",
    createRunId: () => "run_1",
  });

describe("Supabase project repository", () => {
  it("maps database rows and scopes list queries to the current owner", async () => {
    const queries = createQueries();
    const repository = createRepository(queries);

    await expect(repository.listProjects({ ownerId: "owner_1" })).resolves.toEqual([
      {
        id: "project_1",
        ownerId: "owner_1",
        title: "可核查的 AI 研究",
        question: "精确引用如何降低研究审核成本？",
        language: "zh",
        status: "active",
        visibility: "private",
        slug: "research-project_1",
        createdAt: "2026-07-16T08:00:00.000Z",
        updatedAt: "2026-07-16T08:00:00.000Z",
      },
    ]);
    expect(queries.listProjects).toHaveBeenCalledWith({ ownerId: "owner_1" });
  });

  it("normalizes Postgres timestamp offsets to domain ISO datetimes", async () => {
    const queries = createQueries({
      listProjects: vi.fn(async () => [
        {
          ...projectRow,
          created_at: "2026-07-16T08:00:00+00:00",
          updated_at: "2026-07-16T16:30:00+08:00",
        },
      ]),
    });
    const repository = createRepository(queries);

    await expect(repository.listProjects({ ownerId: "owner_1" })).resolves.toEqual([
      expect.objectContaining({
        createdAt: "2026-07-16T08:00:00.000Z",
        updatedAt: "2026-07-16T08:30:00.000Z",
      }),
    ]);
  });

  it("passes the current owner to get, update, and delete queries", async () => {
    const queries = createQueries();
    const repository = createRepository(queries);

    await repository.getProject({ ownerId: "owner_1", projectId: "project_1" });
    await repository.updateProject({
      ownerId: "owner_1",
      projectId: "project_1",
      input: { title: "更新后的研究标题" },
    });
    await repository.deleteProject({ ownerId: "owner_1", projectId: "project_1" });

    expect(queries.getProject).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
    });
    expect(queries.updateProject).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "owner_1", projectId: "project_1" }),
    );
    expect(queries.deleteProject).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
    });
  });

  it.each(["getProject", "updateProject", "deleteProject"] as const)(
    "maps an empty %s result to PROJECT_NOT_FOUND",
    async (method) => {
      const queries = createQueries({ [method]: vi.fn(async () => null) });
      const repository = createRepository(queries);
      const operation =
        method === "getProject"
          ? repository.getProject({ ownerId: "owner_2", projectId: "project_1" })
          : method === "updateProject"
            ? repository.updateProject({
                ownerId: "owner_2",
                projectId: "project_1",
                input: { title: "不能更新其他用户的项目" },
              })
            : repository.deleteProject({ ownerId: "owner_2", projectId: "project_1" });

      await expect(operation).rejects.toThrow("PROJECT_NOT_FOUND");
    },
  );

  it("validates project input before writing", async () => {
    const queries = createQueries();
    const repository = createRepository(queries);

    await expect(
      repository.createResearch({
        ownerId: "owner_1",
        input: { title: " ", question: "", language: "zh", manualUrls: [] },
      }),
    ).rejects.toThrow();
    expect(queries.createResearch).not.toHaveBeenCalled();
  });

  it("maps the atomic RPC monthly limit error", async () => {
    const queries = createQueries({
      createResearch: vi.fn(async () => {
        throw new Error("MONTHLY_RUN_LIMIT_EXCEEDED");
      }),
    });
    const repository = createRepository(queries);

    await expect(
      repository.createResearch({
        ownerId: "owner_1",
        input: {
          title: "新的研究项目",
          question: "不同来源的主张冲突应该如何呈现？",
          language: "zh",
          manualUrls: [],
        },
      }),
    ).rejects.toThrow("MONTHLY_RUN_LIMIT_EXCEEDED");
    expect(queries.createResearch).toHaveBeenCalledTimes(1);
  });

  it("creates a project and queued run from one atomic query", async () => {
    const queries = createQueries();
    const repository = createRepository(queries);

    await expect(
      repository.createResearch({
        ownerId: "owner_1",
        input: {
          title: " 可核查的 AI 研究 ",
          question: " 精确引用如何降低研究审核成本？ ",
          language: "zh",
          manualUrls: ["https://research.example.com/source-1"],
        },
      }),
    ).resolves.toEqual({
      project: expect.objectContaining({ id: "project_1", ownerId: "owner_1" }),
      run: expect.objectContaining({
        id: "run_1",
        ownerId: "owner_1",
        projectId: "project_1",
        status: "queued",
      }),
    });

    expect(queries.createResearch).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
      runId: "run_1",
      slug: "research-project_1",
      input: {
        title: "可核查的 AI 研究",
        question: "精确引用如何降低研究审核成本？",
        language: "zh",
        manualUrls: ["https://research.example.com/source-1"],
      },
    });
  });

  it("marks only the owned run as dispatch failed", async () => {
    const queries = createQueries();
    const repository = createRepository(queries);

    await repository.markResearchDispatchFailed({
      ownerId: "owner_1",
      projectId: "project_1",
      runId: "run_1",
    });

    expect(queries.markResearchDispatchFailed).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
      runId: "run_1",
    });
  });

  it("accepts at most five valid manual source URLs", () => {
    expect(
      createResearchInputSchema.parse({
        title: "来源核查",
        question: "这些来源是否支持目标主张？",
        language: "zh",
        manualUrls: ["https://research.example.com/source-1"],
      }),
    ).toEqual({
      title: "来源核查",
      question: "这些来源是否支持目标主张？",
      language: "zh",
      manualUrls: ["https://research.example.com/source-1"],
    });
    expect(() =>
      createResearchInputSchema.parse({
        title: "来源核查",
        question: "这些来源是否支持目标主张？",
        language: "zh",
        manualUrls: Array.from(
          { length: 6 },
          (_, index) => `https://research.example.com/source-${index}`,
        ),
      }),
    ).toThrow();
    expect(() =>
      createResearchInputSchema.parse({
        title: "来源核查",
        question: "这些来源是否支持目标主张？",
        language: "zh",
        manualUrls: ["not-a-url"],
      }),
    ).toThrow();
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
  ])("rejects unsafe manual source URL %s", (manualUrl) => {
    expect(() =>
      createResearchInputSchema.parse({
        title: "来源核查",
        question: "这些来源是否支持目标主张？",
        language: "zh",
        manualUrls: [manualUrl],
      }),
    ).toThrow();
  });

  it.each([
    "http://research.example.com/source",
    "https://research.example.com/source",
  ])("accepts external HTTP(S) manual source URL %s", (manualUrl) => {
    expect(
      createResearchInputSchema.parse({
        title: "来源核查",
        question: "这些来源是否支持目标主张？",
        language: "zh",
        manualUrls: [manualUrl],
      }).manualUrls,
    ).toEqual([manualUrl]);
  });

  it("returns a failed parse instead of throwing for a malformed manual URL", () => {
    let result: ReturnType<typeof manualSourceUrlSchema.safeParse> | undefined;

    expect(() => {
      result = manualSourceUrlSchema.safeParse("not-a-url");
    }).not.toThrow();
    expect(result).toMatchObject({ success: false });
  });
});

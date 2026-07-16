import { describe, expect, it, vi } from "vitest";

import { createResearchInputSchema } from "@/features/projects/project-store";
import {
  createSupabaseProjectRepository,
  type ProjectQueryAdapter,
  type ProjectRow,
} from "@/features/projects/supabase-project-repository";

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

const createQueries = (
  overrides: Partial<ProjectQueryAdapter> = {},
): ProjectQueryAdapter => ({
  listProjects: vi.fn(async () => [projectRow]),
  getProject: vi.fn(async () => projectRow),
  insertProject: vi.fn(async () => projectRow),
  updateProject: vi.fn(async () => projectRow),
  deleteProject: vi.fn(async () => projectRow),
  getMonthlyUsage: vi.fn(async () => null),
  ...overrides,
});

const createRepository = (queries: ProjectQueryAdapter) =>
  createSupabaseProjectRepository({
    queries,
    createId: () => "project_1",
    now: () => new Date("2026-07-16T08:00:00.000Z"),
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
      repository.createProject({
        ownerId: "owner_1",
        input: { title: " ", question: "", language: "zh" },
      }),
    ).rejects.toThrow();
    expect(queries.getMonthlyUsage).not.toHaveBeenCalled();
    expect(queries.insertProject).not.toHaveBeenCalled();
  });

  it("blocks a fourth monthly research run before writing", async () => {
    const queries = createQueries({
      getMonthlyUsage: vi.fn(async () => ({ run_count: 3 })),
    });
    const repository = createRepository(queries);

    await expect(
      repository.createProject({
        ownerId: "owner_1",
        input: {
          title: "新的研究项目",
          question: "不同来源的主张冲突应该如何呈现？",
          language: "zh",
        },
      }),
    ).rejects.toThrow("MONTHLY_RUN_LIMIT_EXCEEDED");
    expect(queries.getMonthlyUsage).toHaveBeenCalledWith({
      ownerId: "owner_1",
      month: "2026-07-01",
    });
    expect(queries.insertProject).not.toHaveBeenCalled();
  });

  it("creates a private active project from validated input", async () => {
    const queries = createQueries();
    const repository = createRepository(queries);

    await repository.createProject({
      ownerId: "owner_1",
      input: {
        title: " 可核查的 AI 研究 ",
        question: " 精确引用如何降低研究审核成本？ ",
        language: "zh",
      },
    });

    expect(queries.insertProject).toHaveBeenCalledWith({
      ownerId: "owner_1",
      row: {
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
      },
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
});

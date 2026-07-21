import { describe, expect, it, vi } from "vitest";

import {
  publishManagedReport,
  revokeManagedReport,
} from "@/features/reports/actions";

const publishedResult = {
  id: "report_v2",
  slug: "research-project-1",
  version: 2,
  status: "published" as const,
  publishedAt: "2026-07-17T10:00:00.000Z",
};

const createStore = () => ({
  listVersions: vi.fn(async () => []),
  publish: vi.fn(async () => publishedResult),
  revoke: vi.fn(async () => ({
    slug: "research-project-1",
    reportId: "report_v2",
  })),
  getPublicReport: vi.fn(),
});

describe("report publishing actions", () => {
  it("authorizes before publishing and revalidates only trusted paths", async () => {
    const calls: string[] = [];
    const store = createStore();
    store.publish.mockImplementation(async () => {
      calls.push("publish");
      return publishedResult;
    });
    const revalidate = vi.fn((path: string) => calls.push(`revalidate:${path}`));

    const result = await publishManagedReport(
      { locale: "zh", projectId: "project_1", reportId: "report_v2" },
      {
        requireUser: async () => {
          calls.push("authorize");
          return { id: "owner_1" };
        },
        createStore: () => store,
        revalidate,
      },
    );

    expect(result).toEqual({
      ok: true,
      slug: "research-project-1",
      version: 2,
      publishedAt: "2026-07-17T10:00:00.000Z",
    });
    expect(calls).toEqual([
      "authorize",
      "publish",
      "revalidate:/zh/app/research/project_1",
      "revalidate:/r/research-project-1",
    ]);
    expect(store.publish).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
      reportId: "report_v2",
    });
  });

  it("revalidates the workspace and trusted public slug after revocation", async () => {
    const store = createStore();
    const revalidate = vi.fn();

    await expect(
      revokeManagedReport(
        { locale: "en", projectId: "project_1" },
        {
          requireUser: async () => ({ id: "owner_1" }),
          createStore: () => store,
          revalidate,
        },
      ),
    ).resolves.toEqual({ ok: true, slug: "research-project-1" });

    expect(store.revoke).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
    });
    expect(revalidate).toHaveBeenNthCalledWith(1, "/en/app/research/project_1");
    expect(revalidate).toHaveBeenNthCalledWith(2, "/r/research-project-1");
  });

  it.each([
    {
      name: "locale",
      invoke: publishManagedReport,
      input: { locale: "fr", projectId: "project_1", reportId: "report_v2" },
    },
    {
      name: "project id",
      invoke: publishManagedReport,
      input: { locale: "zh", projectId: "", reportId: "report_v2" },
    },
    {
      name: "report id",
      invoke: publishManagedReport,
      input: { locale: "zh", projectId: "project_1", reportId: " " },
    },
    {
      name: "revocation project id",
      invoke: revokeManagedReport,
      input: { locale: "en", projectId: "" },
    },
  ])("rejects an invalid $name before authentication or writing", async ({ invoke, input }) => {
    const requireUser = vi.fn();
    const createStore = vi.fn();

    await expect(
      invoke(input as never, {
        requireUser,
        createStore,
        revalidate: vi.fn(),
      }),
    ).resolves.toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(requireUser).not.toHaveBeenCalled();
    expect(createStore).not.toHaveBeenCalled();
  });

  it("does not create a store when authentication fails", async () => {
    const createStore = vi.fn();

    await expect(
      publishManagedReport(
        { locale: "zh", projectId: "project_1", reportId: "report_v2" },
        {
          requireUser: async () => {
            throw new Error("AUTH_REQUIRED");
          },
          createStore,
          revalidate: vi.fn(),
        },
      ),
    ).rejects.toThrow("AUTH_REQUIRED");
    expect(createStore).not.toHaveBeenCalled();
  });

  it("returns stable report errors without revalidating", async () => {
    const store = createStore();
    store.publish.mockRejectedValue(new Error("REPORT_NOT_PUBLISHABLE"));
    const revalidate = vi.fn();

    await expect(
      publishManagedReport(
        { locale: "en", projectId: "project_1", reportId: "report_v2" },
        {
          requireUser: async () => ({ id: "owner_1" }),
          createStore: () => store,
          revalidate,
        },
      ),
    ).resolves.toEqual({ ok: false, code: "REPORT_NOT_PUBLISHABLE" });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("does not expose unknown database details", async () => {
    const store = createStore();
    store.revoke.mockRejectedValue(new Error("private database connection detail"));

    const result = await revokeManagedReport(
      { locale: "zh", projectId: "project_1" },
      {
        requireUser: async () => ({ id: "owner_1" }),
        createStore: () => store,
        revalidate: vi.fn(),
      },
    );

    expect(result).toEqual({ ok: false, code: "REPORT_ACTION_FAILED" });
    expect(JSON.stringify(result)).not.toContain("database connection");
  });
});

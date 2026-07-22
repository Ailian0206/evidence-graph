import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(async () => ({ client: true })),
  load: vi.fn(async () => ({ state: "queued" as const, runId: "run_1" })),
  requireManagedUser: vi.fn(async () => ({ id: "owner_1" })),
}));

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

vi.mock("@/components/evidence-workspace/evidence-workspace", () => ({
  EvidenceWorkspace: () => null,
}));
vi.mock("@/components/evidence-workspace/managed-workspace-state", () => ({
  ManagedWorkspaceState: () => null,
}));
vi.mock("@/features/auth/server-session", () => ({
  requireManagedUser: mocks.requireManagedUser,
}));
vi.mock("@/features/research/evidence-workspace-fixture", () => ({
  createEvidenceWorkspaceFixture: vi.fn(),
}));
vi.mock("@/features/research/managed-workspace-store", () => ({
  createManagedWorkspaceStore: () => ({ load: mocks.load }),
  createSupabaseManagedWorkspaceQueryAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import WorkspacePage, * as workspacePageModule from "@/app/[locale]/app/research/[id]/page";

describe("managed workspace page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not opt the authenticated workspace route into static generation", () => {
    expect(workspacePageModule).not.toHaveProperty("generateStaticParams");
  });

  it("loads the managed user session for a real project", async () => {
    await WorkspacePage({
      params: Promise.resolve({ locale: "zh", id: "project_1" }),
    });

    expect(mocks.requireManagedUser).toHaveBeenCalledOnce();
    expect(mocks.load).toHaveBeenCalledWith({
      ownerId: "owner_1",
      projectId: "project_1",
      locale: "zh",
    });
  });
});

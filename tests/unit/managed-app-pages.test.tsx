import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listProjects: vi.fn(async () => []),
  requireManagedUser: vi.fn(async () => ({
    id: "owner_1",
    email: "user@example.com",
    displayName: "ailian",
  })),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
}));
vi.mock("@/components/projects/managed-app-shell", () => ({
  ManagedAppShell: () => null,
}));
vi.mock("@/components/projects/new-research-form", () => ({
  NewResearchForm: () => null,
}));
vi.mock("@/components/projects/project-dashboard", () => ({
  ProjectDashboard: () => null,
}));
vi.mock("@/features/auth/server-session", () => ({
  requireManagedUser: mocks.requireManagedUser,
}));
vi.mock("@/features/projects/supabase-project-repository", () => ({
  createSupabaseProjectQueryAdapter: vi.fn(() => ({})),
  createSupabaseProjectRepository: vi.fn(() => ({ listProjects: mocks.listProjects })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

import ProjectDashboardPage from "@/app/[locale]/app/page";
import NewResearchPage from "@/app/[locale]/app/research/new/page";
import { ManagedAppShell } from "@/components/projects/managed-app-shell";

describe("managed app pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wraps the project dashboard with account navigation", async () => {
    const page = await ProjectDashboardPage({ params: Promise.resolve({ locale: "zh" }) });

    expect(page.type).toBe(ManagedAppShell);
    expect(page.props).toMatchObject({
      active: "projects",
      locale: "zh",
      user: { displayName: "ailian", email: "user@example.com" },
    });
  });

  it("wraps the new research form with account navigation", async () => {
    const page = await NewResearchPage({ params: Promise.resolve({ locale: "en" }) });

    expect(page.type).toBe(ManagedAppShell);
    expect(page.props).toMatchObject({
      active: "projects",
      locale: "en",
      user: { displayName: "ailian", email: "user@example.com" },
    });
  });
});

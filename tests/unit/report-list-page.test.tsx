import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(async () => []),
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
vi.mock("@/components/reports/report-dashboard", () => ({
  ReportDashboard: () => null,
}));
vi.mock("@/features/auth/server-session", () => ({
  requireManagedUser: mocks.requireManagedUser,
}));
vi.mock("@/features/reports/report-list-store", () => ({
  createManagedReportListStore: vi.fn(() => ({ list: mocks.list })),
  createSupabaseReportListQueryAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

import ReportListPage from "@/app/[locale]/app/reports/page";
import { ManagedAppShell } from "@/components/projects/managed-app-shell";

describe("managed report list page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorizes, loads owner reports, and selects report navigation", async () => {
    const page = await ReportListPage({ params: Promise.resolve({ locale: "zh" }) });

    expect(mocks.requireManagedUser).toHaveBeenCalledWith({
      locale: "zh",
      nextPath: "/zh/app/reports",
    });
    expect(mocks.list).toHaveBeenCalledWith({ ownerId: "owner_1" });
    expect(page.type).toBe(ManagedAppShell);
    expect(page.props).toMatchObject({
      active: "reports",
      locale: "zh",
      user: { displayName: "ailian", email: "user@example.com" },
    });
  });
});

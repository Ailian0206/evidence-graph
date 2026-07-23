import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const translations = {
    en: {
      description: "Continue to the research workspace with GitHub.",
      error: "Sign-in did not complete. Try again.",
      eyebrow: "Account access",
      github: "Sign in with GitHub",
      "local.action": "Enter local research workspace",
      "local.description": "Connects only to local Supabase data.",
      title: "Sign in to Evidence Graph",
      unconfigured: "Managed sign-in is not configured",
    },
    zh: {
      description: "使用 GitHub 继续到研究工作台。",
      error: "登录没有完成，请重新尝试。",
      eyebrow: "账户访问",
      github: "使用 GitHub 登录",
      "local.action": "进入本地研究环境",
      "local.description": "仅连接本机 Supabase 数据。",
      title: "登录 Evidence Graph",
      unconfigured: "托管登录尚未配置",
    },
  } as const;

  return {
    createSupabaseServerClient: vi.fn(),
    currentLocale: "en" as "en" | "zh",
    redirect: vi.fn(),
    signInAnonymously: vi.fn(),
    translations,
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ origin: "http://127.0.0.1:3218" })),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: keyof typeof mocks.translations.en) =>
    mocks.translations[mocks.currentLocale][key]),
  setRequestLocale: vi.fn((locale: "en" | "zh") => {
    mocks.currentLocale = locale;
  }),
}));
vi.mock("@/lib/supabase/config", () => ({
  isSupabasePublicConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import LoginPage from "@/app/[locale]/auth/login/page";
import { signInForLocalDevelopment } from "@/features/auth/actions";
import { isLocalDevelopmentAuthEnabled } from "@/features/auth/local-development";

const enableLocalAuth = () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("LOCAL_DEV_AUTH_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
};

describe("local development authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentLocale = "en";
    mocks.signInAnonymously.mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { signInAnonymously: mocks.signInAnonymously },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("enables anonymous auth only for a non-production loopback environment", () => {
    expect(
      isLocalDevelopmentAuthEnabled({
        nodeEnv: "development",
        enabled: "true",
        supabaseUrl: "http://127.0.0.1:54321",
      }),
    ).toBe(true);
    expect(
      isLocalDevelopmentAuthEnabled({
        nodeEnv: "test",
        enabled: "true",
        supabaseUrl: "http://localhost:54321",
      }),
    ).toBe(true);
    expect(
      isLocalDevelopmentAuthEnabled({
        nodeEnv: "production",
        enabled: "true",
        supabaseUrl: "http://127.0.0.1:54321",
      }),
    ).toBe(false);
    expect(
      isLocalDevelopmentAuthEnabled({
        nodeEnv: "development",
        enabled: "true",
        supabaseUrl: "https://example.supabase.co",
      }),
    ).toBe(false);
    expect(
      isLocalDevelopmentAuthEnabled({
        nodeEnv: "development",
        enabled: undefined,
        supabaseUrl: "http://127.0.0.1:54321",
      }),
    ).toBe(false);
  });

  it.each([
    ["zh" as const, "进入本地研究环境", "仅连接本机 Supabase 数据。"],
    [
      "en" as const,
      "Enter local research workspace",
      "Connects only to local Supabase data.",
    ],
  ])("renders the %s local entry when the gate is enabled", async (
    locale,
    actionLabel,
    description,
  ) => {
    enableLocalAuth();

    render(
      await LoginPage({
        params: Promise.resolve({ locale }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByRole("button", { name: actionLabel })).toBeVisible();
    expect(screen.getByText(description)).toBeVisible();
  });

  it("does not render the local entry when the gate is disabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_DEV_AUTH_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");

    render(
      await LoginPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.queryByRole("button", { name: "Enter local research workspace" }),
    ).not.toBeInTheDocument();
  });

  it("rechecks the gate before creating an anonymous session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_DEV_AUTH_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");

    await expect(
      signInForLocalDevelopment("zh", "/zh/app"),
    ).rejects.toThrow("LOCAL_DEV_AUTH_DISABLED");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("creates a local anonymous session and redirects to a safe app path", async () => {
    enableLocalAuth();

    await signInForLocalDevelopment("zh", "https://example.com/not-local");

    expect(mocks.signInAnonymously).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/zh/app");
  });

  it("does not expose the Supabase error when anonymous sign-in fails", async () => {
    enableLocalAuth();
    mocks.signInAnonymously.mockResolvedValue({
      error: new Error("provider-secret-response"),
    });

    await expect(signInForLocalDevelopment("en", "/en/app")).rejects.toThrow(
      "LOCAL_DEV_AUTH_FAILED",
    );

    try {
      await signInForLocalDevelopment("en", "/en/app");
    } catch (error) {
      expect(String(error)).not.toContain("provider-secret-response");
    }
  });
});

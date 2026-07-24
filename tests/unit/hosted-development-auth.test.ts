import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  redirect: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ origin: "http://127.0.0.1:3218" })),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { GET as handleOAuthCallback } from "@/app/auth/callback/route";
import { signInWithGitHub } from "@/features/auth/actions";

describe("hosted development authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://github.example/authorize" },
      error: null,
    });
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: mocks.exchangeCodeForSession,
        signInWithOAuth: mocks.signInWithOAuth,
      },
    });
  });

  it("uses the loopback callback and rejects an external return path", async () => {
    await signInWithGitHub("zh", "https://attacker.example/escape");

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: {
        redirectTo:
          "http://127.0.0.1:3218/auth/callback?locale=zh&next=%2Fzh%2Fapp",
      },
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "https://github.example/authorize",
    );
  });

  it("keeps only GitHub OAuth in the local authentication path", async () => {
    const [actions, loginPage, config] = await Promise.all([
      readFile(join(process.cwd(), "src/features/auth/actions.ts"), "utf8"),
      readFile(
        join(process.cwd(), "src/app/[locale]/auth/login/page.tsx"),
        "utf8",
      ),
      readFile(join(process.cwd(), "supabase/config.toml"), "utf8"),
    ]);

    expect(actions).not.toContain("signInAnonymously");
    expect(loginPage).not.toContain("signInForLocalDevelopment");
    expect(config).toContain("enable_anonymous_sign_ins = false");
    expect(config).toContain(
      'additional_redirect_urls = ["http://127.0.0.1:3218/auth/callback"]',
    );
  });

  it("keeps the OAuth callback redirect on the browser's current host", async () => {
    mocks.redirect.mockImplementationOnce((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });

    await expect(
      handleOAuthCallback(
        new Request(
          "http://localhost:3218/auth/callback?code=oauth_code&locale=zh&next=%2Fzh%2Fapp",
        ),
      ),
    ).rejects.toThrow("REDIRECT:/zh/app");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("oauth_code");
  });
});

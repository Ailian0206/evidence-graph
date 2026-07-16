import { describe, expect, it } from "vitest";

import {
  createLoginRedirect,
  requireUser,
} from "@/features/auth/session";

describe("managed authentication session", () => {
  it("returns the minimum authenticated user shape", async () => {
    await expect(
      requireUser({
        locale: "zh",
        getUser: async () => ({ id: "user_1", email: "user@example.com" }),
        redirectTo: () => {
          throw new Error("UNEXPECTED_REDIRECT");
        },
      }),
    ).resolves.toEqual({ id: "user_1", email: "user@example.com" });
  });

  it("redirects anonymous users to the localized login page", async () => {
    await expect(
      requireUser({
        locale: "en",
        nextPath: "/en/app/research/project_1",
        getUser: async () => null,
        redirectTo: (path) => {
          throw new Error(`REDIRECT:${path}`);
        },
      }),
    ).rejects.toThrow(
      "REDIRECT:/en/auth/login?next=%2Fen%2Fapp%2Fresearch%2Fproject_1",
    );
  });

  it("rejects external and cross-locale return paths", () => {
    expect(createLoginRedirect({ locale: "zh", nextPath: "https://attacker.example" })).toBe(
      "/zh/auth/login?next=%2Fzh%2Fapp",
    );
    expect(createLoginRedirect({ locale: "zh", nextPath: "/en/app" })).toBe(
      "/zh/auth/login?next=%2Fzh%2Fapp",
    );
  });

  it("does not treat provider failures as anonymous sessions", async () => {
    await expect(
      requireUser({
        locale: "zh",
        getUser: async () => {
          throw new Error("AUTH_PROVIDER_UNAVAILABLE");
        },
        redirectTo: () => {
          throw new Error("UNEXPECTED_REDIRECT");
        },
      }),
    ).rejects.toThrow("AUTH_PROVIDER_UNAVAILABLE");
  });
});

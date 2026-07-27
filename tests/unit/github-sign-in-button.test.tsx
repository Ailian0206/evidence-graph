import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const formStatus = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: formStatus.pending }),
}));

import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";

describe("GitHub sign-in button", () => {
  beforeEach(() => {
    formStatus.pending = false;
  });

  afterEach(cleanup);

  it("shows the normal sign-in command while idle", () => {
    render(
      <GitHubSignInButton
        configured
        label="使用 GitHub 登录"
        pendingLabel="正在前往 GitHub..."
      />,
    );

    expect(screen.getByRole("button", { name: "使用 GitHub 登录" })).toBeEnabled();
  });

  it("shows immediate feedback while the OAuth action is pending", () => {
    formStatus.pending = true;
    render(
      <GitHubSignInButton
        configured
        label="使用 GitHub 登录"
        pendingLabel="正在前往 GitHub..."
      />,
    );

    expect(screen.getByRole("button", { name: "正在前往 GitHub..." })).toBeDisabled();
    expect(screen.getByTestId("github-login-loading")).toHaveAttribute(
      "data-loading-indicator",
      "true",
    );
  });
});

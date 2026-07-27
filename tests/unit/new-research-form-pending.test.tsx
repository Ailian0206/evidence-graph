import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../messages/zh.json";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: () => [{ status: "idle" }, vi.fn(), true],
}));

vi.mock("@/features/projects/actions", () => ({
  createResearch: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={`/zh${href}`} {...props}>
      {children}
    </a>
  ),
}));

import { NewResearchForm } from "@/components/projects/new-research-form";

afterEach(cleanup);

describe("new research pending state", () => {
  it("shows a loading indicator while the research is being created", () => {
    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <NewResearchForm locale="zh" />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("button", { name: "正在创建..." })).toBeDisabled();
    expect(screen.getByTestId("research-create-loading")).toHaveAttribute(
      "data-loading-indicator",
      "true",
    );
  });
});

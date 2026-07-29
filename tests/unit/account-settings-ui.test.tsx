import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../messages/en.json";
import zhMessages from "../../messages/zh.json";
import { AccountSettings } from "@/components/settings/account-settings";

vi.mock("@/features/settings/actions", () => ({
  deleteAccount: vi.fn(async (_locale, state) => state),
  saveLanguagePreference: vi.fn(async (_locale, state) => state),
}));

afterEach(cleanup);

const profile = {
  id: "user_1",
  displayName: "Ailian",
  githubUsername: "Ailian0206",
  language: "en" as const,
  updatedAt: "2026-07-29T00:00:00.000Z",
};

const user = {
  displayName: "Ailian0206",
  email: "user@example.com",
};

describe("account settings UI", () => {
  it("shows account identity, saved language, and a gated danger action", async () => {
    const browserUser = userEvent.setup();
    render(
      <NextIntlClientProvider locale="zh" messages={zhMessages}>
        <AccountSettings locale="zh" profile={profile} user={user} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "设置" })).toBeVisible();
    expect(screen.getByText("Ailian0206")).toBeVisible();
    expect(screen.getByText("user@example.com")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "界面语言" })).toHaveValue("en");
    expect(screen.getByRole("button", { name: "保存语言" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "删除账号" })).toBeVisible();
    expect(screen.getByText(/输入 Ailian0206/)).toBeVisible();

    const confirmation = screen.getByRole("textbox", { name: "确认账号名" });
    const deleteButton = screen.getByRole("button", { name: "永久删除账号" });
    expect(deleteButton).toBeDisabled();

    await browserUser.type(confirmation, "Ailian");
    expect(deleteButton).toBeDisabled();
    await browserUser.clear(confirmation);
    await browserUser.type(confirmation, "Ailian0206");
    expect(deleteButton).toBeEnabled();
  });

  it("renders the complete English settings copy", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AccountSettings locale="en" profile={profile} user={user} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Interface language" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Delete account" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Permanently delete account" })).toBeVisible();
  });
});

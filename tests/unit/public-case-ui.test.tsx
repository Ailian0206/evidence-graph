import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EvidenceCanvas } from "@/components/portfolio/evidence-canvas";
import { NoteRows } from "@/components/portfolio/note-rows";
import { notes } from "@/content/notes";
import { publicResearchCases } from "@/content/public-research-cases";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("public case portfolio UI", () => {
  it("links all three published Notes rows to their localized detail routes", () => {
    render(<NoteRows notes={notes} locale="zh" />);

    expect(screen.getAllByText("已发布")).toHaveLength(3);
    for (const researchCase of publicResearchCases) {
      expect(
        screen.getByRole("link", { name: researchCase.title.zh }),
      ).toHaveAttribute("href", `/notes/${researchCase.slug}`);
    }
  });

  it("renders and inspects the real source to decision graph", () => {
    const researchCase = publicResearchCases[1];

    render(
      <EvidenceCanvas
        locale="zh"
        mode="workspace"
        graph={researchCase.graph}
        query={researchCase.question.zh}
      />,
    );

    expect(screen.getByText("65/65 精确引用，19/20 关系正确")).toBeVisible();
    const decision = screen.getByRole("button", { name: /聚焦证据交付，不做通用搜索/ });
    fireEvent.click(decision);
    expect(decision).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "用核验、关系准确率和报告审计衡量价值。",
    );
  });
});

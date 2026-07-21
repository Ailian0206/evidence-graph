import type { Page } from "@playwright/test";

const compactTextSelectors = [
  ".graph-node",
  ".graph-node *",
  "[class*='cytoscapeCanvas']",
  "[class*='nodeNavigator']",
  "[class*='nodeNavigator'] *",
];

export async function inspectVisibleUi(
  page: Page,
  leftRuleSelectors: string[] = [],
) {
  return page.evaluate(
    ({ compactSelectors, ruleSelectors }) => {
      const isVisible = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0 &&
          bounds.width > 0 &&
          bounds.height > 0
        );
      };
      const isCompactGraphText = (element: HTMLElement) =>
        compactSelectors.some((selector) => element.matches(selector));
      const textElements = Array.from(
        document.querySelectorAll<HTMLElement>(
          "a,button,blockquote,code,dd,dt,h1,h2,h3,label,li,p,q,span,strong,time",
        ),
      ).filter(
        (element) =>
          element.textContent?.trim() &&
          isVisible(element) &&
          !isCompactGraphText(element),
      );

      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        fontSizeViolations: textElements
          .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 12)
          .map((element) => element.textContent?.trim().slice(0, 80)),
        leftRuleViolations: ruleSelectors.flatMap((selector) =>
          Array.from(document.querySelectorAll<HTMLElement>(selector))
            .filter((element) => {
              const style = getComputedStyle(element);
              const left = Number.parseFloat(style.borderLeftWidth);
              const otherSides = [
                Number.parseFloat(style.borderTopWidth),
                Number.parseFloat(style.borderRightWidth),
                Number.parseFloat(style.borderBottomWidth),
              ];
              return (
                isVisible(element) &&
                left > 0 &&
                (otherSides.every((width) => width === 0) ||
                  left > Math.max(...otherSides))
              );
            })
            .map(() => selector),
        ),
      };
    },
    { compactSelectors: compactTextSelectors, ruleSelectors: leftRuleSelectors },
  );
}

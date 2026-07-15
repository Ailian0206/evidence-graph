import { describe, expect, it } from "vitest";

import { notes } from "@/content/notes";
import { profile } from "@/content/profile";
import { publicProjects } from "@/content/projects";
import { routing } from "@/i18n/routing";

describe("public portfolio content", () => {
  it("supports the Chinese and English locales", () => {
    expect(routing.locales).toEqual(["zh", "en"]);
    expect(routing.defaultLocale).toBe("zh");
  });

  it("uses Ailian's confirmed public identity", () => {
    expect(profile.brand).toBe("Ailian");
    expect(profile.email).toBe("airenglian@gmail.com");
    expect(profile.githubUrl).toBe("https://github.com/Ailian0206");
    expect(profile.role.zh).toContain("资深前端开发工程师");
    expect(profile.role.en).toContain("Senior frontend engineer");
  });

  it("publishes exactly the two confirmed projects", () => {
    expect(publicProjects.map((project) => project.slug)).toEqual([
      "evidence-graph",
      "ai-photo-studio-cn",
    ]);
    expect(
      publicProjects.some((project) => project.slug.includes("projectpilot")),
    ).toBe(false);
  });

  it("keeps all public project and note copy bilingual", () => {
    for (const project of publicProjects) {
      expect(project.name.zh).toBeTruthy();
      expect(project.name.en).toBeTruthy();
      expect(project.summary.zh).toBeTruthy();
      expect(project.summary.en).toBeTruthy();
    }

    for (const note of notes) {
      expect(note.title.zh).toBeTruthy();
      expect(note.title.en).toBeTruthy();
    }
  });
});

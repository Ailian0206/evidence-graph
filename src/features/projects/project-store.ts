import { z } from "zod";

import {
  projectSchema,
  projectStatusSchema,
  projectVisibilitySchema,
  type ResearchRun,
} from "@/features/research/domain";
import { manualSourceUrlSchema } from "@/features/sources/manual-source-url";

export const projectLanguageSchema = z.enum(["zh", "en"]);

export const managedProjectSchema = projectSchema.extend({
  language: projectLanguageSchema,
});

export const createProjectInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  question: z.string().trim().min(1).max(2000),
  language: projectLanguageSchema,
});

export const createResearchInputSchema = createProjectInputSchema.extend({
  manualUrls: z.array(manualSourceUrlSchema).max(5).default([]),
});

export const updateProjectInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    question: z.string().trim().min(1).max(2000).optional(),
    language: projectLanguageSchema.optional(),
    status: projectStatusSchema.optional(),
    visibility: projectVisibilitySchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "PROJECT_UPDATE_EMPTY");

export type ManagedProject = z.infer<typeof managedProjectSchema>;
export type CreateProjectInput = z.input<typeof createProjectInputSchema>;
export type CreateResearchInput = z.input<typeof createResearchInputSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectInputSchema>;

export type CreatedManagedResearch = {
  project: ManagedProject;
  run: ResearchRun;
};

export type ProjectStore = {
  listProjects: (input: { ownerId: string }) => Promise<ManagedProject[]>;
  getProject: (input: { ownerId: string; projectId: string }) => Promise<ManagedProject>;
  createResearch: (input: {
    ownerId: string;
    input: CreateResearchInput;
  }) => Promise<CreatedManagedResearch>;
  markResearchDispatchFailed: (input: {
    ownerId: string;
    projectId: string;
    runId: string;
  }) => Promise<void>;
  updateProject: (input: {
    ownerId: string;
    projectId: string;
    input: UpdateProjectInput;
  }) => Promise<ManagedProject>;
  deleteProject: (input: { ownerId: string; projectId: string }) => Promise<void>;
};

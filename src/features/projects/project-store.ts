import { z } from "zod";

import {
  projectSchema,
  projectStatusSchema,
  projectVisibilitySchema,
} from "@/features/research/domain";

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
  manualUrls: z.array(z.string().url()).max(5).default([]),
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

export type ProjectStore = {
  listProjects: (input: { ownerId: string }) => Promise<ManagedProject[]>;
  getProject: (input: { ownerId: string; projectId: string }) => Promise<ManagedProject>;
  createProject: (input: {
    ownerId: string;
    input: CreateProjectInput;
  }) => Promise<ManagedProject>;
  updateProject: (input: {
    ownerId: string;
    projectId: string;
    input: UpdateProjectInput;
  }) => Promise<ManagedProject>;
  deleteProject: (input: { ownerId: string; projectId: string }) => Promise<void>;
};

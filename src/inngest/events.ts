import { eventType } from "inngest";
import { z } from "zod";

export const researchRequestedEventSchema = z.object({
  ownerId: z.string().min(1),
  projectId: z.string().min(1),
  runId: z.string().min(1),
});

export type ResearchRequestedEventData = z.infer<typeof researchRequestedEventSchema>;

export const researchRequestedEvent = eventType("evidence/research.requested", {
  schema: researchRequestedEventSchema,
});

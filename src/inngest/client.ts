import { Inngest } from "inngest";

import {
  researchRequestedEvent,
  researchRequestedEventSchema,
  type ResearchRequestedEventData,
} from "@/inngest/events";

export const inngest = new Inngest({
  id: "evidence-graph",
  isDev: process.env.NODE_ENV !== "production",
});

export const createResearchRequestedPayload = (
  input: ResearchRequestedEventData,
) => {
  const data = researchRequestedEventSchema.parse(input);
  return {
    name: researchRequestedEvent.name,
    id: data.runId,
    data,
  };
};

export const sendResearchRequestedEvent = (input: ResearchRequestedEventData) =>
  inngest.send(createResearchRequestedPayload(input));

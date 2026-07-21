import { Inngest } from "inngest";

import {
  researchRequestedEvent,
  researchRequestedEventSchema,
  type ResearchRequestedEventData,
} from "@/inngest/events";

type InngestModeEnv = {
  INNGEST_DEV?: string;
  NODE_ENV?: string;
};

export const resolveInngestModeOverride = (env: InngestModeEnv) =>
  env.INNGEST_DEV === undefined ? env.NODE_ENV !== "production" : undefined;

const isDev = resolveInngestModeOverride(process.env);

export const inngest = new Inngest({
  id: "evidence-graph",
  ...(isDev === undefined ? {} : { isDev }),
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

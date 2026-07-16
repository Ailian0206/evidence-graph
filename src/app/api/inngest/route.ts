import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { runManagedResearch } from "@/inngest/functions/run-research";

export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runManagedResearch],
});

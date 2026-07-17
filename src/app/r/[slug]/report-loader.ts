import { cache } from "react";

import { getPublicReport } from "@/features/reports/report-store";

export const loadPublicReport = cache(async (slug: string) => {
  try {
    return await getPublicReport({ slug });
  } catch (error) {
    if (error instanceof Error && error.message === "REPORT_NOT_FOUND") {
      return null;
    }
    throw error;
  }
});

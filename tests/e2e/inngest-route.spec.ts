import { expect, test } from "@playwright/test";

test("serves the Inngest function endpoint without exposing configuration", async ({
  request,
}) => {
  const response = await request.get("/api/inngest");
  const body = (await response.json()) as {
    function_count: number;
    has_event_key: boolean;
    has_signing_key: boolean;
    mode: string;
  };
  const serializedBody = JSON.stringify(body);

  expect(response.status()).toBe(200);
  expect(body).toMatchObject({
    function_count: 1,
    has_event_key: false,
    has_signing_key: false,
    mode: "dev",
  });
  expect(serializedBody).not.toContain("INNGEST_EVENT_KEY");
  expect(serializedBody).not.toContain("INNGEST_SIGNING_KEY");
});

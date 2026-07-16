import { expect, test } from "@playwright/test";

test("applies stable security headers to public pages", async ({ request }) => {
  const response = await request.get("/zh");

  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response.headers()["permissions-policy"]).toBe(
    "camera=(), microphone=(), geolocation=()",
  );
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

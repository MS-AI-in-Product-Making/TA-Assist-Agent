import { test, expect } from "./workbench-fixture.js";

test("enforces Host, one-time bootstrap, CSRF, and artifact traversal boundaries", async ({ request, workbench }) => {
  const hostile = await request.post(`${workbench.origin}/api/sessions`, { headers: { host: "evil.test" } });
  expect(hostile.status()).toBe(403);

  const nonce = await workbench.issueBootstrap();
  const first = await request.post(`${workbench.origin}/api/bootstrap`, { data: { nonce } });
  expect(first.status()).toBe(204);
  const replay = await request.post(`${workbench.origin}/api/bootstrap`, { data: { nonce } });
  expect(replay.status()).toBe(401);

  const missingCsrf = await request.post(`${workbench.origin}/api/sessions`);
  expect(missingCsrf.status()).toBe(403);
  const traversal = await request.get(`${workbench.origin}/api/sessions/${workbench.sessionId}/artifacts/..%2F..%2Fsecret`);
  expect([400, 403, 404]).toContain(traversal.status());
});

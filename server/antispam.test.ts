import { afterEach, describe, expect, it } from "vitest";
import { consumeLeadRateLimit, isSubmissionTooFast, resetLeadRateLimitForTests } from "./antispam";

function request(ip: string) {
  return { headers: { "x-forwarded-for": ip }, ip, socket: {} } as never;
}

describe("lead antispam", () => {
  afterEach(() => resetLeadRateLimitForTests());

  it("allows five requests and blocks the sixth per scope and IP", () => {
    const req = request("203.0.113.10");
    for (let i = 0; i < 5; i += 1) expect(consumeLeadRateLimit(req, "chat").allowed).toBe(true);
    expect(consumeLeadRateLimit(req, "chat").allowed).toBe(false);
    expect(consumeLeadRateLimit(req, "form").allowed).toBe(true);
  });

  it("rejects submissions made immediately after opening the form", () => {
    expect(isSubmissionTooFast(Date.now())).toBe(true);
    expect(isSubmissionTooFast(Date.now() - 2_000)).toBe(false);
    expect(isSubmissionTooFast(undefined)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { resolveExpectedDomains } from "@/lib/auth/siwe";

/**
 * Domain binding is the check that makes a SIWE signature worth anything: it is
 * what stops a signature farmed on another site being replayed here. The rule
 * is therefore asymmetric on purpose — permissive in development, and in
 * production accepting nothing the caller can influence. These pin that
 * asymmetry, because loosening it silently would not fail any other test.
 */
describe("resolveExpectedDomains", () => {
  const prod = { requestOrigin: "https://luxurypad.family", isProduction: true };

  it("accepts only the configured host in production", () => {
    const out = resolveExpectedDomains({
      configuredUrl: "https://luxurypad.family",
      ...prod,
    });
    expect(out).toEqual({ ok: true, domains: ["luxurypad.family"] });
  });

  it("ignores the request host in production, even when it looks legitimate", () => {
    // `Host` is a request header. An attacker who can set it must not be able
    // to widen what a signature may claim.
    const out = resolveExpectedDomains({
      configuredUrl: "https://luxurypad.family",
      requestOrigin: "https://evil.example",
      isProduction: true,
    });
    expect(out).toEqual({ ok: true, domains: ["luxurypad.family"] });
  });

  it("fails closed in production when the canonical URL is unset", () => {
    // Falling back to the request host here would disable the check entirely,
    // which is worse than refusing to sign anyone in.
    const out = resolveExpectedDomains({ configuredUrl: undefined, ...prod });
    expect(out.ok).toBe(false);
  });

  it("fails closed in production when the canonical URL is unparseable", () => {
    const out = resolveExpectedDomains({ configuredUrl: "luxurypad.family", ...prod });
    expect(out.ok).toBe(false);
  });

  it("treats a blank canonical URL as unset rather than as an empty host", () => {
    const out = resolveExpectedDomains({ configuredUrl: "   ", ...prod });
    expect(out.ok).toBe(false);
  });

  it("also accepts the request host in development, so any dev port works", () => {
    const out = resolveExpectedDomains({
      configuredUrl: "https://luxurypad.family",
      requestOrigin: "http://localhost:3750",
      isProduction: false,
    });
    expect(out).toEqual({
      ok: true,
      domains: ["luxurypad.family", "localhost:3750"],
    });
  });

  it("does not list the same host twice", () => {
    const out = resolveExpectedDomains({
      configuredUrl: "http://localhost:3000",
      requestOrigin: "http://localhost:3000",
      isProduction: false,
    });
    expect(out).toEqual({ ok: true, domains: ["localhost:3000"] });
  });

  it("keeps the port as part of the host, so 3000 and 3750 are different sites", () => {
    const out = resolveExpectedDomains({
      configuredUrl: "http://localhost:3000",
      requestOrigin: "http://localhost:3750",
      isProduction: false,
    });
    expect(out).toEqual({ ok: true, domains: ["localhost:3000", "localhost:3750"] });
  });
});

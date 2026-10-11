import { describe, it, expect, vi, beforeEach } from "vitest";

/** Loads env.ts with a given allow-list, so each case gets a fresh module. */
const load = async (origins: string) => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "key");
  vi.stubEnv("VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS", origins);
  return await import("./env");
};

describe("isValidOAuthRedirect", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("accepts an exactly listed origin", async () => {
    const { isValidOAuthRedirect } = await load("https://redroom.space");
    expect(isValidOAuthRedirect("https://redroom.space/auth/callback")).toBe(true);
  });

  it("rejects an origin that is not listed", async () => {
    const { isValidOAuthRedirect } = await load("https://redroom.space");
    expect(isValidOAuthRedirect("https://evil.example/auth/callback")).toBe(false);
  });

  it("matches a scoped Vercel wildcard", async () => {
    const { isValidOAuthRedirect } = await load("https://*-rhulani-1s-projects.vercel.app");
    expect(
      isValidOAuthRedirect("https://red-room-git-main-rhulani-1s-projects.vercel.app/auth/callback"),
    ).toBe(true);
  });

  it("does NOT let a scoped wildcard match another account's deployment", async () => {
    const { isValidOAuthRedirect } = await load("https://*-rhulani-1s-projects.vercel.app");
    expect(isValidOAuthRedirect("https://evil-attacker-projects.vercel.app/auth/callback")).toBe(false);
  });

  it("refuses a bare wildcard", async () => {
    const { isValidOAuthRedirect } = await load("https://*");
    expect(isValidOAuthRedirect("https://anything.example/auth/callback")).toBe(false);
  });

  it("does not let the wildcard reach into the path", async () => {
    const { isValidOAuthRedirect } = await load("https://*.redroom.space");
    // a host that merely contains the suffix in its path must not match
    expect(isValidOAuthRedirect("https://evil.example/a.redroom.space")).toBe(false);
  });

  it("rejects a non-https origin that is not localhost", async () => {
    const { isValidOAuthRedirect } = await load("http://evil.example");
    expect(isValidOAuthRedirect("http://evil.example/auth/callback")).toBe(false);
  });

  it("still allows http on localhost for development", async () => {
    const { isValidOAuthRedirect } = await load("http://localhost:8080");
    expect(isValidOAuthRedirect("http://localhost:8080/auth/callback")).toBe(true);
  });

  it("rejects a malformed url", async () => {
    const { isValidOAuthRedirect } = await load("https://redroom.space");
    expect(isValidOAuthRedirect("not a url")).toBe(false);
  });
});

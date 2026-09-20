import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Layout geometry on authenticated routes.
 *
 * Every default-chrome route sits behind the auth gate, so we seed a synthetic
 * Supabase session into localStorage. supabase-js reads the session from storage and
 * only hits the network once the token nears expiry, so a far-future `exp` renders the
 * shell with no backend at all. Data fetches inside each page will fail — that's fine,
 * we're asserting layout geometry, not content.
 */

// Derived from .env rather than hardcoded: supabase-js keys its stored session on
// the project ref, so a stale literal here silently breaks auth seeding and every
// gated-route test fails for a reason that has nothing to do with layout.
const PROJECT_REF = (() => {
  const env = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  const url = env.match(/^\s*VITE_SUPABASE_URL\s*=\s*["']?([^"'\s]+)/m)?.[1] ?? "";
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  if (!ref) throw new Error("Could not derive the Supabase project ref from .env");
  return ref;
})();

const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  const sub = "00000000-0000-0000-0000-000000000001";
  const jwt = [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({ sub, exp, aud: "authenticated", role: "authenticated", email: "layout@test.local" }),
    "signature-not-verified-client-side",
  ].join(".");

  const user = {
    id: sub,
    aud: "authenticated",
    role: "authenticated",
    email: "layout@test.local",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  };

  return {
    access_token: jwt,
    refresh_token: "fake-refresh-token",
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: exp,
    user,
  };
}

async function seedAuth(page: Page) {
  const session = fakeSession();
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string);
      window.localStorage.setItem("auth:last-active-at", String(Date.now()));
    },
    [`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session)] as const,
  );
}

const SHELL_ROUTES = ["/discover", "/near-me", "/messages", "/groups", "/profile", "/wallet"];
const RAIL_BREAKPOINT = 1024;

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  // Answer Supabase calls immediately with empty data rather than letting them reach
  // the network. Aborting is NOT viable: useAuth (src/hooks/useAuth.tsx:55) has no
  // .catch() on getSession(), so a rejected request leaves `loading` true forever and
  // the app never paints past the spinner.
  await page.route(/supabase\.(co|in)/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
});

test("shell renders for an authenticated user", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
});

for (const route of SHELL_ROUTES) {
  test(`${route} — correct nav for the viewport, and only one of them`, async ({ page }, testInfo) => {
    const width = testInfo.project.use.viewport!.width;
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

    const railVisible = await page.getByTestId("side-rail").isVisible();
    const tabVisible = await page.getByTestId("tab-bar").isVisible();

    if (width >= RAIL_BREAKPOINT) {
      expect(railVisible, `rail should be visible at ${width}px`).toBe(true);
      expect(tabVisible, `tab bar should be hidden at ${width}px`).toBe(false);
    } else {
      expect(railVisible, `rail should be hidden at ${width}px`).toBe(false);
      expect(tabVisible, `tab bar should be visible at ${width}px`).toBe(true);
    }
  });

  test(`${route} — no horizontal overflow`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth, `horizontal overflow at ${innerWidth}px`).toBeLessThanOrEqual(innerWidth + 1);
  });
}

test("rail sits flush against the content column (the old ~460px gap bug)", async ({ page }, testInfo) => {
  const width = testInfo.project.use.viewport!.width;
  test.skip(width < RAIL_BREAKPOINT, "rail only exists from lg up");

  await page.goto("/discover", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Read rects directly: Playwright's boundingBox() waits for the element to stop
  // animating, and these pages contain perpetual motion (spinners / framer-motion).
  const box = await page.evaluate(() => {
    const rail = document.querySelector('[data-testid="side-rail"]');
    const main = document.querySelector("main");
    if (!rail || !main) return null;
    const r = rail.getBoundingClientRect();
    const m = main.getBoundingClientRect();
    return { railRight: r.right, mainLeft: m.left, railWidth: r.width };
  });

  expect(box).not.toBeNull();
  // Structural adjacency: they are flex siblings, so this holds at every width.
  expect(
    Math.abs(box!.railRight - box!.mainLeft),
    `gap between rail and content at ${width}px (rail ${box!.railWidth}px wide)`,
  ).toBeLessThanOrEqual(2);
});

test("feed column stays readable on large screens", async ({ page }, testInfo) => {
  const width = testInfo.project.use.viewport!.width;
  test.skip(width < 1440, "only meaningful on large viewports");

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const inner = await page.evaluate(() => {
    const el = document.querySelector("main > div") as HTMLElement | null;
    return el?.getBoundingClientRect().width ?? -1;
  });
  // max-w-feed is 600px; allow a little slack for gutters/scrollbar.
  expect(inner, `feed column width at ${width}px`).toBeLessThanOrEqual(640);
});

test("interactive controls meet a ~40px touch target on phones", async ({ page }, testInfo) => {
  const width = testInfo.project.use.viewport!.width;
  test.skip(width > 500, "touch-target rule is about phones");

  await page.goto("/wallet", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const tooSmall = await page.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("main button, main a[href], main [role='button']"),
    );
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // Ignore hidden/zero-size elements.
        return r.width > 0 && r.height > 0 && r.height < 40;
      })
      .map((el) => ({
        text: (el.innerText || el.getAttribute("aria-label") || "?").slice(0, 30),
        height: Math.round(el.getBoundingClientRect().height),
      }));
  });

  expect(tooSmall, `controls under 40px tall: ${JSON.stringify(tooSmall)}`).toEqual([]);
});

test("chat route keeps desktop nav but drops the mobile tab bar", async ({ page }, testInfo) => {
  const width = testInfo.project.use.viewport!.width;
  await page.goto("/groups/00000000-0000-0000-0000-0000000000aa", {
    waitUntil: "domcontentloaded",
  });
  // The group won't load (no backend), but the shell chrome is what we're asserting.
  await page.waitForTimeout(1500);

  const tabVisible = await page.getByTestId("tab-bar").isVisible().catch(() => false);
  expect(tabVisible, "chat should not show the mobile tab bar").toBe(false);

  if (width >= RAIL_BREAKPOINT) {
    const railVisible = await page.getByTestId("side-rail").isVisible().catch(() => false);
    expect(railVisible, "chat should keep the desktop rail so nav isn't lost").toBe(true);

    // No TopBar in chat chrome, so the rail must start at the very top rather than
    // leaving an empty header-height gap.
    const railTop = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="side-rail"]');
      return el ? el.getBoundingClientRect().top : -1;
    });
    expect(railTop).toBeLessThanOrEqual(2);
  }
});

test("nothing sits underneath the fixed header", async ({ page }) => {
  await page.goto("/discover", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const result = await page.evaluate(() => {
    const header = document.querySelector("header");
    const main = document.querySelector("main");
    if (!header || !main) return null;
    return {
      headerBottom: header.getBoundingClientRect().bottom,
      mainTop: main.getBoundingClientRect().top,
    };
  });
  expect(result).not.toBeNull();
  expect(result!.mainTop).toBeGreaterThanOrEqual(result!.headerBottom - 1);
});

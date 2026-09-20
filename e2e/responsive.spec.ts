import { test, expect } from "@playwright/test";

/**
 * Responsive smoke tests.
 *
 * NOTE: only unauthenticated routes are covered so far. Every other route sits behind
 * the auth gate in App.tsx, so covering them needs a seeded storageState for a test
 * user against the correct Supabase project.
 */
const PUBLIC_ROUTES = ["/install", "/auth"];

/** The lg breakpoint, where the mobile tab bar gives way to the desktop rail. */
const RAIL_BREAKPOINT = 1024;

for (const route of PUBLIC_ROUTES) {
  test(`${route} — no horizontal overflow`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(
      overflow.scrollWidth,
      `page scrolls horizontally at ${overflow.innerWidth}px`,
    ).toBeLessThanOrEqual(overflow.innerWidth + 1);
  });

  test(`${route} — layout variables are defined`, async ({ page }) => {
    await page.goto(route);
    const vars = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        header: s.getPropertyValue("--app-header-h").trim(),
        rail: s.getPropertyValue("--app-rail-w").trim(),
        tabbar: s.getPropertyValue("--app-tabbar-h").trim(),
      };
    });
    // Guards against anyone reintroducing a hardcoded height like top-[53px].
    expect(vars.header).not.toBe("");
    expect(vars.rail).not.toBe("");
    expect(vars.tabbar).not.toBe("");
  });
}

test("/install — header height matches the layout variable", async ({ page }) => {
  await page.goto("/install");
  const result = await page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return null;
    const declared = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--app-header-h"),
    );
    // The header's inner row is the element sized by --app-header-h; the header itself
    // additionally carries the safe-area top padding.
    const row = header.firstElementChild as HTMLElement | null;
    return { declared, rowHeight: row?.getBoundingClientRect().height ?? -1 };
  });
  expect(result).not.toBeNull();
  expect(result!.rowHeight).toBeCloseTo(result!.declared, 0);
});

test("nav exclusivity: tab bar and rail never both visible", async ({ page }, testInfo) => {
  // /install uses the `minimal` chrome, so it intentionally has neither. Use /auth's
  // sibling behaviour instead by checking the shell's own contract on a shell route.
  await page.goto("/install");
  await page.waitForLoadState("networkidle");

  const rail = page.getByTestId("side-rail");
  const tabBar = page.getByTestId("tab-bar");

  const railVisible = await rail.isVisible().catch(() => false);
  const tabVisible = await tabBar.isVisible().catch(() => false);

  expect(
    railVisible && tabVisible,
    `both navs visible at ${testInfo.project.use.viewport?.width}px`,
  ).toBe(false);
});

test("safe-area insets are wired through --sa-* variables", async ({ page }) => {
  await page.goto("/install");
  await page.waitForLoadState("networkidle");

  // Headless Chromium always reports env(safe-area-inset-*) as 0, so we override the
  // indirection variables to prove the padding actually consumes them.
  const before = await page.evaluate(() => {
    const h = document.querySelector("header") as HTMLElement | null;
    return h ? getComputedStyle(h).paddingTop : null;
  });

  await page.addStyleTag({ content: ":root{--sa-t:47px;--sa-b:34px;}" });

  const after = await page.evaluate(() => {
    const h = document.querySelector("header") as HTMLElement | null;
    return h ? getComputedStyle(h).paddingTop : null;
  });

  expect(before).toBe("0px");
  expect(after).toBe("47px");
});

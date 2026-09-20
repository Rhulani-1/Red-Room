import { defineConfig, devices } from "@playwright/test";

/**
 * Responsive verification harness.
 *
 * The previous config imported `lovable-agent-playwright-config`, which is in neither
 * package.json nor either lockfile, so `playwright test` failed on an unresolved
 * import before running anything.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  webServer: {
    command: "npm run dev",
    port: 8080,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:8080",
  },
  projects: [
    // Phones
    { name: "phone-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 640 }, hasTouch: true } },
    { name: "phone-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "phone-430", use: { ...devices["Desktop Chrome"], viewport: { width: 430, height: 932 }, hasTouch: true } },
    // Phone landscape — short viewport
    { name: "phone-ls-932", use: { ...devices["Desktop Chrome"], viewport: { width: 932, height: 430 }, hasTouch: true } },
    // Tablet portrait — must still get the tab bar, not the rail
    { name: "tablet-744", use: { ...devices["Desktop Chrome"], viewport: { width: 744, height: 1133 }, hasTouch: true } },
    { name: "tablet-834", use: { ...devices["Desktop Chrome"], viewport: { width: 834, height: 1194 }, hasTouch: true } },
    // Tablet landscape — first rail breakpoint, and short
    { name: "tablet-ls-1024", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } },
    // Desktop
    { name: "laptop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "laptop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "desktop-1920", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "wide-2560", use: { ...devices["Desktop Chrome"], viewport: { width: 2560, height: 1440 } } },
  ],
});

import { defineConfig, devices } from "@playwright/test";
const externalURL = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  use: {
    baseURL: externalURL || "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--enable-webgl",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1050 },
      },
    },
  ],
  webServer: externalURL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 5173",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
      },
});

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // One worker: every spec shares one dev server + many specs spin multiple
  // browser contexts, and one integration spec starts its own server. Running
  // spec files in parallel starves resources and flakes; serial is reliable.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    launchOptions: {
      // Let test videos autoplay with audio so sync tests exercise the real path.
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: [
    {
      command: 'npm run start',
      cwd: './server',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      cwd: './client',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})

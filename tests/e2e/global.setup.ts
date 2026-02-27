import { request, type FullConfig } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

async function globalSetup(config: FullConfig) {
  const project = config.projects[0];
  const baseURL = project.use.baseURL as string;
  const email = process.env.E2E_EMAIL ?? "commissioner@afl.local";
  const password = process.env.E2E_PASSWORD ?? "dev-password";

  const context = await request.newContext({ baseURL });
  const response = await context.post("/api/auth/login", {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`E2E login failed: ${response.status()} ${response.statusText()}`);
  }

  const authDir = path.resolve(".auth");
  await fs.mkdir(authDir, { recursive: true });
  await context.storageState({ path: path.join(authDir, "user.json") });
  await context.dispose();
}

export default globalSetup;

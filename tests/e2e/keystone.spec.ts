import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

const password = "Browser-smoke-password-42!";

async function register(request: APIRequestContext) {
  const email = `browser-smoke+${randomUUID()}@example.com`;
  const response = await request.post("/api/auth/register", {
    data: { email, displayName: "Browser Smoke", password },
    timeout: 10_000,
  });
  expect(response.status()).toBe(201);
  return email;
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function expectAccessible(page: Page, checkpoint: string) {
  await page.addStyleTag({
    content: "*, *::before, *::after { animation-duration: 0s !important; transition-delay: 0s !important; transition-duration: 0s !important; }",
  });
  const results = await new AxeBuilder({ page }).analyze();
  const rules = results.violations.map(({ id }) => id).filter((id) => /^[a-z0-9-]+$/.test(id));
  const elements = new Set<string>();
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const target = node.target[0];
      const selector = typeof target === "string" ? target : target[0];
      if (!selector) continue;
      const marker = await page.locator(selector).first().evaluate((element) =>
        element.closest("[data-a11y-id]")?.getAttribute("data-a11y-id") ?? null,
      ).catch(() => null);
      if (marker && /^[a-z0-9-]+$/.test(marker)) elements.add(marker);
    }
  }
  if (rules.length > 0) {
    const markers = [...elements];
    throw new Error(
      `A11Y_CHECKPOINT_${checkpoint}:${rules.join(",")}${markers.length > 0 ? `;elements=${markers.join(",")}` : ""}`,
    );
  }
}

test("sign in, create a workspace, upload real bytes, index, answer, and open a citation", async ({ page, request }) => {
  const email = await register(request);
  await signIn(page, email);
  await expectAccessible(page, "DASHBOARD");

  const suffix = randomUUID().slice(0, 8);
  const workspaceName = `Release evidence ${suffix}`;
  await page.getByRole("link", { name: "Workspaces", exact: true }).click();
  await expectAccessible(page, "WORKSPACE_FORM");
  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByLabel("Workspace slug").fill(`release-evidence-${suffix}`);
  await page.getByLabel("Workspace description").fill("Deterministic browser sources");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await expectAccessible(page, "DOCUMENT_FORM");
  await page.getByLabel("Document file").setInputFiles({
    name: "retention-policy.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Retention Policy\nCompany records must be retained for seven years."),
  });
  await page.getByLabel("Workspace").selectOption({ label: workspaceName });
  await page.getByRole("button", { name: "Upload and index" }).click();
  await expect(page.getByRole("status")).toContainText("is indexed and ready to search");
  await expect(page.getByRole("link", { name: "Open retention-policy.txt", exact: true })).toBeVisible();
  await expectAccessible(page, "DOCUMENT_INDEXED");

  await page.getByRole("link", { name: "Conversations", exact: true }).click();
  await expect(page.getByRole("option", { name: workspaceName, exact: true })).toBeAttached();
  await expectAccessible(page, "CONVERSATION_FORM");
  await page.getByLabel("Workspace").selectOption({ label: workspaceName });
  await page.getByLabel("Conversation title").fill("Retention check");
  await expect(page.getByRole("option", { name: "retention-policy.txt", exact: true })).toBeAttached();
  await page.getByLabel("Document scope").selectOption({ label: "retention-policy.txt" });
  await page.getByRole("button", { name: "Create conversation" }).click();
  await page.getByLabel("Ask a question").fill("How long must company records be retained?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText("The supplied source states that company records must be retained for seven years.")).toBeVisible();
  const sources = page.getByRole("region", { name: "Sources for answer" });
  await expect(sources).toContainText("Company records must be retained for seven years.");
  await expectAccessible(page, "GROUNDED_ANSWER");
  await page.getByRole("link", { name: "Open retention-policy.txt" }).click();
  await expect(page.getByRole("heading", { name: "retention-policy.txt" })).toBeVisible();
  await expectAccessible(page, "DOCUMENT_DETAIL");
});

test("invalid sign-in and authenticated repository recovery are accessible", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(`missing+${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expectAccessible(page, "INVALID_LOGIN");

  const email = await register(request);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expectAccessible(page, "RECOVERED_LOGIN");

  await page.route("**/api/workspaces", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Temporarily unavailable", requestId: randomUUID() } }),
    });
  });
  await page.getByRole("link", { name: "Workspaces", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workspaces unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry workspaces" })).toBeVisible();
  await expectAccessible(page, "WORKSPACES_ERROR");
  await page.unroute("**/api/workspaces");
  await page.getByRole("button", { name: "Retry workspaces" }).click();
  await expect(page.getByRole("heading", { name: "No workspaces yet" })).toBeVisible();
  await expectAccessible(page, "WORKSPACES_RECOVERED");
});

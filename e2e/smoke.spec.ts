import { expect, test } from "@playwright/test";

test.describe("public marketing", () => {
  test("home page shows hero and primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Review rental applicants/i })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /Start free/i }).first()).toBeVisible();
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /Create your TenantLens account/i })).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/Work email/i)).toBeVisible();
  });
});

test.describe("auth guard", () => {
  test("unauthenticated /dashboard resolves to login or dashboard shell", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const url = new URL(page.url());
    if (url.pathname.startsWith("/login")) {
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
      return;
    }

    await expect(page.getByRole("navigation", { name: "Dashboard" }).getByRole("link", { name: "Properties" })).toBeVisible();
  });
});

test.describe("login validation", () => {
  test("invalid credentials show an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/Work email/i).fill("e2e-invalid-not-a-user@tenantlens.test");
    await page.getByLabel(/^Password$/i).fill("wrong-password-12345!");
    await page.getByRole("button", { name: /^Log in$/i }).click();

    await expect(page.getByText(/Sign in failed|Configuration error/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("optional signed-in smoke", () => {
  test("E2E user can open dashboard after login", async ({ page }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD for this test.");

    await page.goto("/login");
    await page.getByLabel(/Work email/i).fill(email!);
    await page.getByLabel(/^Password$/i).fill(password!);
    await page.getByRole("button", { name: /^Log in$/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByRole("navigation", { name: "Dashboard" }).getByRole("link", { name: "Properties" })).toBeVisible();
  });
});

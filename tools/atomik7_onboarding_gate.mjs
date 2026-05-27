/**
 * PHASE 4 / Atomik-7 — Full PHASE 4 E2E gate
 *
 * Scenario A: Employer register (/employer/register) — 360 / 768 / 1280
 *   A1.  Title renders ("İşveren")
 *   A2-5. 4 inputs visible (full_name, email, password, confirm_password)
 *   A6.  Submit button visible
 *   A7.  Card fits within viewport width (no overflow)
 *   A8.  Empty submit → error shown
 *   A9.  No navigation on empty submit
 *   A10. Password mismatch → error shown
 *   A11. Mock success → redirect to /jobs
 *
 * Scenario B: Candidate register (/candidate/register) — 360 / 768 / 1280
 *   B1.  Title renders ("Aday")
 *   B2-5. 4 inputs visible
 *   B6.  Submit button visible
 *   B7.  Card fits within viewport width
 *   B8.  Empty submit → error shown
 *   B9.  No navigation on empty submit
 *   B10. Password mismatch → error shown
 *   B11. Mock success → redirect to /talent/profile
 *
 * Scenario C: Public nav CTA visibility (/) — 360 / 768 / 1280
 *   C1.  .public-nav-cta--employer visible
 *   C2.  .public-nav-cta--candidate visible
 *   C3.  Employer CTA has non-zero width
 *   C4.  [mobile-360] Popup contains employer + candidate register links
 *
 * Scenario D: Activation redirect smoke — desktop-1280
 *   D1.  employer_company_admin token → navigate → /jobs
 *   D2.  candidate_user token → navigate → /talent/profile
 *
 * Run:
 *   node tools/atomik7_onboarding_gate.mjs
 *
 * Requires: dev server on http://127.0.0.1:5175
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const APP_URL = "http://127.0.0.1:5175";
const ARTIFACT_DIR = "tools/gate-artifacts/atomik7-onboarding";

const VIEWPORTS = [
  { label: "mobile-360", width: 360, height: 800 },
  { label: "tablet-768", width: 768, height: 1024 },
  { label: "desktop-1280", width: 1280, height: 900 },
];

const MOCK_EMPLOYER_REGISTER = {
  access_token: "mock-access-employer-reg",
  refresh_token: "mock-refresh-employer-reg",
  token_type: "bearer",
  user: {
    id: 9001,
    email: "test-employer@example.com",
    work_email: "test-employer@example.com",
    role: "user",
    business_role: "employer_admin",
    system_role: "employer_company_admin",
    full_name: "Test Employer",
    department_id: null,
    tenant_id: null,
    scope_type: null,
  },
};

const MOCK_CANDIDATE_REGISTER = {
  access_token: "mock-access-candidate-reg",
  refresh_token: "mock-refresh-candidate-reg",
  token_type: "bearer",
  user: {
    id: 9002,
    email: "test-candidate@example.com",
    work_email: "test-candidate@example.com",
    role: "user",
    business_role: "candidate",
    system_role: "candidate_user",
    full_name: "Test Candidate",
    department_id: null,
    tenant_id: null,
    scope_type: null,
  },
};

const MOCK_EMPLOYER_VERIFY = {
  valid: true,
  email: "employer-activate@example.com",
  full_name: "Employer Activate",
  role: "user",
  business_role: "employer_admin",
  system_role: "employer_company_admin",
  accepted: true,
  organization_name: "Test Corp",
  organization_logo_url: null,
  workspace_label: "test.buyerasistans.com.tr",
  platform_name: "BuyerAsistans",
  platform_domain: "buyerasistans.com.tr",
};

const MOCK_EMPLOYER_ACTIVATE = {
  access_token: "mock-access-employer-activate",
  refresh_token: "mock-refresh-employer-activate",
  token_type: "bearer",
  user: {
    id: 9003,
    email: "employer-activate@example.com",
    work_email: "employer-activate@example.com",
    role: "user",
    business_role: "employer_admin",
    system_role: "employer_company_admin",
    full_name: "Employer Activate",
    department_id: null,
    tenant_id: null,
    scope_type: null,
  },
};

const MOCK_CANDIDATE_VERIFY = {
  valid: true,
  email: "candidate-activate@example.com",
  full_name: "Candidate Activate",
  role: "user",
  business_role: "candidate",
  system_role: "candidate_user",
  accepted: true,
  organization_name: null,
  organization_logo_url: null,
  workspace_label: null,
  platform_name: "BuyerAsistans",
  platform_domain: "buyerasistans.com.tr",
};

const MOCK_CANDIDATE_ACTIVATE = {
  access_token: "mock-access-candidate-activate",
  refresh_token: "mock-refresh-candidate-activate",
  token_type: "bearer",
  user: {
    id: 9004,
    email: "candidate-activate@example.com",
    work_email: "candidate-activate@example.com",
    role: "user",
    business_role: "candidate",
    system_role: "candidate_user",
    full_name: "Candidate Activate",
    department_id: null,
    tenant_id: null,
    scope_type: null,
  },
};

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
    results.push({ label, status: "PASS" });
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
    results.push({ label, status: "FAIL" });
  }
}

// ─── Scenario A: Employer register ───────────────────────────────────────────

async function runEmployerRegister(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await context.newPage();

  try {
    console.log(`\n── [A] ${vp.label} — Employer register ──`);

    // LIFO: catch-all first (lowest priority), specific routes last (highest priority)
    await page.route("**/*", (route) => route.continue());
    await page.route("**/api/v1/auth/me", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      })
    );

    // A1–A7: Render checks
    await page.goto(`${APP_URL}/employer/register`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".employer-register-page", { timeout: 8000 });

    const title = await page.textContent(".employer-register-page__title");
    assert(title?.includes("İşveren"), `[A][${vp.label}] Title renders: "${title?.trim()}"`);

    assert(await page.isVisible("#full_name"),        `[A][${vp.label}] full_name input visible`);
    assert(await page.isVisible("#email"),            `[A][${vp.label}] email input visible`);
    assert(await page.isVisible("#password"),         `[A][${vp.label}] password input visible`);
    assert(await page.isVisible("#confirm_password"), `[A][${vp.label}] confirm_password input visible`);
    assert(await page.isVisible(".employer-register-page__submit"), `[A][${vp.label}] Submit button visible`);

    const card = await page.$(".employer-register-page__card");
    const box = await card?.boundingBox();
    assert(box && box.width <= vp.width, `[A][${vp.label}] Card fits viewport (${box?.width?.toFixed(0)}px <= ${vp.width}px)`);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    await page.screenshot({ path: `${ARTIFACT_DIR}/A-${vp.label}-render.png`, fullPage: false });

    // A8–A9: Empty submit validation
    await page.click(".employer-register-page__submit");
    await page.waitForTimeout(200);
    assert(await page.isVisible(".employer-register-page__error"), `[A][${vp.label}] Error on empty submit`);
    assert(!page.url().includes("/jobs"),                          `[A][${vp.label}] No navigation on empty submit`);

    // A10: Password mismatch
    await page.fill("#full_name", "Test Employer");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "SecurePass1!");
    await page.fill("#confirm_password", "MismatchPass!");
    await page.click(".employer-register-page__submit");
    await page.waitForTimeout(200);
    assert(await page.isVisible(".employer-register-page__error"), `[A][${vp.label}] Error on password mismatch`);

    // A11: Mock success → /jobs
    await page.route("**/api/v1/auth/register", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(MOCK_EMPLOYER_REGISTER),
      })
    );
    // Re-mock /auth/me to return the authenticated user after redirect
    await page.route("**/api/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_EMPLOYER_REGISTER.user),
      })
    );

    await page.fill("#full_name", "Test Employer");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "SecurePass1!");
    await page.fill("#confirm_password", "SecurePass1!");
    await page.click(".employer-register-page__submit");

    try {
      await page.waitForURL(`${APP_URL}/jobs`, { timeout: 5000 });
      assert(true, `[A][${vp.label}] Redirect to /jobs after successful register`);
    } catch {
      const url = page.url();
      assert(url.includes("/jobs"), `[A][${vp.label}] Redirect to /jobs after successful register (url: ${url})`);
    }

    await page.screenshot({ path: `${ARTIFACT_DIR}/A-${vp.label}-post-submit.png`, fullPage: false });

  } finally {
    await context.close();
  }
}

// ─── Scenario B: Candidate register ──────────────────────────────────────────

async function runCandidateRegister(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await context.newPage();

  try {
    console.log(`\n── [B] ${vp.label} — Candidate register ──`);

    // LIFO: catch-all first (lowest priority), specific routes last (highest priority)
    await page.route("**/*", (route) => route.continue());
    await page.route("**/api/v1/auth/me", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      })
    );

    // B1–B7: Render checks
    await page.goto(`${APP_URL}/candidate/register`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".candidate-register-page", { timeout: 8000 });

    const title = await page.textContent(".candidate-register-page__title");
    assert(title?.includes("Aday"), `[B][${vp.label}] Title renders: "${title?.trim()}"`);

    assert(await page.isVisible("#full_name"),        `[B][${vp.label}] full_name input visible`);
    assert(await page.isVisible("#email"),            `[B][${vp.label}] email input visible`);
    assert(await page.isVisible("#password"),         `[B][${vp.label}] password input visible`);
    assert(await page.isVisible("#confirm_password"), `[B][${vp.label}] confirm_password input visible`);
    assert(await page.isVisible(".candidate-register-page__submit"), `[B][${vp.label}] Submit button visible`);

    const card = await page.$(".candidate-register-page__card");
    const box = await card?.boundingBox();
    assert(box && box.width <= vp.width, `[B][${vp.label}] Card fits viewport (${box?.width?.toFixed(0)}px <= ${vp.width}px)`);

    await page.screenshot({ path: `${ARTIFACT_DIR}/B-${vp.label}-render.png`, fullPage: false });

    // B8–B9: Empty submit validation
    await page.click(".candidate-register-page__submit");
    await page.waitForTimeout(200);
    assert(await page.isVisible(".candidate-register-page__error"),        `[B][${vp.label}] Error on empty submit`);
    assert(!page.url().includes("/talent/profile"), `[B][${vp.label}] No navigation on empty submit`);

    // B10: Password mismatch
    await page.fill("#full_name", "Test Candidate");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "SecurePass1!");
    await page.fill("#confirm_password", "MismatchPass!");
    await page.click(".candidate-register-page__submit");
    await page.waitForTimeout(200);
    assert(await page.isVisible(".candidate-register-page__error"), `[B][${vp.label}] Error on password mismatch`);

    // B11: Mock success → /talent/profile
    await page.route("**/api/v1/auth/register", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CANDIDATE_REGISTER),
      })
    );
    // Re-mock /auth/me to return the authenticated user after redirect
    await page.route("**/api/v1/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CANDIDATE_REGISTER.user),
      })
    );
    // Stub /talent/me so the profile page doesn't hard-fail
    await page.route("**/api/v1/talent/me", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "No profile" }),
      })
    );

    await page.fill("#full_name", "Test Candidate");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "SecurePass1!");
    await page.fill("#confirm_password", "SecurePass1!");
    await page.click(".candidate-register-page__submit");

    try {
      await page.waitForURL(`${APP_URL}/talent/profile`, { timeout: 5000 });
      assert(true, `[B][${vp.label}] Redirect to /talent/profile after successful register`);
    } catch {
      const url = page.url();
      assert(url.includes("/talent/profile"), `[B][${vp.label}] Redirect to /talent/profile after successful register (url: ${url})`);
    }

    await page.screenshot({ path: `${ARTIFACT_DIR}/B-${vp.label}-post-submit.png`, fullPage: false });

  } finally {
    await context.close();
  }
}

// ─── Scenario C: Public nav CTA visibility ────────────────────────────────────

async function runPublicNavCta(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await context.newPage();

  try {
    console.log(`\n── [C] ${vp.label} — Public nav CTA ──`);

    // LIFO: catch-all first, /auth/me last
    await page.route("**/*", (route) => route.continue());
    await page.route("**/api/v1/auth/me", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      })
    );

    await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".public-nav-cta--employer", { timeout: 10000 });

    // C1: Employer CTA visible
    assert(await page.isVisible(".public-nav-cta--employer"), `[C][${vp.label}] Employer register CTA visible`);

    // C2: Candidate CTA visible
    assert(await page.isVisible(".public-nav-cta--candidate"), `[C][${vp.label}] Candidate register CTA visible`);

    // C3: Employer CTA non-zero width
    const el = await page.$(".public-nav-cta--employer");
    const box = await el?.boundingBox();
    assert(box && box.width > 0, `[C][${vp.label}] Employer CTA has non-zero width (${box?.width?.toFixed(0) ?? "?"}px)`);

    await page.screenshot({ path: `${ARTIFACT_DIR}/C-${vp.label}-nav.png`, fullPage: false });

    // C4: Mobile popup (360 only)
    if (vp.label === "mobile-360") {
      const loginBtn = await page.$("nav button[type='button']");
      if (loginBtn) {
        await loginBtn.click();
        await page.waitForTimeout(300);

        const employerLinks = await page.$$('a[href="/employer/register"]');
        const candidateLinks = await page.$$('a[href="/candidate/register"]');

        assert(
          employerLinks.length >= 2,
          `[C][mobile-360][popup] Employer register link in popup (found ${employerLinks.length})`
        );
        assert(
          candidateLinks.length >= 2,
          `[C][mobile-360][popup] Candidate register link in popup (found ${candidateLinks.length})`
        );

        await page.screenshot({ path: `${ARTIFACT_DIR}/C-mobile-360-popup.png`, fullPage: false });
      } else {
        assert(false, "[C][mobile-360][popup] Login popup button not found");
        assert(false, "[C][mobile-360][popup] Candidate register link in popup");
      }
    }

  } finally {
    await context.close();
  }
}

// ─── Scenario D: Activation redirect smoke ────────────────────────────────────

async function runActivationSmoke(browser) {
  console.log(`\n── [D] desktop-1280 — Activation redirect smoke ──`);

  // D1. employer_company_admin → /jobs
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    try {
      // LIFO: catch-all first, specific routes last
      await page.route("**/*", (route) => route.continue());
      await page.route("**/api/v1/auth/me", (route) =>
        route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "Not authenticated" }) })
      );
      await page.route("**/api/v1/auth/activate/verify", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_EMPLOYER_VERIFY) })
      );
      await page.route("**/api/v1/auth/activate", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_EMPLOYER_ACTIVATE) })
      );

      await page.goto(`${APP_URL}/activate-account?token=mock-employer-token`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("input[type='password']", { timeout: 8000 });

      await page.fill("input[type='password']", "StrongPass1!");
      const inputs = await page.$$("input[type='password']");
      if (inputs.length >= 2) await inputs[1].fill("StrongPass1!");
      await page.click("button[type='submit']");

      try {
        await page.waitForURL(`${APP_URL}/jobs`, { timeout: 6000 });
        assert(true, "[D] Activation employer_company_admin → /jobs redirect");
      } catch {
        const url = page.url();
        assert(url.includes("/jobs"), `[D] Activation employer_company_admin → /jobs redirect (url: ${url})`);
      }

      await page.screenshot({ path: `${ARTIFACT_DIR}/D-employer-activation.png`, fullPage: false });
    } finally {
      await context.close();
    }
  }

  // D2. candidate_user → /talent/profile
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    try {
      // LIFO: catch-all first, specific routes last
      await page.route("**/*", (route) => route.continue());
      await page.route("**/api/v1/auth/me", (route) =>
        route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "Not authenticated" }) })
      );
      await page.route("**/api/v1/talent/me", (route) =>
        route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "No profile" }) })
      );
      await page.route("**/api/v1/auth/activate/verify", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CANDIDATE_VERIFY) })
      );
      await page.route("**/api/v1/auth/activate", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CANDIDATE_ACTIVATE) })
      );

      await page.goto(`${APP_URL}/activate-account?token=mock-candidate-token`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("input[type='password']", { timeout: 8000 });

      await page.fill("input[type='password']", "StrongPass1!");
      const inputs = await page.$$("input[type='password']");
      if (inputs.length >= 2) await inputs[1].fill("StrongPass1!");
      await page.click("button[type='submit']");

      try {
        await page.waitForURL(`${APP_URL}/talent/profile`, { timeout: 6000 });
        assert(true, "[D] Activation candidate_user → /talent/profile redirect");
      } catch {
        const url = page.url();
        assert(url.includes("/talent/profile"), `[D] Activation candidate_user → /talent/profile redirect (url: ${url})`);
      }

      await page.screenshot({ path: `${ARTIFACT_DIR}/D-candidate-activation.png`, fullPage: false });
    } finally {
      await context.close();
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("PHASE 4 / Atomik-7 — Full PHASE 4 E2E Gate");
  console.log(`App URL: ${APP_URL}`);
  console.log(`Viewports: ${VIEWPORTS.map((v) => v.label).join(", ")}`);
  console.log(`Scenarios: A (employer register), B (candidate register), C (nav CTA), D (activation smoke)\n`);

  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    // Scenario A: Employer register — 3 viewports
    for (const vp of VIEWPORTS) {
      await runEmployerRegister(browser, vp);
    }

    // Scenario B: Candidate register — 3 viewports
    for (const vp of VIEWPORTS) {
      await runCandidateRegister(browser, vp);
    }

    // Scenario C: Public nav CTA — 3 viewports
    for (const vp of VIEWPORTS) {
      await runPublicNavCta(browser, vp);
    }

    // Scenario D: Activation redirect smoke — desktop only
    await runActivationSmoke(browser);

  } finally {
    await browser.close();
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Result: ${passed} PASS / ${failed} FAIL / ${passed + failed} TOTAL`);

  writeFileSync(
    `${ARTIFACT_DIR}/report.json`,
    JSON.stringify({ passed, failed, total: passed + failed, results }, null, 2)
  );
  console.log(`Report: ${ARTIFACT_DIR}/report.json`);
  console.log(`Screenshots: ${ARTIFACT_DIR}/`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Gate runner error:", err);
  process.exit(1);
});

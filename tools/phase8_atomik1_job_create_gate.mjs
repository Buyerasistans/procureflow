// Gate: PHASE 8 / Atomik-1 — JobCreatePage form
// Pattern: function predicates (LIFO), pf_access_token + pf_user in sessionStorage
// Assertions: 4 per viewport (3 viewports) + 3 scenario tests = 15 total
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://127.0.0.1:5175";
const ARTIFACTS_DIR = path.join(__dirname, "gate-artifacts", "phase8-atomik1-job-create");

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const VIEWPORTS = [
  { w: 360, h: 812, label: "360" },
  { w: 768, h: 1024, label: "768" },
  { w: 1280, h: 800, label: "1280" },
];

const EMPLOYER_USER = {
  id: 5001,
  email: "employer@test.local",
  full_name: "Test Employer",
  role: "user",
  business_role: "user",
  system_role: "employer_company_admin",
};

const TENANT_MEMBER_USER = {
  id: 5002,
  email: "member@test.local",
  full_name: "Test Member",
  role: "user",
  business_role: "user",
  system_role: "tenant_member",
};

const MOCK_CREATED_JOB = {
  id: 99,
  title: "Satın Alma Uzmanı",
  status: "draft",
};

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function setupRoutes(page, user) {
  const userJson = JSON.stringify(user);
  const refreshJson = JSON.stringify({ access_token: "mock-token", refresh_token: "mock-refresh" });
  const emptyList = JSON.stringify({ total: 0, page: 1, size: 20, items: [] });

  // LIFO: lowest priority first
  // 1. Catch-all: any API request → {}
  await page.route(
    (url) => url.href.includes("localhost:8000") || url.href.includes("127.0.0.1:8000"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  // 2. /api/v1/jobs: GET → empty list, POST → created job (single handler, no continue)
  await page.route(
    (url) => url.href.includes("/api/v1/jobs") && url.href.split("?")[0].endsWith("/jobs"),
    async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201, contentType: "application/json",
          body: JSON.stringify(MOCK_CREATED_JOB),
        });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: emptyList });
      }
    }
  );

  // 3. /auth/refresh
  await page.route(
    (url) => url.href.includes("/auth/refresh"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: refreshJson })
  );

  // 4. /auth/me (highest priority)
  await page.route(
    (url) => url.href.includes("/auth/me"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: userJson })
  );
}

async function injectSession(page, user) {
  const userJson = JSON.stringify(user);
  await page.addInitScript((u) => {
    sessionStorage.setItem("pf_access_token", "mock-employer-token-phase8a1");
    sessionStorage.setItem("pf_user", u);
  }, userJson);
}

async function runViewportRenderTest(browser, viewport) {
  const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`  [page:error] ${msg.text().substring(0, 120)}`);
    }
  });

  await injectSession(page, EMPLOYER_USER);
  await setupRoutes(page, EMPLOYER_USER);

  console.log(`\n[${viewport.label}px] employer_company_admin → /jobs/new form render`);

  try {
    await page.goto(`${BASE_URL}/jobs/new`, { waitUntil: "domcontentloaded" });

    try {
      await page.waitForSelector(".app-layout__header", { timeout: 12000 });
    } catch {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `debug-noheader-${viewport.label}.png`), fullPage: true });
      throw new Error(`App layout header not found. URL: ${page.url()}`);
    }

    // A1: form container present
    const form = page.locator(".job-create");
    assert(await form.isVisible(), `[${viewport.label}] A1: .job-create container visible`);

    // A2: title input present
    const titleInput = page.locator("#jc-title");
    assert(await titleInput.isVisible(), `[${viewport.label}] A2: İlan başlığı input visible`);

    // A3: submit button present
    const submitBtn = page.locator(".job-create__btn--submit");
    assert(await submitBtn.isVisible(), `[${viewport.label}] A3: Submit button visible`);

    // A4: form fits viewport (no horizontal overflow)
    const formBox = await form.boundingBox();
    const fits = formBox !== null && formBox.x >= 0 && formBox.x + formBox.width <= viewport.w + 2;
    assert(fits, `[${viewport.label}] A4: Form fits within ${viewport.label}px viewport`);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `form-render-${viewport.label}.png`), fullPage: false });
  } catch (err) {
    console.error(`  [${viewport.label}] EXCEPTION:`, err.message.split("\n")[0]);
    failed++;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-render-${viewport.label}.png`) }).catch(() => {});
  }

  await ctx.close();
}

async function runForbiddenTest(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await injectSession(page, TENANT_MEMBER_USER);
  await setupRoutes(page, TENANT_MEMBER_USER);

  console.log(`\n[1280px] tenant_member → /jobs/new forbidden guard`);

  try {
    await page.goto(`${BASE_URL}/jobs/new`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".app-layout__header", { timeout: 12000 });

    // form should NOT render
    const form = page.locator(".job-create__form");
    const formVisible = await form.isVisible().catch(() => false);
    assert(!formVisible, `[1280] A13: Form NOT rendered for tenant_member`);

    // forbidden message should appear
    const forbidden = page.locator(".job-create__forbidden");
    assert(await forbidden.isVisible(), `[1280] A14: Forbidden message visible for tenant_member`);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "forbidden-tenant-member.png"), fullPage: false });
  } catch (err) {
    console.error(`  [1280] EXCEPTION:`, err.message.split("\n")[0]);
    failed++;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-forbidden.png") }).catch(() => {});
  }

  await ctx.close();
}

async function runSubmitSuccessTest(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await injectSession(page, EMPLOYER_USER);
  await setupRoutes(page, EMPLOYER_USER);

  console.log(`\n[1280px] employer_company_admin → submit draft → navigates to /jobs`);

  try {
    await page.goto(`${BASE_URL}/jobs/new`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".job-create__form", { timeout: 12000 });

    // Fill required fields
    await page.fill("#jc-title", "Satın Alma Uzmanı Testi");
    await page.fill("#jc-description", "Bu pozisyon için detaylı açıklama metni buraya girilir ve on karakterden uzundur.");

    // Submit (default status = draft)
    const submitBtn = page.locator(".job-create__btn--submit");
    await Promise.all([
      page.waitForURL("**/jobs**", { timeout: 8000 }),
      submitBtn.click(),
    ]);

    const currentUrl = page.url();
    assert(currentUrl.endsWith("/jobs") || currentUrl.includes("/jobs?"), `[1280] A15: Submit success navigates to /jobs (url: ${currentUrl})`);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "submit-success.png"), fullPage: false });
  } catch (err) {
    console.error(`  [1280] EXCEPTION:`, err.message.split("\n")[0]);
    failed++;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-submit.png") }).catch(() => {});
  }

  await ctx.close();
}

async function main() {
  console.log("=== Phase 8 / Atomik-1 Gate: JobCreatePage ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Artifacts: ${ARTIFACTS_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const vp of VIEWPORTS) {
      await runViewportRenderTest(browser, vp);
    }
    await runForbiddenTest(browser);
    await runSubmitSuccessTest(browser);
  } finally {
    await browser.close();
  }

  const total = passed + failed;
  console.log(`\n=== GATE RESULT: ${passed}/${total} PASS ===`);

  const report = {
    gate: "phase8-atomik1-job-create",
    timestamp: new Date().toISOString(),
    viewports: VIEWPORTS.map((v) => v.label),
    passed,
    failed,
    total,
    result: failed === 0 ? "PASS" : "FAIL",
  };
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "report.json"), JSON.stringify(report, null, 2));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Gate fatal error:", err);
  process.exit(1);
});

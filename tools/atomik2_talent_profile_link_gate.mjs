// Gate: PHASE 5 / Atomik-2 — TALENT_PROFILE_REQUIRED link
// Pattern: function predicates (LIFO), pf_access_token session, app-layout header wait
// Assertions: 6 per viewport (3 viewports) + 1 desktop link-click = 19 total
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://127.0.0.1:5175";
const ARTIFACTS_DIR = path.join(__dirname, "gate-artifacts", "atomik2-talent-profile-link");

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const VIEWPORTS = [
  { w: 360, h: 812, label: "360" },
  { w: 768, h: 1024, label: "768" },
  { w: 1280, h: 800, label: "1280" },
];

const CANDIDATE_USER = {
  id: 9002,
  email: "candidate@test.local",
  full_name: "Test Candidate",
  role: "user",
  business_role: "user",
  system_role: "candidate_user",
};

const CANDIDATE_USER_JSON = JSON.stringify(CANDIDATE_USER);

const MOCK_JOB = {
  id: 42,
  tenant_id: null,
  posted_by_user_id: 1,
  title: "Yazılım Geliştirici",
  description: "Test pozisyonu için detaylı açıklama buraya gelir, biraz daha uzun bir metin.",
  category: "Engineering",
  employment_type: "full_time",
  location_type: "remote",
  city: null,
  country: null,
  salary_min: null,
  salary_max: null,
  salary_currency: "TRY",
  salary_period: "monthly",
  required_skills: [],
  min_experience_years: null,
  status: "published",
  application_deadline: null,
  is_procurement_only: false,
  view_count: 100,
  application_count: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_JOBS_JSON = JSON.stringify({ total: 1, page: 1, size: 20, items: [MOCK_JOB] });

const TALENT_PROFILE_REQUIRED_JSON = JSON.stringify({
  detail: { code: "TALENT_PROFILE_REQUIRED", message: "Başvuru yapmak için önce talent profili oluşturmalısınız." },
});

const REFRESH_JSON = JSON.stringify({
  access_token: "mock-candidate-token-atomik2",
  refresh_token: "mock-candidate-refresh-atomik2",
});

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

// LIFO: registered first = lowest priority, registered last = highest priority
async function setupRoutes(page) {
  // 1. Catch-all: any API server request → {} (lowest priority)
  await page.route(
    (url) => url.href.includes("localhost:8000") || url.href.includes("127.0.0.1:8000"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  // 2. GET /jobs list (no /apply in path) → mock list
  await page.route(
    (url) => url.href.includes("/api/v1/jobs") && !url.href.includes("/apply"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: MOCK_JOBS_JSON })
  );

  // 3. POST /jobs/.../apply → TALENT_PROFILE_REQUIRED
  await page.route(
    (url) => url.href.includes("/apply"),
    (route) => route.fulfill({ status: 422, contentType: "application/json", body: TALENT_PROFILE_REQUIRED_JSON })
  );

  // 4. /auth/refresh → success
  await page.route(
    (url) => url.href.includes("/auth/refresh"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: REFRESH_JSON })
  );

  // 5. /auth/me → candidate_user (highest priority — registered last)
  await page.route(
    (url) => url.href.includes("/auth/me"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: CANDIDATE_USER_JSON })
  );
}

async function injectSession(page) {
  await page.addInitScript((u) => {
    sessionStorage.setItem("pf_access_token", "mock-candidate-token-atomik2");
    sessionStorage.setItem("pf_user", u);
  }, CANDIDATE_USER_JSON);
}

async function runViewportTest(browser, viewport) {
  const isDesktop = viewport.w === 1280;
  const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().includes("[HTTP]")) {
      console.log(`  [page:${msg.type()}] ${msg.text().substring(0, 100)}`);
    }
  });

  await injectSession(page);
  await setupRoutes(page);

  console.log(`\n[${viewport.label}px] Candidate apply → TALENT_PROFILE_REQUIRED link`);

  try {
    await page.goto(`${BASE_URL}/jobs`, { waitUntil: "domcontentloaded" });

    // Wait for app shell header first (proves auth succeeded)
    try {
      await page.waitForSelector(".app-layout__header", { timeout: 12000 });
    } catch {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `debug-noheader-${viewport.label}.png`), fullPage: true });
      throw new Error(`App layout header not found — auth may have failed (redirected to login?). URL: ${page.url()}`);
    }

    // Wait for job card
    await page.waitForSelector(".job-card", { timeout: 8000 });

    // A1: Başvur button visible
    const applyBtn = page.locator(".job-card .jobs-page__btn--primary").first();
    assert(await applyBtn.isVisible(), `[${viewport.label}] A1: Başvur button visible`);

    await applyBtn.click();
    await page.waitForSelector(".apply-form", { timeout: 4000 });

    // Submit with empty cover letter
    await page.locator(".apply-form button[type=submit]").click();
    await page.waitForSelector(".apply-form .jobs-page__error", { timeout: 5000 });

    // A2: Error div visible
    const errorDiv = page.locator(".apply-form .jobs-page__error");
    assert(await errorDiv.isVisible(), `[${viewport.label}] A2: TALENT_PROFILE_REQUIRED error div visible`);

    // A3: Error message text correct
    const errorText = (await errorDiv.textContent()) ?? "";
    assert(errorText.includes("önce talent profilinizi"), `[${viewport.label}] A3: Error message text correct`);

    // A4: /talent/profile link visible
    const profileLink = page.locator(".apply-form .jobs-page__error-link");
    assert(await profileLink.isVisible(), `[${viewport.label}] A4: /talent/profile link visible`);

    // A5: Link href correct
    const linkHref = await profileLink.getAttribute("href");
    assert(linkHref === "/talent/profile", `[${viewport.label}] A5: Link href="/talent/profile"`);

    // A6: Error block fits within viewport
    const errorBox = await errorDiv.boundingBox();
    const fits = errorBox !== null && errorBox.x >= 0 && errorBox.x + errorBox.width <= viewport.w + 2;
    assert(fits, `[${viewport.label}] A6: Error block fits within ${viewport.label}px viewport`);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `error-link-${viewport.label}.png`), fullPage: false });

    // A7 (desktop only): Link click → navigates to /talent/profile
    if (isDesktop) {
      console.log(`\n[${viewport.label}px] A7: Link click navigation`);
      await Promise.all([
        page.waitForURL("**/talent/profile**", { timeout: 5000 }),
        profileLink.click(),
      ]);
      const currentUrl = page.url();
      assert(currentUrl.includes("/talent/profile"), `[${viewport.label}] A7: Link click navigates to /talent/profile`);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `post-link-click-${viewport.label}.png`), fullPage: false });
    }
  } catch (err) {
    console.error(`  [${viewport.label}] EXCEPTION:`, err.message.split("\n")[0]);
    failed++;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-${viewport.label}.png`) }).catch(() => {});
  }

  await ctx.close();
}

async function main() {
  console.log("=== Atomik-2 Gate: TALENT_PROFILE_REQUIRED Link ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Artifacts: ${ARTIFACTS_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const vp of VIEWPORTS) {
      await runViewportTest(browser, vp);
    }
  } finally {
    await browser.close();
  }

  const total = passed + failed;
  console.log(`\n=== GATE RESULT: ${passed}/${total} PASS ===`);

  const report = {
    gate: "atomik2-talent-profile-link",
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

// Gate: PHASE 5 / Atomik-7 — Candidate application withdrawal
// Assertions: A(3) + B(2) + C(2) + D(1) + E(3) = 11 total
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://127.0.0.1:5175";
const ARTIFACTS_DIR = path.join(__dirname, "gate-artifacts", "atomik7-candidate-withdrawal");

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

const EMPLOYER_USER = {
  id: 9001,
  email: "employer@test.local",
  full_name: "Test Employer",
  role: "user",
  business_role: "user",
  system_role: "employer_company_admin",
};

const MOCK_JOB = {
  id: 42,
  tenant_id: null,
  posted_by_user_id: 9001,
  title: "Yazilim Gelistirici",
  description: "Test pozisyonu icin detayli aciklama metni buraya gelir.",
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
  view_count: 10,
  application_count: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// 3 apps: applied (withdrawable), withdrawn (terminal), rejected (terminal)
const MOCK_MY_APP_APPLIED = {
  id: 201,
  job_id: 42,
  applicant_user_id: 9002,
  talent_profile_id: 2001,
  cover_letter: null,
  status: "applied",
  ai_match_score: null,
  employer_note: null,
  reviewed_by_user_id: null,
  reviewed_at: null,
  applied_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_MY_APP_WITHDRAWN = {
  id: 202,
  job_id: 43,
  applicant_user_id: 9002,
  talent_profile_id: 2001,
  cover_letter: null,
  status: "withdrawn",
  ai_match_score: null,
  employer_note: null,
  reviewed_by_user_id: null,
  reviewed_at: null,
  applied_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_MY_APP_REJECTED = {
  id: 203,
  job_id: 44,
  applicant_user_id: 9002,
  talent_profile_id: 2001,
  cover_letter: null,
  status: "rejected",
  ai_match_score: null,
  employer_note: null,
  reviewed_by_user_id: null,
  reviewed_at: null,
  applied_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_JOBS_JSON = JSON.stringify({ total: 1, page: 1, size: 20, items: [MOCK_JOB] });
const MOCK_MY_APPS_JSON = JSON.stringify([MOCK_MY_APP_APPLIED, MOCK_MY_APP_WITHDRAWN, MOCK_MY_APP_REJECTED]);
// POST /applications/201/withdraw → returns the applied app as withdrawn
const MOCK_WITHDRAW_RESPONSE_JSON = JSON.stringify({ ...MOCK_MY_APP_APPLIED, status: "withdrawn" });
const REFRESH_JSON = JSON.stringify({ access_token: "mock-token-atomik7", refresh_token: "mock-refresh-atomik7" });

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

async function makeContext(browser, viewport, user) {
  const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().includes("[HTTP]")) {
      console.log(`  [page:${msg.type()}] ${msg.text().substring(0, 100)}`);
    }
  });

  const userJson = JSON.stringify(user);
  await page.addInitScript((u) => {
    sessionStorage.setItem("pf_access_token", "mock-token-atomik7");
    sessionStorage.setItem("pf_user", u);
  }, userJson);

  // LIFO: catch-all first = lowest priority
  await page.route(
    (url) => url.href.includes("localhost:8000") || url.href.includes("127.0.0.1:8000"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  // /api/v1/jobs — GET list
  await page.route(
    (url) => url.href.includes("/api/v1/jobs"),
    (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({ status: 200, contentType: "application/json", body: MOCK_JOBS_JSON });
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
    }
  );

  // /api/v1/my/applications — GET candidate's own apps
  await page.route(
    (url) => url.href.includes("/api/v1/my/applications"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: MOCK_MY_APPS_JSON })
  );

  // /api/v1/applications/{id}/withdraw — POST withdraw
  await page.route(
    (url) => url.href.includes("/api/v1/applications/") && url.href.includes("/withdraw"),
    (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 200, contentType: "application/json", body: MOCK_WITHDRAW_RESPONSE_JSON });
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
    }
  );

  // /auth/refresh
  await page.route(
    (url) => url.href.includes("/auth/refresh"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: REFRESH_JSON })
  );

  // /auth/me — highest priority (registered last)
  await page.route(
    (url) => url.href.includes("/auth/me"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: userJson })
  );

  return { ctx, page };
}

async function navigateToJobs(page, screenshotSuffix) {
  await page.goto(`${BASE_URL}/jobs`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector(".app-layout__header", { timeout: 12000 });
  } catch {
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `debug-noheader-${screenshotSuffix}.png`), fullPage: true });
    throw new Error(`App layout header not found — URL: ${page.url()}`);
  }
  await page.waitForSelector(".job-card", { timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Scenario A — candidate + withdrawable status → "Geri Çek" visible (3 viewports)
// ---------------------------------------------------------------------------
async function runScenarioA(browser) {
  console.log("\n=== Scenario A: Candidate — 'Geri Cek' button visible on withdrawable row (3 viewports) ===");
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER);
    try {
      await navigateToJobs(page, `A-${vp.label}`);
      await page.waitForSelector(".my-application-row", { timeout: 6000 });

      assert(
        await page.locator(".my-application-row__btn--withdraw").isVisible(),
        `[${vp.label}] A1: 'Geri Cek' button visible on applied row`
      );
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenA-${vp.label}.png`) });
    } catch (err) {
      console.error(`  [${vp.label}] EXCEPTION ScenA:`, err.message.split("\n")[0]);
      failed += 1;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-A-${vp.label}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Scenario B — click "Geri Çek" → POST mock → badge = withdrawn, button gone
// ---------------------------------------------------------------------------
async function runScenarioB(browser) {
  console.log("\n=== Scenario B: Click 'Geri Cek' → POST mock → badge withdrawn + button disappears ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER);
  try {
    await navigateToJobs(page, "B");
    await page.waitForSelector(".my-application-row", { timeout: 6000 });

    // Click withdraw on the applied row (first row)
    await page.locator(".my-application-row__btn--withdraw").click();

    // Wait for optimistic state update: badge changes to "withdrawn"
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll(".my-application-row");
        if (!rows[0]) return false;
        const badge = rows[0].querySelector(".application-status-badge");
        return badge && badge.textContent === "withdrawn";
      },
      { timeout: 5000 }
    );

    const badge = await page.locator(".my-application-row").first().locator(".application-status-badge").textContent();
    assert(badge === "withdrawn", `[1280] B1: Applied row badge updated to 'withdrawn' after POST`);

    // Button should disappear since withdrawn is not in WITHDRAWABLE_STATUSES
    assert(
      (await page.locator(".my-application-row__btn--withdraw").count()) === 0,
      `[1280] B2: No withdraw button remains after all apps are terminal`
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenB-after-withdraw.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenB:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-B.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario C — withdrawn + rejected rows have no "Geri Çek" button
// ---------------------------------------------------------------------------
async function runScenarioC(browser) {
  console.log("\n=== Scenario C: withdrawn + rejected rows have no 'Geri Cek' button ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER);
  try {
    await navigateToJobs(page, "C");
    await page.waitForSelector(".my-application-row", { timeout: 6000 });

    // Second row (withdrawn): no button
    assert(
      (await page.locator(".my-application-row").nth(1).locator(".my-application-row__btn--withdraw").count()) === 0,
      `[1280] C1: Withdrawn row has no 'Geri Cek' button`
    );

    // Third row (rejected): no button
    assert(
      (await page.locator(".my-application-row").nth(2).locator(".my-application-row__btn--withdraw").count()) === 0,
      `[1280] C2: Rejected row has no 'Geri Cek' button`
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenC-terminal-rows.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenC:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-C.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario D — employer session: "Başvurularım" not visible (regression)
// ---------------------------------------------------------------------------
async function runScenarioD(browser) {
  console.log("\n=== Scenario D: Employer — 'Basvurularım' not visible (regression) ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, EMPLOYER_USER);
  try {
    await navigateToJobs(page, "D");
    assert(
      (await page.locator(".jobs-page__my-applications").count()) === 0,
      `[1280] D1: Employer sees no 'Basvurularım' section`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenD-employer.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenD:`, err.message.split("\n")[0]);
    failed += 1;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-D.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario E — 3 viewports: withdraw button no overflow
// ---------------------------------------------------------------------------
async function runScenarioE(browser) {
  console.log("\n=== Scenario E: Responsive overflow check — 360/768/1280 ===");
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER);
    try {
      await navigateToJobs(page, `E-${vp.label}`);
      await page.waitForSelector(".my-application-row__btn--withdraw", { timeout: 6000 });

      const box = await page.locator(".my-application-row__btn--withdraw").boundingBox();
      assert(
        box !== null && box.x >= 0 && box.x + box.width <= vp.w + 2,
        `[${vp.label}] E1: Withdraw button fits within ${vp.label}px`
      );
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenE-${vp.label}.png`) });
    } catch (err) {
      console.error(`  [${vp.label}] EXCEPTION ScenE:`, err.message.split("\n")[0]);
      failed += 1;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-E-${vp.label}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Atomik-7 Gate: Candidate Application Withdrawal ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Artifacts: ${ARTIFACTS_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    await runScenarioA(browser);
    await runScenarioB(browser);
    await runScenarioC(browser);
    await runScenarioD(browser);
    await runScenarioE(browser);
  } finally {
    await browser.close();
  }

  const total = passed + failed;
  console.log(`\n=== GATE RESULT: ${passed}/${total} PASS ===`);

  const report = {
    gate: "atomik7-candidate-withdrawal",
    timestamp: new Date().toISOString(),
    viewports: VIEWPORTS.map((v) => v.label),
    scenarios: {
      A: "candidate withdrawable row — 'Geri Cek' visible 360/768/1280",
      B: "click withdraw -> POST mock -> badge withdrawn + button gone",
      C: "withdrawn + rejected rows have no button",
      D: "employer regression — no section",
      E: "responsive overflow — 360/768/1280",
    },
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

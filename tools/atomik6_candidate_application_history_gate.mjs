// Gate: PHASE 5 / Atomik-6 — Candidate application history UI
// Assertions: A(3) + B(3) + C(2) + D(2) + E(1) + F(3) = 14 total
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://127.0.0.1:5175";
const ARTIFACTS_DIR = path.join(__dirname, "gate-artifacts", "atomik6-candidate-application-history");

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
  application_count: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_MY_APP_1 = {
  id: 201,
  job_id: 42,
  applicant_user_id: 9002,
  talent_profile_id: 2001,
  cover_letter: "Test on yazisi",
  status: "applied",
  ai_match_score: null,
  employer_note: "Aday iyi gorununyor",
  reviewed_by_user_id: null,
  reviewed_at: null,
  applied_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_MY_APP_2 = {
  id: 202,
  job_id: 99,
  applicant_user_id: 9002,
  talent_profile_id: 2001,
  cover_letter: null,
  status: "shortlisted",
  ai_match_score: null,
  employer_note: null,
  reviewed_by_user_id: null,
  reviewed_at: null,
  applied_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_JOBS_JSON = JSON.stringify({ total: 1, page: 1, size: 20, items: [MOCK_JOB] });
const MOCK_MY_APPS_JSON = JSON.stringify([MOCK_MY_APP_1, MOCK_MY_APP_2]);
const MOCK_MY_APPS_EMPTY_JSON = JSON.stringify([]);
const REFRESH_JSON = JSON.stringify({ access_token: "mock-token-atomik6", refresh_token: "mock-refresh-atomik6" });

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

// myAppsBody: JSON string for /my/applications response
async function makeContext(browser, viewport, user, myAppsBody) {
  const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().includes("[HTTP]")) {
      console.log(`  [page:${msg.type()}] ${msg.text().substring(0, 100)}`);
    }
  });

  const userJson = JSON.stringify(user);
  await page.addInitScript((u) => {
    sessionStorage.setItem("pf_access_token", "mock-token-atomik6");
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
      const method = route.request().method();
      if (method === "GET") {
        route.fulfill({ status: 200, contentType: "application/json", body: MOCK_JOBS_JSON });
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
    }
  );

  // /api/v1/my/applications — registered after /jobs, higher LIFO priority
  await page.route(
    (url) => url.href.includes("/api/v1/my/applications"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: myAppsBody })
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
    throw new Error(`App layout header not found — auth failed? URL: ${page.url()}`);
  }
  // Wait for jobs to load (published job visible for candidates too)
  await page.waitForSelector(".job-card", { timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Scenario A — candidate + 3 viewports: "Basvurularim" section visible
// ---------------------------------------------------------------------------
async function runScenarioA(browser) {
  console.log("\n=== Scenario A: Candidate — 'Basvürularım' section visible (3 viewports) ===");
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER, MOCK_MY_APPS_JSON);
    try {
      await navigateToJobs(page, `A-${vp.label}`);
      await page.waitForSelector(".jobs-page__my-applications", { timeout: 5000 });
      assert(
        await page.locator(".jobs-page__my-applications").isVisible(),
        `[${vp.label}] A1: 'Basvürularım' section visible`
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
// Scenario B — mock list → 2 rows + status badges
// ---------------------------------------------------------------------------
async function runScenarioB(browser) {
  console.log("\n=== Scenario B: Mock /my/applications list → rows + badges render ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER, MOCK_MY_APPS_JSON);
  try {
    await navigateToJobs(page, "B");
    await page.waitForSelector(".my-application-row", { timeout: 6000 });

    assert(
      (await page.locator(".my-application-row").count()) === 2,
      `[1280] B1: 2 application rows visible`
    );

    const badge1 = await page.locator(".my-application-row").first().locator(".application-status-badge").textContent();
    assert(badge1 === "applied", `[1280] B2: First row status badge = 'applied'`);

    const badge2 = await page.locator(".my-application-row").nth(1).locator(".application-status-badge").textContent();
    assert(badge2 === "shortlisted", `[1280] B3: Second row status badge = 'shortlisted'`);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenB-rows.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenB:`, err.message.split("\n")[0]);
    failed += 3;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-B.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario C — date field + employer_note visible
// ---------------------------------------------------------------------------
async function runScenarioC(browser) {
  console.log("\n=== Scenario C: Date field + employer_note visible ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER, MOCK_MY_APPS_JSON);
  try {
    await navigateToJobs(page, "C");
    await page.waitForSelector(".my-application-row", { timeout: 6000 });

    assert(
      await page.locator(".my-application-row").first().locator(".my-application-row__date").first().isVisible(),
      `[1280] C1: applied_at date visible in first row`
    );

    assert(
      await page.locator(".my-application-row").first().locator(".my-application-row__note").isVisible(),
      `[1280] C2: employer_note visible in first row`
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenC-fields.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenC:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-C.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario D — empty list → empty state visible
// ---------------------------------------------------------------------------
async function runScenarioD(browser) {
  console.log("\n=== Scenario D: Empty /my/applications → empty state ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER, MOCK_MY_APPS_EMPTY_JSON);
  try {
    await navigateToJobs(page, "D");
    await page.waitForSelector(".jobs-page__my-applications", { timeout: 5000 });
    await page.waitForSelector(".jobs-page__my-applications-empty", { timeout: 5000 });

    assert(
      await page.locator(".jobs-page__my-applications").isVisible(),
      `[1280] D1: 'Basvürularım' section visible even when empty`
    );

    const emptyText = await page.locator(".jobs-page__my-applications-empty").textContent();
    assert(
      emptyText !== null && emptyText.includes("bulunmuyor"),
      `[1280] D2: Empty state message contains 'bulunmuyor'`
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenD-empty.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenD:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-D.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario E — employer session: "Basvürularım" NOT visible (regression)
// ---------------------------------------------------------------------------
async function runScenarioE(browser) {
  console.log("\n=== Scenario E: Employer session — 'Basvürularım' NOT visible ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, EMPLOYER_USER, MOCK_MY_APPS_JSON);
  try {
    await navigateToJobs(page, "E");
    assert(
      (await page.locator(".jobs-page__my-applications").count()) === 0,
      `[1280] E1: Employer sees no 'Basvürularım' section`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenE-employer.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenE:`, err.message.split("\n")[0]);
    failed += 1;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-E.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario F — 3 viewports: "Basvürularım" section no overflow
// ---------------------------------------------------------------------------
async function runScenarioF(browser) {
  console.log("\n=== Scenario F: Responsive overflow check — 360/768/1280 ===");
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER, MOCK_MY_APPS_JSON);
    try {
      await navigateToJobs(page, `F-${vp.label}`);
      await page.waitForSelector(".jobs-page__my-applications", { timeout: 5000 });

      const box = await page.locator(".jobs-page__my-applications").boundingBox();
      assert(
        box !== null && box.x >= 0 && box.x + box.width <= vp.w + 2,
        `[${vp.label}] F1: 'Basvürularım' section fits within ${vp.label}px`
      );
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenF-${vp.label}.png`) });
    } catch (err) {
      console.error(`  [${vp.label}] EXCEPTION ScenF:`, err.message.split("\n")[0]);
      failed += 1;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-F-${vp.label}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Atomik-6 Gate: Candidate Application History UI ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Artifacts: ${ARTIFACTS_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    await runScenarioA(browser);
    await runScenarioB(browser);
    await runScenarioC(browser);
    await runScenarioD(browser);
    await runScenarioE(browser);
    await runScenarioF(browser);
  } finally {
    await browser.close();
  }

  const total = passed + failed;
  console.log(`\n=== GATE RESULT: ${passed}/${total} PASS ===`);

  const report = {
    gate: "atomik6-candidate-application-history",
    timestamp: new Date().toISOString(),
    viewports: VIEWPORTS.map((v) => v.label),
    scenarios: {
      A: "candidate section visible — 360/768/1280",
      B: "mock list -> 2 rows + status badges",
      C: "date field + employer_note visible",
      D: "empty list -> empty state message",
      E: "employer regression — no section",
      F: "responsive overflow — 360/768/1280",
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

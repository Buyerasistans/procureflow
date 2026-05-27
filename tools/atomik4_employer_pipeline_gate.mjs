// Gate: PHASE 5 / Atomik-4 — Employer application pipeline viewer
// Assertions: A(3) + B(4) + C(3) + D(1) + E(1) + F(3) = 15 total
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://127.0.0.1:5175";
const ARTIFACTS_DIR = path.join(__dirname, "gate-artifacts", "atomik4-employer-pipeline");

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

const VIEWPORTS = [
  { w: 360, h: 812, label: "360" },
  { w: 768, h: 1024, label: "768" },
  { w: 1280, h: 800, label: "1280" },
];

const EMPLOYER_USER = {
  id: 9001,
  email: "employer@test.local",
  full_name: "Test Employer",
  role: "user",
  business_role: "user",
  system_role: "employer_company_admin",
};

const CANDIDATE_USER = {
  id: 9002,
  email: "candidate@test.local",
  full_name: "Test Candidate",
  role: "user",
  business_role: "user",
  system_role: "candidate_user",
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
  view_count: 100,
  application_count: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_APP_1 = {
  id: 101,
  job_id: 42,
  applicant_user_id: 9002,
  talent_profile_id: 1001,
  cover_letter: null,
  status: "applied",
  ai_match_score: null,
  employer_note: null,
  reviewed_by_user_id: null,
  reviewed_at: null,
  applied_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_APP_2 = {
  id: 102,
  job_id: 42,
  applicant_user_id: 9003,
  talent_profile_id: 1002,
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
const MOCK_APPLICATIONS_JSON = JSON.stringify([MOCK_APP_1, MOCK_APP_2]);
const REFRESH_JSON = JSON.stringify({ access_token: "mock-token-atomik4", refresh_token: "mock-refresh-atomik4" });

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

// patchAppStatus: if set, PATCH /applications/* returns MOCK_APP_1 with this status
async function makeContext(browser, viewport, user, patchAppStatus) {
  const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().includes("[HTTP]")) {
      console.log(`  [page:${msg.type()}] ${msg.text().substring(0, 100)}`);
    }
  });

  const userJson = JSON.stringify(user);
  await page.addInitScript((u) => {
    sessionStorage.setItem("pf_access_token", "mock-token-atomik4");
    sessionStorage.setItem("pf_user", u);
  }, userJson);

  // LIFO: catch-all first = lowest priority
  await page.route(
    (url) => url.href.includes("localhost:8000") || url.href.includes("127.0.0.1:8000"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  // /jobs base route — GET list (lower priority than applications route)
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

  // /jobs/42/applications — registered after /jobs so higher LIFO priority
  await page.route(
    (url) => url.href.includes("/api/v1/jobs/42/applications"),
    (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: MOCK_APPLICATIONS_JSON });
    }
  );

  // /applications/ — PATCH status update
  await page.route(
    (url) => url.href.includes("/api/v1/applications/"),
    (route) => {
      const method = route.request().method();
      if (method === "PATCH" && patchAppStatus) {
        const updated = JSON.stringify({ ...MOCK_APP_1, status: patchAppStatus });
        route.fulfill({ status: 200, contentType: "application/json", body: updated });
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
    throw new Error(`App layout header not found — auth failed? URL: ${page.url()}`);
  }
  await page.waitForSelector(".job-card", { timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Scenario A — employer + 3 viewports: 'Başvurular' toggle visible
// ---------------------------------------------------------------------------
async function runScenarioA(browser) {
  console.log("\n=== Scenario A: Employer — 'Başvurular' toggle visible (3 viewports) ===");
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await makeContext(browser, vp, EMPLOYER_USER, null);
    try {
      await navigateToJobs(page, `A-${vp.label}`);
      assert(
        await page.locator(".job-card__applications-toggle").isVisible(),
        `[${vp.label}] A1: 'Başvurular' toggle button visible`
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
// Scenario B — toggle open → 2 rows, badges, applicant info visible
// ---------------------------------------------------------------------------
async function runScenarioB(browser) {
  console.log("\n=== Scenario B: Toggle open → applications list renders ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, EMPLOYER_USER, null);
  try {
    await navigateToJobs(page, "B");
    await page.locator(".job-card__applications-toggle").click();
    await page.waitForSelector(".application-row", { timeout: 5000 });

    assert(
      (await page.locator(".application-row").count()) === 2,
      `[1280] B1: 2 application rows visible`
    );

    const badge1 = await page.locator(".application-row").first().locator(".application-status-badge").textContent();
    assert(badge1 === "applied", `[1280] B2: First row status badge is 'applied'`);

    const badge2 = await page.locator(".application-row").nth(1).locator(".application-status-badge").textContent();
    assert(badge2 === "shortlisted", `[1280] B3: Second row status badge is 'shortlisted'`);

    assert(
      await page.locator(".application-row__applicant").first().isVisible(),
      `[1280] B4: Applicant info visible in first row`
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenB-open.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenB:`, err.message.split("\n")[0]);
    failed += 4;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-B.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario C — transition buttons correct per state machine
// ---------------------------------------------------------------------------
async function runScenarioC(browser) {
  console.log("\n=== Scenario C: Transition buttons per state machine ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, EMPLOYER_USER, null);
  try {
    await navigateToJobs(page, "C");
    await page.locator(".job-card__applications-toggle").click();
    await page.waitForSelector(".application-row", { timeout: 5000 });

    // applied row → advance (Listele) visible
    assert(
      await page.locator(".application-row").first().locator(".application-actions__btn--advance").first().isVisible(),
      `[1280] C1: Advance button visible in 'applied' row (Listele)`
    );
    // applied row → reject (Reddet) visible
    assert(
      await page.locator(".application-row").first().locator(".application-actions__btn--reject").isVisible(),
      `[1280] C2: Reject button visible in 'applied' row (Reddet)`
    );
    // shortlisted row → advance (Mülakata Al) visible
    assert(
      await page.locator(".application-row").nth(1).locator(".application-actions__btn--advance").first().isVisible(),
      `[1280] C3: Advance button visible in 'shortlisted' row (Mülakata Al)`
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenC-buttons.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenC:`, err.message.split("\n")[0]);
    failed += 3;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-C.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario D — click advance → PATCH mock → row badge updates
// ---------------------------------------------------------------------------
async function runScenarioD(browser) {
  console.log("\n=== Scenario D: Click advance → PATCH → badge updates ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, EMPLOYER_USER, "shortlisted");
  try {
    await navigateToJobs(page, "D");
    await page.locator(".job-card__applications-toggle").click();
    await page.waitForSelector(".application-row", { timeout: 5000 });

    await page.locator(".application-row").first().locator(".application-actions__btn--advance").first().click();

    await page.waitForFunction(
      () => document.querySelectorAll(".application-row")[0]
        ?.querySelector(".application-status-badge")?.textContent === "shortlisted",
      { timeout: 5000 }
    );

    const badge = await page.locator(".application-row").first().locator(".application-status-badge").textContent();
    assert(badge === "shortlisted", `[1280] D1: 'applied' row badge updated to 'shortlisted' after PATCH`);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenD-after-advance.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenD:`, err.message.split("\n")[0]);
    failed += 1;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-D.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario E — candidate session: no pipeline toggle (regression)
// ---------------------------------------------------------------------------
async function runScenarioE(browser) {
  console.log("\n=== Scenario E: Candidate — no pipeline toggle (regression) ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER, null);
  try {
    await navigateToJobs(page, "E");
    assert(
      (await page.locator(".job-card__applications-toggle").count()) === 0,
      `[1280] E1: No applications toggle for candidate_user`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenE-candidate.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenE:`, err.message.split("\n")[0]);
    failed += 1;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-E.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario F — 3 viewports: applications container no overflow
// ---------------------------------------------------------------------------
async function runScenarioF(browser) {
  console.log("\n=== Scenario F: Responsive overflow check — 360/768/1280 ===");
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await makeContext(browser, vp, EMPLOYER_USER, null);
    try {
      await navigateToJobs(page, `F-${vp.label}`);
      await page.locator(".job-card__applications-toggle").click();
      await page.waitForSelector(".job-card__applications", { timeout: 5000 });

      const box = await page.locator(".job-card__applications").boundingBox();
      assert(
        box !== null && box.x >= 0 && box.x + box.width <= vp.w + 2,
        `[${vp.label}] F1: applications container fits within ${vp.label}px`
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
  console.log("=== Atomik-4 Gate: Employer Application Pipeline ===");
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
    gate: "atomik4-employer-pipeline",
    timestamp: new Date().toISOString(),
    viewports: VIEWPORTS.map((v) => v.label),
    scenarios: {
      A: "employer toggle visible — 360/768/1280",
      B: "toggle open → rows + badges + applicant info",
      C: "transition buttons per state machine",
      D: "click advance → PATCH → badge updates",
      E: "candidate regression — no toggle",
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

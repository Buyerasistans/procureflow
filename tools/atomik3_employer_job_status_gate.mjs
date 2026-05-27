// Gate: PHASE 5 / Atomik-3 — Employer job status actions (close / fill)
// Assertions: A(9) + B(3) + C(3) + D(2) = 17 total
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://127.0.0.1:5175";
const ARTIFACTS_DIR = path.join(__dirname, "gate-artifacts", "atomik3-employer-job-status");

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
  title: "Yazılım Geliştirici",
  description: "Test pozisyonu için detaylı açıklama metni buraya gelir.",
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
const REFRESH_JSON = JSON.stringify({ access_token: "mock-token-atomik3", refresh_token: "mock-refresh-atomik3" });

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

// patchResponseStatus: if set, PATCH /jobs/* returns job with this status; else returns {}
async function makeContext(browser, viewport, user, patchResponseStatus) {
  const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().includes("[HTTP]")) {
      console.log(`  [page:${msg.type()}] ${msg.text().substring(0, 100)}`);
    }
  });

  const userJson = JSON.stringify(user);
  await page.addInitScript((u) => {
    sessionStorage.setItem("pf_access_token", "mock-token-atomik3");
    sessionStorage.setItem("pf_user", u);
  }, userJson);

  // LIFO: catch-all first = lowest priority
  await page.route(
    (url) => url.href.includes("localhost:8000") || url.href.includes("127.0.0.1:8000"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  // /jobs routes — GET returns list, PATCH returns updated job
  await page.route(
    (url) => url.href.includes("/api/v1/jobs"),
    (route) => {
      const method = route.request().method();
      if (method === "PATCH" && patchResponseStatus) {
        const updatedJob = JSON.stringify({ ...MOCK_JOB, status: patchResponseStatus });
        route.fulfill({ status: 200, contentType: "application/json", body: updatedJob });
      } else if (method === "GET") {
        route.fulfill({ status: 200, contentType: "application/json", body: MOCK_JOBS_JSON });
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
// Scenario A — employer + 3 viewports: status action buttons visible + no overflow
// ---------------------------------------------------------------------------
async function runScenarioA(browser) {
  console.log("\n=== Scenario A: Employer status buttons — 3 viewports ===");
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await makeContext(browser, vp, EMPLOYER_USER, null);
    try {
      await navigateToJobs(page, `A-${vp.label}`);

      // A1: "Kapat" button visible
      assert(
        await page.locator(".jobs-page__btn--status-close").isVisible(),
        `[${vp.label}] A1: 'Kapat' button visible`
      );

      // A2: "Dolu İşaretle" button visible
      assert(
        await page.locator(".jobs-page__btn--status-fill").isVisible(),
        `[${vp.label}] A2: 'Dolu İşaretle' button visible`
      );

      // A3: status-actions container within viewport width
      const actionsBox = await page.locator(".job-card__status-actions").boundingBox();
      assert(
        actionsBox !== null && actionsBox.x >= 0 && actionsBox.x + actionsBox.width <= vp.w + 2,
        `[${vp.label}] A3: status-actions fits within ${vp.label}px`
      );

      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenA-${vp.label}.png`) });
    } catch (err) {
      console.error(`  [${vp.label}] EXCEPTION ScenA:`, err.message.split("\n")[0]);
      failed += 3;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-A-${vp.label}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Scenario B — employer clicks "Kapat" → job badge becomes "closed", buttons gone
// ---------------------------------------------------------------------------
async function runScenarioB(browser) {
  console.log("\n=== Scenario B: 'Kapat' → badge closed, buttons removed ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, EMPLOYER_USER, "closed");
  try {
    await navigateToJobs(page, "B");

    await page.locator(".jobs-page__btn--status-close").click();

    // Wait for state update: first badge changes from "published" to "closed"
    await page.waitForFunction(
      () => document.querySelector(".job-card__badge")?.textContent === "closed",
      { timeout: 5000 }
    );

    // B1: Badge text is "closed"
    const badgeText = await page.locator(".job-card__badge").first().textContent();
    assert(badgeText === "closed", `[1280] B1: Status badge updated to 'closed'`);

    // B2 + B3: Status action buttons gone (job no longer published)
    assert(
      await page.locator(".jobs-page__btn--status-close").count() === 0,
      `[1280] B2: 'Kapat' button gone after close`
    );
    assert(
      await page.locator(".jobs-page__btn--status-fill").count() === 0,
      `[1280] B3: 'Dolu İşaretle' button gone after close`
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenB-after-close.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenB:`, err.message.split("\n")[0]);
    failed += 3;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-B.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario C — employer clicks "Dolu İşaretle" → badge becomes "filled", buttons gone
// ---------------------------------------------------------------------------
async function runScenarioC(browser) {
  console.log("\n=== Scenario C: 'Dolu İşaretle' → badge filled, buttons removed ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, EMPLOYER_USER, "filled");
  try {
    await navigateToJobs(page, "C");

    await page.locator(".jobs-page__btn--status-fill").click();

    await page.waitForFunction(
      () => document.querySelector(".job-card__badge")?.textContent === "filled",
      { timeout: 5000 }
    );

    // C1: Badge text is "filled"
    const badgeText = await page.locator(".job-card__badge").first().textContent();
    assert(badgeText === "filled", `[1280] C1: Status badge updated to 'filled'`);

    // C2 + C3: Status action buttons gone
    assert(
      await page.locator(".jobs-page__btn--status-close").count() === 0,
      `[1280] C2: 'Kapat' button gone after fill`
    );
    assert(
      await page.locator(".jobs-page__btn--status-fill").count() === 0,
      `[1280] C3: 'Dolu İşaretle' button gone after fill`
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenC-after-fill.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenC:`, err.message.split("\n")[0]);
    failed += 3;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-C.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario D — candidate session: no status buttons, "Başvur" intact (regression)
// ---------------------------------------------------------------------------
async function runScenarioD(browser) {
  console.log("\n=== Scenario D: Candidate — no status buttons, apply button intact ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeContext(browser, vp, CANDIDATE_USER, null);
  try {
    await navigateToJobs(page, "D");

    // D1: No status action section for candidate
    assert(
      await page.locator(".job-card__status-actions").count() === 0,
      `[1280] D1: No status-actions for candidate_user`
    );

    // D2: "Başvur" button IS visible (apply flow intact)
    assert(
      await page.locator(".job-card .jobs-page__btn--primary").isVisible(),
      `[1280] D2: 'Başvur' button visible for candidate_user`
    );

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenD-candidate.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenD:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-D.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Atomik-3 Gate: Employer Job Status Actions ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Artifacts: ${ARTIFACTS_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    await runScenarioA(browser);
    await runScenarioB(browser);
    await runScenarioC(browser);
    await runScenarioD(browser);
  } finally {
    await browser.close();
  }

  const total = passed + failed;
  console.log(`\n=== GATE RESULT: ${passed}/${total} PASS ===`);

  const report = {
    gate: "atomik3-employer-job-status",
    timestamp: new Date().toISOString(),
    viewports: VIEWPORTS.map((v) => v.label),
    scenarios: {
      A: "employer status buttons visible + no overflow — 360/768/1280",
      B: "click Kapat → badge closed, buttons gone",
      C: "click Dolu Isaretle → badge filled, buttons gone",
      D: "candidate regression — no status buttons, apply intact",
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

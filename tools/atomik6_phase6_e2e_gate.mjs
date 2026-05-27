// Gate: PHASE 6 / Atomik-6 — Full Phase 6 E2E Gate
// Assertions: A(3) + B(1) + C(2) + D(2) + E(2) + F(2) + G(2) + H(2) + I(3) = 19 total
// A: /jobs/42 shell renders (title + desc + badge) — candidate
// B: candidate apply CTA visible on detail page
// C: candidate TALENT_PROFILE_REQUIRED + /talent/profile link on detail page
// D: employer Kapat/Dolu İşaretle visible on detail page
// E: employer Kapat click → badge closed on detail page
// F: job card title link → /jobs/42 navigation
// G: candidate history İlan #id link → /jobs/42 navigation
// H: regression — role isolation on detail page
// I: responsive — .job-detail fits 360/768/1280
// PREREQUISITE: dev server running at http://127.0.0.1:5175 (cd web && npm run dev)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://127.0.0.1:5175";
const ARTIFACTS_DIR = path.join(__dirname, "gate-artifacts", "atomik6-phase6-full");

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

const MOCK_MY_APP = {
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

const MOCK_TOKEN = "mock-token-atomik6";
const REFRESH_JSON = JSON.stringify({ access_token: MOCK_TOKEN, refresh_token: "mock-refresh-atomik6" });
const JOBS_JSON = JSON.stringify({ total: 1, page: 1, size: 20, items: [MOCK_JOB] });
const MOCK_JOB_JSON = JSON.stringify(MOCK_JOB);

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

// ---------------------------------------------------------------------------
// Context factories
// LIFO rule: catch-all registered first (lowest priority);
//            specific routes registered last (highest priority).
// ---------------------------------------------------------------------------

async function makeCandidateContext(browser, vp, { applyError = false, myApps = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().includes("[HTTP]")) {
      console.log(`  [page:${msg.type()}] ${msg.text().substring(0, 120)}`);
    }
  });

  const userJson = JSON.stringify(CANDIDATE_USER);
  await page.addInitScript((u) => {
    sessionStorage.setItem("pf_access_token", "mock-token-atomik6");
    sessionStorage.setItem("pf_user", u);
  }, userJson);

  // 1. catch-all — lowest priority (first registered)
  await page.route(
    (url) => url.href.includes("localhost:8000") || url.href.includes("127.0.0.1:8000"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  // 2. /api/v1/jobs — list mock (also matches /api/v1/jobs/42, overridden by specific below)
  await page.route(
    (url) => url.href.includes("/api/v1/jobs"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JOBS_JSON })
  );

  // 3. /api/v1/my/applications — always register, prevents {}.map() crash on list page
  await page.route(
    (url) => url.href.includes("/api/v1/my/applications"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(myApps ?? []) })
  );

  // 4. /api/v1/jobs/42 specific GET — LIFO: wins over list mock for detail page
  //    excludes /apply so the apply mock below handles POST /apply
  await page.route(
    (url) => url.href.includes("/api/v1/jobs/42") && !url.href.includes("/apply"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: MOCK_JOB_JSON })
  );

  // 5. /api/v1/jobs/*/apply — POST apply (conditional; LIFO: wins over job/42 for /apply URLs)
  if (applyError) {
    await page.route(
      (url) => url.href.includes("/api/v1/jobs/") && url.href.includes("/apply"),
      (route) => {
        if (route.request().method() === "POST") {
          route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({ detail: { code: "TALENT_PROFILE_REQUIRED", message: "Talent profili gerekli" } }),
          });
        } else {
          route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
        }
      }
    );
  }

  // 6. /auth/refresh
  await page.route(
    (url) => url.href.includes("/auth/refresh"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: REFRESH_JSON })
  );

  // 7. /auth/me — highest priority (last registered)
  await page.route(
    (url) => url.href.includes("/auth/me"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: userJson })
  );

  return { ctx, page };
}

async function makeEmployerContext(browser, vp, { jobPatchStatus = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().includes("[HTTP]")) {
      console.log(`  [page:${msg.type()}] ${msg.text().substring(0, 120)}`);
    }
  });

  const userJson = JSON.stringify(EMPLOYER_USER);
  await page.addInitScript((u) => {
    sessionStorage.setItem("pf_access_token", "mock-token-atomik6");
    sessionStorage.setItem("pf_user", u);
  }, userJson);

  // 1. catch-all — lowest priority
  await page.route(
    (url) => url.href.includes("localhost:8000") || url.href.includes("127.0.0.1:8000"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  // 2. /api/v1/jobs — list mock (overridden for /api/v1/jobs/42 below via LIFO)
  await page.route(
    (url) => url.href.includes("/api/v1/jobs"),
    (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({ status: 200, contentType: "application/json", body: JOBS_JSON });
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
    }
  );

  // 3. /api/v1/jobs/*/applications — employer pipeline (list page pipeline toggle)
  await page.route(
    (url) => url.href.includes("/api/v1/jobs/") && url.href.includes("/applications"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // 4. /api/v1/jobs/42 specific GET + PATCH — LIFO: wins over list mock
  //    excludes /applications so pipeline mock above handles those
  await page.route(
    (url) => url.href.includes("/api/v1/jobs/42") && !url.href.includes("/applications"),
    (route) => {
      const method = route.request().method();
      if (method === "PATCH" && jobPatchStatus) {
        const updated = { ...MOCK_JOB, status: jobPatchStatus };
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(updated) });
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: MOCK_JOB_JSON });
      }
    }
  );

  // 5. /auth/refresh
  await page.route(
    (url) => url.href.includes("/auth/refresh"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: REFRESH_JSON })
  );

  // 6. /auth/me — highest priority (last registered)
  await page.route(
    (url) => url.href.includes("/auth/me"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: userJson })
  );

  return { ctx, page };
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function navigateToJobs(page, suffix) {
  await page.goto(`${BASE_URL}/jobs`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector(".app-layout__header", { timeout: 12000 });
  } catch {
    await page
      .screenshot({ path: path.join(ARTIFACTS_DIR, `debug-noheader-${suffix}.png`), fullPage: true })
      .catch(() => {});
    throw new Error(`App layout header not found at /jobs — URL: ${page.url()}`);
  }
  await page.waitForSelector(".job-card", { timeout: 8000 });
}

async function navigateToJobDetail(page, suffix) {
  await page.goto(`${BASE_URL}/jobs/42`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector(".app-layout__header", { timeout: 12000 });
  } catch {
    await page
      .screenshot({ path: path.join(ARTIFACTS_DIR, `debug-noheader-${suffix}.png`), fullPage: true })
      .catch(() => {});
    throw new Error(`App layout header not found at /jobs/42 — URL: ${page.url()}`);
  }
  await page.waitForSelector(".job-detail", { timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Scenario A — /jobs/42 shell renders: title + desc + badge (3)
// ---------------------------------------------------------------------------
async function runScenarioA(browser) {
  console.log("\n=== Scenario A: /jobs/42 detail shell renders — candidate context ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeCandidateContext(browser, vp);
  try {
    await navigateToJobDetail(page, "A");
    assert(
      await page.locator(".job-detail__title").isVisible(),
      `[1280] A1: .job-detail__title visible`
    );
    assert(
      await page.locator(".job-detail__desc").isVisible(),
      `[1280] A2: .job-detail__desc visible`
    );
    const badgeCount = await page.locator(".job-detail__badge").count();
    assert(badgeCount >= 1, `[1280] A3: at least 1 .job-detail__badge visible (got ${badgeCount})`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scenA-detail-shell.png") });
  } catch (err) {
    console.error(`  EXCEPTION ScenA:`, err.message.split("\n")[0]);
    failed += 3;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-A.png") }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario B — candidate apply CTA visible on published detail page (1)
// ---------------------------------------------------------------------------
async function runScenarioB(browser) {
  console.log("\n=== Scenario B: candidate apply CTA visible on /jobs/42 ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeCandidateContext(browser, vp);
  try {
    await navigateToJobDetail(page, "B");
    assert(
      await page.locator(".job-detail__apply").isVisible(),
      `[1280] B1: .job-detail__apply section visible for candidate (published job)`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scenB-candidate-apply.png") });
  } catch (err) {
    console.error(`  EXCEPTION ScenB:`, err.message.split("\n")[0]);
    failed += 1;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-B.png") }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario C — candidate apply TALENT_PROFILE_REQUIRED + /talent/profile link (2)
// ---------------------------------------------------------------------------
async function runScenarioC(browser) {
  console.log("\n=== Scenario C: candidate TALENT_PROFILE_REQUIRED on /jobs/42 apply ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeCandidateContext(browser, vp, { applyError: true });
  try {
    await navigateToJobDetail(page, "C");
    await page.locator(".job-detail__apply-btn--primary").click();
    await page.waitForSelector(".job-detail__apply-error", { timeout: 5000 });
    assert(
      await page.locator(".job-detail__apply-error").isVisible(),
      `[1280] C1: .job-detail__apply-error visible after TALENT_PROFILE_REQUIRED`
    );
    const linkHref = (await page.locator(".job-detail__apply-error-link").getAttribute("href")) ?? "";
    assert(
      linkHref.includes("/talent/profile"),
      `[1280] C2: /talent/profile link in error (href="${linkHref}")`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scenC-talent-profile-required.png") });
  } catch (err) {
    console.error(`  EXCEPTION ScenC:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-C.png") }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario D — employer Kapat + Dolu İşaretle visible on detail page (2)
// ---------------------------------------------------------------------------
async function runScenarioD(browser) {
  console.log("\n=== Scenario D: employer actions visible on /jobs/42 ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeEmployerContext(browser, vp);
  try {
    await navigateToJobDetail(page, "D");
    assert(
      await page.locator(".job-detail__action-btn--close").isVisible(),
      `[1280] D1: .job-detail__action-btn--close (Kapat) visible for employer`
    );
    assert(
      await page.locator(".job-detail__action-btn--fill").isVisible(),
      `[1280] D2: .job-detail__action-btn--fill (Dolu Isaretle) visible for employer`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scenD-employer-actions.png") });
  } catch (err) {
    console.error(`  EXCEPTION ScenD:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-D.png") }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario E — employer Kapat click → badge updates to closed (2)
// ---------------------------------------------------------------------------
async function runScenarioE(browser) {
  console.log("\n=== Scenario E: employer Kapat click -> badge closed on /jobs/42 ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeEmployerContext(browser, vp, { jobPatchStatus: "closed" });
  try {
    await navigateToJobDetail(page, "E");
    assert(
      await page.locator(".job-detail__action-btn--close").isVisible(),
      `[1280] E1: Kapat button visible before click`
    );
    await page.locator(".job-detail__action-btn--close").click();
    await page.waitForFunction(
      () => document.querySelector(".job-detail__badge--closed") !== null,
      { timeout: 5000 }
    );
    assert(
      (await page.locator(".job-detail__badge--closed").count()) > 0,
      `[1280] E2: .job-detail__badge--closed visible after Kapat click`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scenE-kapat.png") });
  } catch (err) {
    console.error(`  EXCEPTION ScenE:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-E.png") }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario F — job card title is a link → navigates to /jobs/42 (2)
// ---------------------------------------------------------------------------
async function runScenarioF(browser) {
  console.log("\n=== Scenario F: job card title link -> /jobs/42 navigation ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeCandidateContext(browser, vp);
  try {
    await navigateToJobs(page, "F");
    const titleHref = (await page.locator(".job-card__title").getAttribute("href")) ?? "";
    assert(
      titleHref.includes("/jobs/42"),
      `[1280] F1: .job-card__title href contains '/jobs/42' (got "${titleHref}")`
    );
    await page.locator(".job-card__title").click();
    await page.waitForSelector(".job-detail", { timeout: 8000 });
    assert(
      page.url().includes("/jobs/42"),
      `[1280] F2: URL is /jobs/42 after card title click (got "${page.url()}")`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scenF-title-link.png") });
  } catch (err) {
    console.error(`  EXCEPTION ScenF:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-F.png") }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario G — candidate history İlan #id link → navigates to /jobs/42 (2)
// ---------------------------------------------------------------------------
async function runScenarioG(browser) {
  console.log("\n=== Scenario G: candidate history link -> /jobs/42 navigation ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeCandidateContext(browser, vp, { myApps: [MOCK_MY_APP] });
  try {
    await navigateToJobs(page, "G");
    await page.waitForSelector(".my-application-row__job", { timeout: 6000 });
    const jobLinkHref = (await page.locator(".my-application-row__job").first().getAttribute("href")) ?? "";
    assert(
      jobLinkHref.includes("/jobs/42"),
      `[1280] G1: .my-application-row__job href contains '/jobs/42' (got "${jobLinkHref}")`
    );
    await page.locator(".my-application-row__job").first().click();
    await page.waitForSelector(".job-detail", { timeout: 8000 });
    assert(
      page.url().includes("/jobs/42"),
      `[1280] G2: URL is /jobs/42 after history link click (got "${page.url()}")`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scenG-history-link.png") });
  } catch (err) {
    console.error(`  EXCEPTION ScenG:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-G.png") }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario H — regression: role isolation on detail page (2)
// ---------------------------------------------------------------------------
async function runScenarioH(browser) {
  console.log("\n=== Scenario H: Regression — role isolation on /jobs/42 ===");
  const vp = { w: 1280, h: 800, label: "1280" };

  // H1: candidate sees no employer actions
  {
    const { ctx, page } = await makeCandidateContext(browser, vp);
    try {
      await navigateToJobDetail(page, "H1");
      assert(
        (await page.locator(".job-detail__actions").count()) === 0,
        `[1280] H1: candidate on /jobs/42 sees no employer actions block`
      );
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scenH1-candidate-no-employer.png") });
    } catch (err) {
      console.error(`  EXCEPTION ScenH1:`, err.message.split("\n")[0]);
      failed += 1;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-H1.png") }).catch(() => {});
    }
    await ctx.close();
  }

  // H2: employer sees no candidate apply section
  {
    const { ctx, page } = await makeEmployerContext(browser, vp);
    try {
      await navigateToJobDetail(page, "H2");
      assert(
        (await page.locator(".job-detail__apply").count()) === 0,
        `[1280] H2: employer on /jobs/42 sees no candidate apply section`
      );
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "scenH2-employer-no-apply.png") });
    } catch (err) {
      console.error(`  EXCEPTION ScenH2:`, err.message.split("\n")[0]);
      failed += 1;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "exception-H2.png") }).catch(() => {});
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Scenario I — responsive: .job-detail fits within viewport (3)
// ---------------------------------------------------------------------------
async function runScenarioI(browser) {
  console.log("\n=== Scenario I: Responsive — .job-detail fits 360/768/1280 ===");
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await makeCandidateContext(browser, vp);
    try {
      await navigateToJobDetail(page, `I-${vp.label}`);
      const box = await page.locator(".job-detail").boundingBox();
      assert(
        box !== null && box.x >= 0 && box.x + box.width <= vp.w + 2,
        `[${vp.label}] I: .job-detail fits within ${vp.label}px (width=${box?.width?.toFixed(0) ?? "N/A"})`
      );
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenI-${vp.label}.png`) });
    } catch (err) {
      console.error(`  [${vp.label}] EXCEPTION ScenI:`, err.message.split("\n")[0]);
      failed += 1;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-I-${vp.label}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Atomik-6 Gate: Phase 6 Full E2E Gate ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Artifacts: ${ARTIFACTS_DIR}`);
  console.log("PREREQUISITE: cd web && npm run dev (port 5175)\n");

  const browser = await chromium.launch({ headless: true });
  try {
    await runScenarioA(browser);
    await runScenarioB(browser);
    await runScenarioC(browser);
    await runScenarioD(browser);
    await runScenarioE(browser);
    await runScenarioF(browser);
    await runScenarioG(browser);
    await runScenarioH(browser);
    await runScenarioI(browser);
  } finally {
    await browser.close();
  }

  const total = passed + failed;
  console.log(`\n=== GATE RESULT: ${passed}/${total} PASS ===`);

  const report = {
    gate: "atomik6-phase6-full",
    timestamp: new Date().toISOString(),
    viewports: VIEWPORTS.map((v) => v.label),
    scenarios: {
      A: "/jobs/42 shell renders (title + desc + badge) — candidate",
      B: "candidate apply CTA visible on detail page",
      C: "candidate TALENT_PROFILE_REQUIRED + /talent/profile link on detail page",
      D: "employer Kapat/Dolu Isaretle visible on detail page",
      E: "employer Kapat click -> badge closed on detail page",
      F: "job card title link -> /jobs/42 navigation",
      G: "candidate history Ilan#id link -> /jobs/42 navigation",
      H: "regression: role isolation on detail page",
      I: "responsive: .job-detail fits 360/768/1280",
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

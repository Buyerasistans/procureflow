// Gate: PHASE 5 / Atomik-8 — Full Phase 5 E2E Gate
// Assertions: A(2) + B(2) + C(3) + D(2) + E(2) + F(2) + G(3) = 16 total
// G1: TALENT_PROFILE_REQUIRED link (A)
// G2: employer Kapat → badge closed (B)
// G3: pipeline toggle + rows + advance (C)
// G4: candidate Başvurularım section + rows (D)
// G5: Geri Çek visible + click → badge withdrawn (E)
// Regression: role isolation (F)
// Responsive: overflow check 360/768/1280 (G)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://127.0.0.1:5175";
const ARTIFACTS_DIR = path.join(__dirname, "gate-artifacts", "atomik8-phase5-full");

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

// Employer pipeline application
const MOCK_APP_APPLIED = {
  id: 301,
  job_id: 42,
  applicant_user_id: 9002,
  talent_profile_id: null,
  cover_letter: null,
  status: "applied",
  ai_match_score: null,
  employer_note: null,
  reviewed_by_user_id: null,
  reviewed_at: null,
  applied_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Candidate own applications
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
const MOCK_MY_APP_WITHDRAWN = { ...MOCK_MY_APP_APPLIED, id: 202, job_id: 43, status: "withdrawn" };
const MOCK_MY_APP_REJECTED = { ...MOCK_MY_APP_APPLIED, id: 203, job_id: 44, status: "rejected" };

const MOCK_TOKEN = "mock-token-atomik8";
const REFRESH_JSON = JSON.stringify({ access_token: MOCK_TOKEN, refresh_token: "mock-refresh-atomik8" });
const JOBS_JSON = JSON.stringify({ total: 1, page: 1, size: 20, items: [MOCK_JOB] });
const PIPELINE_JSON = JSON.stringify([MOCK_APP_APPLIED]);

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
// ---------------------------------------------------------------------------

async function makeEmployerContext(browser, vp, { jobPatchStatus = null, appPatchStatus = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().includes("[HTTP]")) {
      console.log(`  [page:${msg.type()}] ${msg.text().substring(0, 120)}`);
    }
  });

  const userJson = JSON.stringify(EMPLOYER_USER);
  await page.addInitScript((u) => {
    sessionStorage.setItem("pf_access_token", "mock-token-atomik8");
    sessionStorage.setItem("pf_user", u);
  }, userJson);

  // LIFO: catch-all first = lowest priority
  await page.route(
    (url) => url.href.includes("localhost:8000") || url.href.includes("127.0.0.1:8000"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  // /api/v1/jobs — GET list + optional PATCH status
  await page.route(
    (url) => url.href.includes("/api/v1/jobs"),
    (route) => {
      const method = route.request().method();
      if (method === "GET") {
        route.fulfill({ status: 200, contentType: "application/json", body: JOBS_JSON });
      } else if (method === "PATCH" && jobPatchStatus) {
        const updated = { ...MOCK_JOB, status: jobPatchStatus };
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(updated) });
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
    }
  );

  // /api/v1/jobs/*/applications — GET employer pipeline (registered after /api/v1/jobs → wins for these URLs)
  await page.route(
    (url) => url.href.includes("/api/v1/jobs/") && url.href.includes("/applications"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: PIPELINE_JSON })
  );

  // /api/v1/applications/*/status — PATCH application status (conditional)
  if (appPatchStatus) {
    await page.route(
      (url) => url.href.includes("/api/v1/applications/") && url.href.includes("/status"),
      (route) => {
        const updated = { ...MOCK_APP_APPLIED, status: appPatchStatus };
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(updated) });
      }
    );
  }

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

async function makeCandidateContext(browser, vp, { applyError = false, myApps = null, withdrawResponse = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.text().includes("[HTTP]")) {
      console.log(`  [page:${msg.type()}] ${msg.text().substring(0, 120)}`);
    }
  });

  const userJson = JSON.stringify(CANDIDATE_USER);
  await page.addInitScript((u) => {
    sessionStorage.setItem("pf_access_token", "mock-token-atomik8");
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
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JOBS_JSON })
  );

  // /api/v1/jobs/*/apply — POST 422 (conditional; registered after /api/v1/jobs → wins for /apply URLs)
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

  // /api/v1/my/applications — GET candidate own apps (always registered; defaults to [] when not provided)
  await page.route(
    (url) => url.href.includes("/api/v1/my/applications"),
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(myApps ?? []) })
  );

  // /api/v1/applications/*/withdraw — POST (conditional)
  if (withdrawResponse !== null) {
    await page.route(
      (url) => url.href.includes("/api/v1/applications/") && url.href.includes("/withdraw"),
      (route) => {
        if (route.request().method() === "POST") {
          route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(withdrawResponse) });
        } else {
          route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
        }
      }
    );
  }

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
    await page
      .screenshot({ path: path.join(ARTIFACTS_DIR, `debug-noheader-${screenshotSuffix}.png`), fullPage: true })
      .catch(() => {});
    throw new Error(`App layout header not found — URL: ${page.url()}`);
  }
  await page.waitForSelector(".job-card", { timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Scenario A — G1: TALENT_PROFILE_REQUIRED error + /talent/profile link (2)
// ---------------------------------------------------------------------------
async function runScenarioA(browser) {
  console.log("\n=== Scenario A: G1 — TALENT_PROFILE_REQUIRED error + /talent/profile link ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeCandidateContext(browser, vp, { applyError: true });
  try {
    await navigateToJobs(page, "A");
    // Open ApplyForm by clicking Başvur on the job card
    await page.locator(".jobs-page__btn--primary").first().click();
    await page.waitForSelector(".apply-form", { timeout: 5000 });
    // Submit form → triggers POST /apply → 422 TALENT_PROFILE_REQUIRED
    await page.locator(".apply-form button[type='submit']").click();
    await page.waitForSelector(".apply-form .jobs-page__error", { timeout: 5000 });

    assert(
      await page.locator(".apply-form .jobs-page__error").isVisible(),
      `[1280] A1: TALENT_PROFILE_REQUIRED error message visible in apply form`
    );
    const linkHref = (await page.locator(".jobs-page__error-link").getAttribute("href")) ?? "";
    assert(
      linkHref.includes("/talent/profile"),
      `[1280] A2: '/talent/profile' link visible in error (href="${linkHref}")`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenA-apply-error.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenA:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-A.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario B — G2: employer Kapat → badge "closed" (2)
// ---------------------------------------------------------------------------
async function runScenarioB(browser) {
  console.log("\n=== Scenario B: G2 — employer Kapat -> badge closed ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeEmployerContext(browser, vp, { jobPatchStatus: "closed" });
  try {
    await navigateToJobs(page, "B");
    assert(
      await page.locator(".jobs-page__btn--status-close").isVisible(),
      `[1280] B1: 'Kapat' button visible on published job`
    );
    await page.locator(".jobs-page__btn--status-close").click();
    // Wait for optimistic update: job status badge changes to closed
    await page.waitForFunction(
      () => document.querySelector(".job-card__badge--closed") !== null,
      { timeout: 5000 }
    );
    assert(
      (await page.locator(".job-card__badge--closed").count()) > 0,
      `[1280] B2: Job badge updated to 'closed' after Kapat`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenB-kapat.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenB:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-B.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario C — G3: pipeline toggle + rows + advance → "shortlisted" (3)
// ---------------------------------------------------------------------------
async function runScenarioC(browser) {
  console.log("\n=== Scenario C: G3 — pipeline toggle + rows + advance shortlisted ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const { ctx, page } = await makeEmployerContext(browser, vp, { appPatchStatus: "shortlisted" });
  try {
    await navigateToJobs(page, "C");
    // Click pipeline toggle
    await page.locator(".job-card__applications-toggle").click();
    await page.waitForSelector(".job-card__applications", { timeout: 6000 });
    assert(
      await page.locator(".job-card__applications").isVisible(),
      `[1280] C1: Pipeline panel visible after toggle`
    );
    await page.waitForSelector(".application-row", { timeout: 5000 });
    assert(
      (await page.locator(".application-row").count()) >= 1,
      `[1280] C2: At least 1 application row in pipeline`
    );
    // Advance to shortlisted
    await page.locator(".application-actions__btn--advance").first().click();
    await page.waitForFunction(
      () => document.querySelector(".application-status-badge--shortlisted") !== null,
      { timeout: 5000 }
    );
    assert(
      (await page.locator(".application-status-badge--shortlisted").count()) > 0,
      `[1280] C3: Application badge updated to 'shortlisted' after advance`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenC-pipeline.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenC:`, err.message.split("\n")[0]);
    failed += 3;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-C.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario D — G4: "Başvurularım" section + rows (2)
// ---------------------------------------------------------------------------
async function runScenarioD(browser) {
  console.log("\n=== Scenario D: G4 — candidate 'Basvurularım' section + 3 rows ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const myApps = [MOCK_MY_APP_APPLIED, MOCK_MY_APP_WITHDRAWN, MOCK_MY_APP_REJECTED];
  const { ctx, page } = await makeCandidateContext(browser, vp, { myApps });
  try {
    await navigateToJobs(page, "D");
    await page.waitForSelector(".jobs-page__my-applications", { timeout: 6000 });
    assert(
      await page.locator(".jobs-page__my-applications").isVisible(),
      `[1280] D1: 'Basvurularım' section visible for candidate`
    );
    await page.waitForSelector(".my-application-row", { timeout: 5000 });
    const rowCount = await page.locator(".my-application-row").count();
    assert(rowCount === 3, `[1280] D2: 3 application rows rendered (got ${rowCount})`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenD-my-applications.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenD:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-D.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario E — G5: "Geri Çek" visible + click → badge "withdrawn" (2)
// ---------------------------------------------------------------------------
async function runScenarioE(browser) {
  console.log("\n=== Scenario E: G5 — 'Geri Cek' visible + click -> badge withdrawn ===");
  const vp = { w: 1280, h: 800, label: "1280" };
  const myApps = [MOCK_MY_APP_APPLIED];
  const withdrawResponse = { ...MOCK_MY_APP_APPLIED, status: "withdrawn" };
  const { ctx, page } = await makeCandidateContext(browser, vp, { myApps, withdrawResponse });
  try {
    await navigateToJobs(page, "E");
    await page.waitForSelector(".my-application-row__btn--withdraw", { timeout: 6000 });
    assert(
      await page.locator(".my-application-row__btn--withdraw").isVisible(),
      `[1280] E1: 'Geri Cek' button visible on applied row`
    );
    await page.locator(".my-application-row__btn--withdraw").click();
    // Wait for optimistic update: badge changes to "withdrawn"
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll(".my-application-row");
        if (!rows[0]) return false;
        const badge = rows[0].querySelector(".application-status-badge");
        return badge && badge.textContent === "withdrawn";
      },
      { timeout: 5000 }
    );
    assert(
      (await page.locator(".application-status-badge--withdrawn").count()) > 0,
      `[1280] E2: Badge updated to 'withdrawn' after Geri Cek click`
    );
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenE-withdraw.png`) });
  } catch (err) {
    console.error(`  EXCEPTION ScenE:`, err.message.split("\n")[0]);
    failed += 2;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-E.png`) }).catch(() => {});
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Scenario F — Regression: role isolation (2)
// ---------------------------------------------------------------------------
async function runScenarioF(browser) {
  console.log("\n=== Scenario F: Regression — employer no candidate section, candidate no pipeline toggle ===");
  const vp = { w: 1280, h: 800, label: "1280" };

  // F1: Employer sees no "Başvurularım"
  {
    const { ctx, page } = await makeEmployerContext(browser, vp);
    try {
      await navigateToJobs(page, "F1");
      assert(
        (await page.locator(".jobs-page__my-applications").count()) === 0,
        `[1280] F1: Employer sees no 'Basvurularım' section`
      );
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenF1-employer-no-candidate.png`) });
    } catch (err) {
      console.error(`  EXCEPTION ScenF1:`, err.message.split("\n")[0]);
      failed += 1;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-F1.png`) }).catch(() => {});
    }
    await ctx.close();
  }

  // F2: Candidate sees no pipeline toggle
  {
    const { ctx, page } = await makeCandidateContext(browser, vp, { myApps: [] });
    try {
      await navigateToJobs(page, "F2");
      assert(
        (await page.locator(".job-card__applications-toggle").count()) === 0,
        `[1280] F2: Candidate sees no pipeline toggle`
      );
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenF2-candidate-no-pipeline.png`) });
    } catch (err) {
      console.error(`  EXCEPTION ScenF2:`, err.message.split("\n")[0]);
      failed += 1;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-F2.png`) }).catch(() => {});
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Scenario G — Responsive: "Başvurularım" overflow check 360/768/1280 (3)
// ---------------------------------------------------------------------------
async function runScenarioG(browser) {
  console.log("\n=== Scenario G: Responsive — 'Basvurularım' fits 360/768/1280 ===");
  const myApps = [MOCK_MY_APP_APPLIED];
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await makeCandidateContext(browser, vp, { myApps });
    try {
      await navigateToJobs(page, `G-${vp.label}`);
      await page.waitForSelector(".jobs-page__my-applications", { timeout: 6000 });
      const box = await page.locator(".jobs-page__my-applications").boundingBox();
      assert(
        box !== null && box.x >= 0 && box.x + box.width <= vp.w + 2,
        `[${vp.label}] G1: 'Basvurularım' section fits within ${vp.label}px`
      );
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `scenG-${vp.label}.png`) });
    } catch (err) {
      console.error(`  [${vp.label}] EXCEPTION ScenG:`, err.message.split("\n")[0]);
      failed += 1;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, `exception-G-${vp.label}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Atomik-8 Gate: Phase 5 Full E2E Gate ===");
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
    await runScenarioG(browser);
  } finally {
    await browser.close();
  }

  const total = passed + failed;
  console.log(`\n=== GATE RESULT: ${passed}/${total} PASS ===`);

  const report = {
    gate: "atomik8-phase5-full",
    timestamp: new Date().toISOString(),
    viewports: VIEWPORTS.map((v) => v.label),
    scenarios: {
      A: "G1: TALENT_PROFILE_REQUIRED error + /talent/profile link",
      B: "G2: employer Kapat -> badge closed",
      C: "G3: pipeline toggle + rows + advance shortlisted",
      D: "G4: candidate Basvurularım section + 3 rows",
      E: "G5: Geri Cek visible + click -> badge withdrawn",
      F: "Regression: employer no candidate section, candidate no pipeline toggle",
      G: "Responsive: Basvurularım fits 360/768/1280",
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

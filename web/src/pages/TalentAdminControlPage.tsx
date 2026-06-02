import { useCallback, useEffect, useId, useState } from "react";
import {
  extractTalentAdminError,
  fetchAdminTalentProfiles,
  fetchPayoutSummary,
  updateTalentKycStatus,
  type AdminTalentProfile,
  type PaginatedAdminTalentProfiles,
  type PayoutSummary,
} from "../services/talent-admin.service";
import { PageHeader, Section, StatCard } from "./admin/AdminTabContent";
import "./TalentAdminControlPage.css";
import "./admin/networkHub.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KYC_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylı",
  rejected: "Reddedildi",
};

const KYC_CLASS: Record<string, string> = {
  pending: "kyc-badge--pending",
  approved: "kyc-badge--approved",
  rejected: "kyc-badge--rejected",
};

const KYC_FILTER_OPTIONS = [
  { value: "", label: "Tüm KYC" },
  { value: "pending", label: "Bekliyor" },
  { value: "approved", label: "Onaylı" },
  { value: "rejected", label: "Reddedildi" },
];

const AVAIL_LABEL: Record<string, string> = {
  full_time: "Tam zamanlı",
  part_time: "Yarı zamanlı",
  freelance: "Freelance",
  not_available: "Müsait değil",
};

function nhMoney(n: number) {
  return "₺" + Number(n || 0).toLocaleString("tr-TR");
}
function nhInitials(s: string) {
  return s.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}
function friendlyKycError(err: unknown): string {
  return extractTalentAdminError(err);
}

// ---------------------------------------------------------------------------
// Mock data — Jobs / Applications / Tasks / Payouts
// TODO(data): replace with real procurement_jobs + job_applications API
// ---------------------------------------------------------------------------

const NH_STAGES = [
  { key: "applied" as const,     label: "Başvurdu",   color: "#64748b" },
  { key: "shortlisted" as const, label: "Ön elemede", color: "#1d4ed8" },
  { key: "interview" as const,   label: "Mülakat",    color: "#7c3aed" },
  { key: "offered" as const,     label: "Teklif",     color: "#047857" },
] as const;
type AppStage = typeof NH_STAGES[number]["key"];

interface NhJob {
  id: string; title: string; employer: string;
  type: string; loc: string; apps: number;
  views: number; salary: string; deadline: string;
}
interface NhApp {
  id: number; name: string; job: string;
  exp: number; match: number; stage: AppStage;
}
interface NhTask {
  id: string; title: string; type: string; reward: number; subs: number;
}
interface NhPayout {
  id: string; name: string; amount: number;
  method: string; status: "pending" | "approved" | "paid";
}

// TODO(data): replace with real API
const MOCK_JOBS: NhJob[] = [
  { id: "J-21", title: "Kıdemli Satınalma Uzmanı",       employer: "Atlas Yapı",      type: "Tam zamanlı", loc: "Hibrit · İstanbul",  apps: 14, views: 412, salary: "₺75-95K",    deadline: "20.06.2026" },
  { id: "J-22", title: "Kategori Yöneticisi (Ambalaj)",  employer: "PizzaMax Gıda",   type: "Tam zamanlı", loc: "Yerinde · Kocaeli",  apps: 9,  views: 287, salary: "₺90-120K",   deadline: "30.06.2026" },
  { id: "J-23", title: "Tedarik Analisti (Freelance)",   employer: "Platform geneli", type: "Freelance",   loc: "Uzaktan",            apps: 21, views: 638, salary: "₺850/gün",   deadline: "15.07.2026" },
];
const MOCK_APPS_INIT: NhApp[] = [
  { id: 1, name: "Emre Şahin",   job: "J-21", exp: 8,  match: 92, stage: "interview"   },
  { id: 2, name: "Gül Aktaş",    job: "J-21", exp: 6,  match: 88, stage: "shortlisted" },
  { id: 3, name: "Tolga Bilen",  job: "J-21", exp: 11, match: 95, stage: "offered"     },
  { id: 4, name: "Sevgi Ün",     job: "J-22", exp: 4,  match: 79, stage: "applied"     },
  { id: 5, name: "Murat Çalış",  job: "J-22", exp: 7,  match: 84, stage: "shortlisted" },
  { id: 6, name: "Deniz Kaya",   job: "J-23", exp: 3,  match: 71, stage: "applied"     },
  { id: 7, name: "Aslı Tan",     job: "J-23", exp: 5,  match: 90, stage: "interview"   },
];
const MOCK_TASKS: NhTask[] = [
  { id: "T-7", title: "Ambalaj tedarikçisi keşfi — 5 firma", type: "supplier_discovery", reward: 750,  subs: 6  },
  { id: "T-8", title: "Lojistik partner referansı",           type: "partner_referral",   reward: 1500, subs: 2  },
  { id: "T-9", title: "RFQ zenginleştirme (kimya)",           type: "rfq_enrichment",     reward: 400,  subs: 11 },
];
const MOCK_PAYOUTS_INIT: NhPayout[] = [
  { id: "P-44", name: "Emre Şahin", amount: 3200, method: "IBAN ••4521", status: "pending"  },
  { id: "P-45", name: "Aslı Tan",   amount: 1800, method: "IBAN ••9087", status: "pending"  },
  { id: "P-46", name: "Deniz Kaya", amount: 950,  method: "IBAN ••3344", status: "approved" },
];

// ---------------------------------------------------------------------------
// TalentProfilesSection — real API (paginated list + KYC actions)
// ---------------------------------------------------------------------------

interface TalentProfileRowProps {
  profile: AdminTalentProfile;
  busy: boolean;
  onKyc: (id: number, status: "approved" | "rejected") => void;
}

function TalentProfileRow({ profile, busy, onKyc }: TalentProfileRowProps) {
  const currentKyc = profile.kyc_status;
  return (
    <tr>
      <td>
        <div className="nh-tname">
          <span className="nh-av sm">{nhInitials(`U${profile.user_id}`)}</span>
          <div>
            <b>user#{profile.user_id}</b>
            <span>
              {AVAIL_LABEL[profile.availability] ?? profile.availability}
              {profile.experience_years != null ? ` · ${profile.experience_years} yıl` : ""}
            </span>
          </div>
        </div>
      </td>
      <td className="nh-mono">{profile.reputation_score}</td>
      <td>
        <span className={`kyc-badge ${KYC_CLASS[currentKyc] ?? ""}`}>
          {KYC_LABELS[currentKyc] ?? currentKyc}
        </span>
      </td>
      <td>{profile.is_active ? "Aktif" : "Pasif"}</td>
      <td>
        <div className="nh-actrow">
          <button
            type="button"
            className="nh-act ok"
            disabled={busy || currentKyc === "approved"}
            onClick={() => onKyc(profile.id, "approved")}
            aria-label={`Talent profili #${profile.id} KYC onayla`}
          >
            Onayla
          </button>
          <button
            type="button"
            className="nh-act danger"
            disabled={busy || currentKyc === "rejected"}
            onClick={() => onKyc(profile.id, "rejected")}
            aria-label={`Talent profili #${profile.id} KYC reddet`}
          >
            Reddet
          </button>
        </div>
      </td>
    </tr>
  );
}

function TalentProfilesSection() {
  const [data, setData] = useState<PaginatedAdminTalentProfiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kycFilter, setKycFilter] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const kycFilterId = useId();
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchAdminTalentProfiles(page, PAGE_SIZE, kycFilter || undefined);
      setData(res);
    } catch (err) {
      setError(friendlyKycError(err));
    } finally {
      setLoading(false);
    }
  }, [page, kycFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleKyc = useCallback(
    async (profileId: number, kycStatus: "approved" | "rejected") => {
      setBusyId(profileId);
      setError("");
      try {
        await updateTalentKycStatus(profileId, { kyc_status: kycStatus });
        await load();
      } catch (err) {
        setError(friendlyKycError(err));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <Section title="Yetenek & KYC onay kuyruğu" sub="bağımsız satınalma uzmanları">
      <div className="talent-admin__filters">
        <label className="talent-admin__filter-label" htmlFor={kycFilterId}>
          KYC filtresi
        </label>
        <select
          id={kycFilterId}
          className="talent-admin__filter-select"
          value={kycFilter}
          onChange={(e) => { setPage(1); setKycFilter(e.target.value); }}
        >
          {KYC_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="talent-admin__error" role="alert">{error}</div>}

      {loading ? (
        <div className="talent-admin__loading" role="status" aria-live="polite">Yükleniyor…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="talent-admin__empty">Talent profili bulunamadı.</div>
      ) : (
        <>
          <table className="nh-table">
            <caption className="talent-admin__sr-only">Talent profilleri listesi</caption>
            <thead>
              <tr>
                <th scope="col">Uzman</th>
                <th scope="col">İtibar</th>
                <th scope="col">KYC</th>
                <th scope="col">Durum</th>
                <th scope="col">KYC İşlem</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <TalentProfileRow
                  key={p.id}
                  profile={p}
                  busy={busyId === p.id}
                  onKyc={handleKyc}
                />
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="talent-admin__pagination">
              <button
                type="button"
                className="talent-admin__pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Önceki sayfa"
              >
                ← Önceki
              </button>
              <span>{page} / {totalPages} (toplam {data.total})</span>
              <button
                type="button"
                className="talent-admin__pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Sonraki sayfa"
              >
                Sonraki →
              </button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// TalentAdminControlPage — two-tab hub
// ---------------------------------------------------------------------------

export default function TalentAdminControlPage({ jobsOnly = false }: { jobsOnly?: boolean } = {}) {
  const [tab, setTab] = useState<"jobs" | "talent">("jobs");
  const [apps, setApps] = useState<NhApp[]>(() => [...MOCK_APPS_INIT]);
  const [jobFilter, setJobFilter] = useState("all");
  const [payouts, setPayouts] = useState<NhPayout[]>(() => [...MOCK_PAYOUTS_INIT]);
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null);
  const [kycPendingCount, setKycPendingCount] = useState(0);

  useEffect(() => {
    fetchPayoutSummary().then(setPayoutSummary).catch(() => {});
    fetchAdminTalentProfiles(1, 1, "pending")
      .then((r) => setKycPendingCount(r.total))
      .catch(() => {});
  }, []);

  // Jobs tab actions
  function advanceApp(id: number) {
    setApps((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const idx = NH_STAGES.findIndex((s) => s.key === a.stage);
        const next = NH_STAGES[idx + 1];
        return next ? { ...a, stage: next.key } : a;
      }),
    );
  }
  function rejectApp(id: number) {
    setApps((prev) => prev.filter((a) => a.id !== id));
  }

  // Payout actions
  function advancePayout(id: string) {
    setPayouts((prev) =>
      prev.map((p) =>
        p.id !== id
          ? p
          : { ...p, status: p.status === "pending" ? "approved" : "paid" },
      ),
    );
    // TODO(data): persist via PATCH /api/v1/admin/payout-requests/{id}/status
  }

  // Derived
  const shownApps = jobFilter === "all" ? apps : apps.filter((a) => a.job === jobFilter);
  const avgMatch = apps.length
    ? Math.round(apps.reduce((s, a) => s + a.match, 0) / apps.length)
    : 0;
  const pendingPayAmt = payouts
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Kariyer & Yetenek · Pazar"
        title="Kariyer ve İş Piyasası"
        sub="İş ilanları ve başvuru akışı · talent profilleri, KYC onayı ve ödeme takibi."
      />

      {!jobsOnly && (
        <div className="nh-tabs">
          <button
            type="button"
            className={"nh-tab" + (tab === "jobs" ? " on" : "")}
            onClick={() => setTab("jobs")}
          >
            İş İlanları &amp; Başvurular
          </button>
          <button
            type="button"
            className={"nh-tab" + (tab === "talent" ? " on" : "")}
            onClick={() => setTab("talent")}
          >
            Yetenek &amp; Katkı Ekonomisi
          </button>
        </div>
      )}

      {/* ── Jobs tab ────────────────────────────────────────────────── */}
      {tab === "jobs" && (
        <>
          <div className="nh-stats">
            <StatCard label="Açık ilan"        value={MOCK_JOBS.length}                              sub="yayında" />
            <StatCard label="Toplam başvuru"   value={apps.length}                                   sub="aktif başvuru akışı" accent="blue" />
            <StatCard label="Ort. AI eşleşme" value={`%${avgMatch}`}                                accent="violet" />
            <StatCard label="Mülakat aşaması" value={apps.filter((a) => a.stage === "interview").length} />
            <StatCard label="Teklif verildi"  value={apps.filter((a) => a.stage === "offered").length}   accent="green" />
          </div>

          {/* İlan filtresi */}
          <div className="nh-jobfilter">
            <button
              type="button"
              className={jobFilter === "all" ? "on" : ""}
              onClick={() => setJobFilter("all")}
            >
              Tüm ilanlar <span>{apps.length}</span>
            </button>
            {MOCK_JOBS.map((j) => (
              <button
                key={j.id}
                type="button"
                className={jobFilter === j.id ? "on" : ""}
                onClick={() => setJobFilter(j.id)}
              >
                {j.title} <span>{j.employer} · {apps.filter((a) => a.job === j.id).length}</span>
              </button>
            ))}
          </div>

          {/* Selected job info bar */}
          {jobFilter !== "all" && (() => {
            const j = MOCK_JOBS.find((x) => x.id === jobFilter);
            if (!j) return null;
            return (
              <div className="tj-jobinfo">
                <div className="tj-jobinfo__l">
                  <b>{j.title}</b>
                  <span>{j.employer} · {j.type} · {j.loc}</span>
                </div>
                <div className="tj-jobinfo__facts">
                  <div><b>{j.salary}</b><span>maaş</span></div>
                  <div><b>{j.views.toLocaleString("tr-TR")}</b><span>görüntülenme</span></div>
                  <div><b>{j.apps}</b><span>başvuru</span></div>
                  <div><b>{j.deadline}</b><span>son tarih</span></div>
                </div>
              </div>
            );
          })()}

          {/* Pipeline board */}
          <div className="nh-board">
            {NH_STAGES.map((st) => {
              const col = shownApps.filter((a) => a.stage === st.key);
              return (
                <div key={st.key} className="nh-col">
                  <div className={`nh-col__hd nh-col__hd--${st.key}`}>
                    <span>{st.label}</span>
                    <em>{col.length}</em>
                  </div>
                  <div className="nh-col__body">
                    {col.length === 0 ? (
                      <div className="nh-col__empty">—</div>
                    ) : col.map((a) => {
                      const job = MOCK_JOBS.find((j) => j.id === a.job);
                      return (
                        <div key={a.id} className="nh-appcard">
                          <div className="nh-appcard__top">
                            <span className="nh-av">{nhInitials(a.name)}</span>
                            <div>
                              <b>{a.name}</b>
                              <span>{a.exp} yıl · {job?.title ?? a.job}</span>
                            </div>
                          </div>
                          <div className="nh-appcard__match">
                            <span className="nh-match"><i style={{ "--match-pct": a.match + "%" } as React.CSSProperties} /></span>
                            <em>%{a.match} AI eşleşme</em>
                          </div>
                          <div className="nh-appcard__acts">
                            {a.stage !== "offered" ? (
                              <button type="button" className="nh-act ok" onClick={() => advanceApp(a.id)}>
                                İlerlet →
                              </button>
                            ) : (
                              <span className="nh-badge ok">Teklif</span>
                            )}
                            <button type="button" className="nh-act danger" onClick={() => rejectApp(a.id)}>
                              Reddet
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Talent tab ──────────────────────────────────────────────── */}
      {tab === "talent" && (
        <>
          <div className="nh-stats">
            <StatCard label="Yetenek profili"  value="—"                sub="kayıtlı uzman" />
            <StatCard label="KYC bekleyen"     value={kycPendingCount}  sub="onay kuyruğu" accent="warn" />
            <StatCard label="Aktif görev"      value={MOCK_TASKS.length} accent="violet" />
            <StatCard label="Bekleyen ödeme"   value={nhMoney(pendingPayAmt)} sub="payout kuyruğu" accent="gold" />
          </div>

          <div className="nh-talent-split">
            <div className="nh-detail">
              <TalentProfilesSection />

              <Section
                title="Katkı görevleri (Katkı ile Kazan)"
                sub="platform mikro görevleri"
              >
                <div className="nh-tasks">
                  {MOCK_TASKS.map((t) => (
                    <div key={t.id} className="nh-task">
                      <div className="nh-task__l">
                        <b>{t.title}</b>
                        <span className="nh-mut">{t.type} · {t.subs} katkı</span>
                      </div>
                      <div className="nh-task__r">
                        <span className="nh-reward">{nhMoney(t.reward)}</span>
                        <span className="nh-badge ok">Aktif</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {payoutSummary && (
                <Section title="Ödeme talepleri özeti" sub="durum bazında toplam">
                  <div className="payout-overview">
                    {(["pending", "approved", "processing", "paid", "rejected"] as const).map((key) => {
                      const labels = { pending: "Bekliyor", approved: "Onaylandı", processing: "İşlemde", paid: "Ödendi", rejected: "Reddedildi" };
                      const clss   = { pending: "payout-box--pending", approved: "payout-box--approved", processing: "payout-box--processing", paid: "payout-box--paid", rejected: "payout-box--rejected" };
                      return (
                        <div key={key} className={`payout-box ${clss[key]}`}>
                          <div className="payout-box__count">{payoutSummary[key]}</div>
                          <div className="payout-box__label">{labels[key]}</div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}
            </div>

            {/* Ödeme kuyruğu sidebar */}
            <div className="nh-payout-sidebar">
              <div className="nh-list__hd">
                Ödeme kuyruğu
                <span>{payouts.filter((p) => p.status !== "paid").length}</span>
              </div>
              <div className="nh-payout-list">
                {payouts.map((p) => (
                  <div key={p.id} className="nh-payout">
                    <div className="nh-payout__top">
                      <b>{p.name}</b>
                      <span className={"nh-badge " + (p.status === "paid" ? "ok" : p.status === "approved" ? "info" : "wait")}>
                        {p.status === "paid" ? "Ödendi" : p.status === "approved" ? "Onaylı" : "Bekliyor"}
                      </span>
                    </div>
                    <div className="nh-payout__mid">
                      <span className="nh-mono">{nhMoney(p.amount)}</span>
                      <span className="nh-mut">{p.method}</span>
                    </div>
                    {p.status !== "paid" && (
                      <button
                        type="button"
                        className="nh-act ok full"
                        onClick={() => advancePayout(p.id)}
                      >
                        {p.status === "pending" ? "Onayla" : "Ödemeyi tamamla"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

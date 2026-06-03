/**
 * ApprovalDashboard — İki bölmeli onay akışı yönetim paneli.
 * Sol: onay kuyruğu (master) · Sağ: seçili onay detayı + karar
 */
import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import { PageHeader, Section, StatCard } from "../pages/admin/AdminTabContent";
import "./ApprovalDashboard.css";

interface PendingApproval {
  approval_id: number;
  quote_id: number;
  quote_title: string;
  quote_status: string;
  total_amount: number;
  company_name: string;
  approval_level: number;
  requested_at: string;
  created_at: string;
}

interface ApprovalStep {
  id: number;
  level: number;
  status: string;
  required_business_role?: string;
  required_business_role_label?: string;
  requested_at: string | null;
  completed_at: string | null;
  approver_name: string | null;
  comment: string | null;
}

interface ApprovalDashboardProps {
  apiUrl: string;
  authToken: string;
}

// ── Budget rules (display only — mock data) ───────────────────────────────
const AP_BUDGET_RULES = [
  { label: "≤ ₺250.000",                chain: ["Birim Yöneticisi"] },
  { label: "₺250.001 – ₺1.000.000",    chain: ["Birim Yöneticisi", "Satınalma Direktörü"] },
  { label: "> ₺1.000.000",             chain: ["Birim Yöneticisi", "Satınalma Direktörü", "Firma Sahibi / GM"] },
];

const LEVEL_ROLES: Record<number, string> = {
  1: "Birim Yöneticisi",
  2: "Satınalma Direktörü",
  3: "Firma Sahibi / GM",
};

const MAX_STEPS = 3;

const COMPANY_COLORS = [
  "#1d4ed8", "#be123c", "#7c3aed",
  "#047857", "#b45309", "#0891b2",
];

function companyColor(name: string): string {
  let h = 0;
  for (const c of name) h = ((h << 5) - h) + c.charCodeAt(0);
  return COMPANY_COLORS[Math.abs(h) % COMPANY_COLORS.length];
}

function fmtMoney(n: number): string {
  return "₺" + Number(n).toLocaleString("tr-TR");
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

type StepStatus = "approved" | "pending" | "waiting" | "rejected";

interface Step {
  num: number;
  role: string;
  status: StepStatus;
}

function buildSteps(level: number): Step[] {
  return Array.from({ length: MAX_STEPS }, (_, i) => ({
    num: i + 1,
    role: LEVEL_ROLES[i + 1] ?? `Kademe ${i + 1}`,
    status: (i < level - 1 ? "approved" : i === level - 1 ? "pending" : "waiting") as StepStatus,
  }));
}

const STEP_CLS: Record<StepStatus, string> = {
  approved: "ap-step--ok",
  pending:  "ap-step--wait",
  waiting:  "ap-step--off",
  rejected: "ap-step--rej",
};

const STEP_ICON: Record<StepStatus, string> = {
  approved: "✓",
  pending:  "⏳",
  waiting:  "·",
  rejected: "✕",
};

const STEP_LABEL: Record<StepStatus, string> = {
  approved: "Onaylandı",
  pending:  "Karar bekliyor",
  waiting:  "Sırada",
  rejected: "Reddedildi",
};

function apiStepStatus(status: string): StepStatus {
  if (status === "onaylandı")    return "approved";
  if (status === "reddedildi")   return "rejected";
  if (status === "beklemede")    return "pending";
  return "waiting";
}

export function ApprovalDashboard({ apiUrl, authToken }: ApprovalDashboardProps) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [stepDetail, setStepDetail] = useState<ApprovalStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/approvals/user/pending`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Onaylar yüklenemedi");
      const data: PendingApproval[] = (await res.json()) ?? [];
      setApprovals(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authToken]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  useEffect(() => {
    if (selId === null && approvals.length > 0) {
      setSelId(approvals[0].approval_id);
    }
  }, [approvals, selId]);

  // Load enriched step detail whenever the selected approval changes
  useEffect(() => {
    const sel = approvals.find((a) => a.approval_id === selId);
    if (!sel) { setStepDetail([]); return; }
    setLoadingSteps(true);
    fetch(`${apiUrl}/api/v1/approvals/${sel.quote_id}/pending`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.ok ? r.json() as Promise<ApprovalStep[]> : Promise.resolve([]))
      .then((data) => setStepDetail(data))
      .catch(() => setStepDetail([]))
      .finally(() => setLoadingSteps(false));
  }, [selId, approvals, apiUrl, authToken]);

  const handleApprove = useCallback(async (quoteId: number) => {
    if (!comment.trim()) {
      setError("Onay için not yazmanız gerekir");
      return;
    }
    setProcessing(quoteId);
    try {
      const res = await fetch(`${apiUrl}/api/v1/approvals/${quoteId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error((errData as { detail?: string }).detail ?? "Onaylama başarısız");
      }
      setSuccess("Teklif onaylandı");
      setComment("");
      void loadApprovals();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessing(null);
    }
  }, [apiUrl, authToken, comment, loadApprovals]);

  const handleReject = useCallback(async (quoteId: number) => {
    if (!comment.trim()) {
      setError("Red nedeni yazmanız gerekir");
      return;
    }
    setProcessing(quoteId);
    try {
      const res = await fetch(`${apiUrl}/api/v1/approvals/${quoteId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error((errData as { detail?: string }).detail ?? "Red başarısız");
      }
      setSuccess("Teklif reddedildi");
      setComment("");
      void loadApprovals();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessing(null);
    }
  }, [apiUrl, authToken, comment, loadApprovals]);

  const sel = approvals.find((a) => a.approval_id === selId) ?? approvals[0] ?? null;
  const selColor = sel ? companyColor(sel.company_name) : "#1d4ed8";

  // Use enriched step detail when available, fall back to inferred steps
  const richSteps = stepDetail.length > 0
    ? stepDetail.map((s) => ({
        num: s.level,
        role: s.required_business_role_label ?? LEVEL_ROLES[s.level] ?? `Kademe ${s.level}`,
        status: apiStepStatus(s.status),
        approverName: s.approver_name,
        comment: s.comment,
        completedAt: s.completed_at,
      }))
    : (sel ? buildSteps(sel.approval_level).map((s) => ({ ...s, approverName: null, comment: null, completedAt: null })) : []);

  const steps = sel ? buildSteps(sel.approval_level) : [];
  const curStep = richSteps.find((s) => s.status === "pending") ?? steps.find((s) => s.status === "pending");

  return (
    <div className="ap-tab">
      <PageHeader
        eyebrow="Yönetişim · Onay"
        title="Onay Akışları"
        sub="Teklif onay zincirleri — bütçe eşiğine göre çok kademeli onay (Yönetici → Direktör → GM), bekleyen kuyruk ve karar."
        actions={
          <button
            type="button"
            className={"ap-rules-toggle" + (showRules ? " on" : "")}
            onClick={() => setShowRules((s) => !s)}
          >
            ⊞ Onay kuralları
          </button>
        }
      />

      {showRules && (
        <Section title="Onay kuralları" sub="bütçe eşiği → gereken onay zinciri · platform varsayılanı">
          <div className="ap-rules-note">
            Onay akışı yalnızca <b>stratejik partner (alıcı) firmalarında</b> bulunur — tedarikçi, iş ortağı
            ve kariyer firmalarında satın alma onay zinciri yoktur.
          </div>
          <div className="ap-rules">
            {AP_BUDGET_RULES.map((r) => (
              <div key={r.label} className="ap-rule">
                <span className="ap-rule__th">{r.label}</span>
                <div className="ap-rule__chain">
                  {r.chain.map((role, i) => (
                    <span key={role}>
                      <span className="ap-rolechip">{i + 1}. {role}</span>
                      {i < r.chain.length - 1 && <i className="ap-arrow">→</i>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Bekleyen onay" value={approvals.length} sub="aktif kuyruk" accent="warn" />
        <StatCard label="Toplam tutar" value={fmtMoney(approvals.reduce((s, a) => s + a.total_amount, 0))} accent="blue" />
        <StatCard label="Ortalama kademe" value={approvals.length ? Math.round(approvals.reduce((s, a) => s + a.approval_level, 0) / approvals.length) : 0} sub="mevcut onay seviyesi" accent="violet" />
        <StatCard label="Onay bekleyen" value={approvals.length} sub="platform geneli" />
      </div>

      {error   && <div className="ap-banner ap-banner--error">{error}</div>}
      {success && <div className="ap-banner ap-banner--ok">{success}</div>}

      <div className="ap-split">
        {/* ── List pane ── */}
        <aside className="ap-pool">
          <div className="ap-pool__hd">
            Onay kuyruğu <span>{approvals.length}</span>
          </div>
          <div className="ap-pool__list">
            {loading ? (
              <div className="ap-state">Yükleniyor…</div>
            ) : approvals.length === 0 ? (
              <div className="ap-state">Bekleyen onay yok.</div>
            ) : (
              approvals.map((a) => {
                const color = companyColor(a.company_name);
                return (
                  <button
                    key={a.approval_id}
                    type="button"
                    className={"ap-row" + (a.approval_id === sel?.approval_id ? " on" : "")}
                    onClick={() => { setSelId(a.approval_id); setComment(""); }}
                    style={{ "--ap-color": color, "--ap-color-bg": color + "1f" } as CSSProperties}
                  >
                    <span className="ap-row__bar" />
                    <span className="ap-row__ico">✓</span>
                    <span className="ap-row__meta">
                      <b>
                        {a.quote_title}{" "}
                        <span className="ap-badge ap-badge--wait">Bekliyor</span>
                      </b>
                      <span>
                        <span className="ap-company-pill">
                          {a.company_name}
                        </span>
                        {" "}· {fmtMoney(a.total_amount)}
                      </span>
                    </span>
                    <span className="ap-row__level">Kademe {a.approval_level}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Detail pane ── */}
        <div
          className="ap-detail"
          style={sel ? { "--ap-color": selColor, "--ap-color-bg": selColor + "1f" } as CSSProperties : undefined}
        >
          {!sel ? (
            <div className="ap-state ap-state--pad">Listeden bir onay seçin.</div>
          ) : (
            <>
              <div className="ap-detail__hd">
                <div className="ap-detail__ico">✓</div>
                <div className="ap-detail__info">
                  <h3 className="ap-detail__title">
                    {sel.quote_title}{" "}
                    <span className="ap-badge ap-badge--wait">Onay bekliyor</span>
                  </h3>
                  <div className="ap-detail__meta">
                    <span className="ap-company-pill ap-company-pill--lg">
                      {sel.company_name}
                    </span>
                    <span className="ap-sep">·</span>
                    <span>{fmtMoney(sel.total_amount)}</span>
                    <span className="ap-sep">·</span>
                    <code className="ap-code">#{sel.quote_id}</code>
                    <span className="ap-sep">·</span>
                    <span>{fmtDate(sel.requested_at)}</span>
                  </div>
                </div>
              </div>

              <div className="ap-budget-note">
                Bu tutar (<b>{fmtMoney(sel.total_amount)}</b>) için{" "}
                <b>Kademe {sel.approval_level} onayı</b> gerekiyor{" "}
                — mevcut onayör: <b>{LEVEL_ROLES[sel.approval_level] ?? `Kademe ${sel.approval_level}`}</b>
              </div>

              <Section title="Onay zinciri" sub="kademe → iş rolü → karar">
                {loadingSteps && <div className="ap-state">Adımlar yükleniyor…</div>}
                <div className="ap-chain">
                  {richSteps.map((s) => (
                    <div key={s.num} className={"ap-step " + STEP_CLS[s.status]}>
                      <span className="ap-step__dot">{STEP_ICON[s.status]}</span>
                      <div className="ap-step__body">
                        <div className="ap-step__top">
                          <b>Kademe {s.num} · {s.role}</b>
                          <span className={"ap-badge ap-badge--" + (s.status === "approved" ? "ok" : s.status === "rejected" ? "rej" : s.status === "pending" ? "wait" : "off")}>
                            {STEP_LABEL[s.status]}
                          </span>
                        </div>
                        {s.approverName && (
                          <span className="ap-step__who">
                            {s.approverName}
                            {s.completedAt ? ` · ${fmtDateTime(s.completedAt)}` : ""}
                          </span>
                        )}
                        {s.comment && <p className="ap-step__cm">"{s.comment}"</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {curStep && (
                  <div className="ap-decision">
                    <div className="ap-decision__hd">
                      Sıradaki onay sizde ·{" "}
                      <b>Kademe {curStep.num} — {curStep.role}</b>
                    </div>
                    <textarea
                      className="ap-input ap-input--ta"
                      rows={2}
                      placeholder="Karar notu (zorunlu)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="ap-decision__btns">
                      <button
                        type="button"
                        className="ap-btn ap-btn--primary"
                        onClick={() => { void handleApprove(sel.quote_id); }}
                        disabled={processing !== null}
                      >
                        {processing === sel.quote_id ? "İşleniyor…" : "✓ Onayla"}
                      </button>
                      <button
                        type="button"
                        className="ap-btn ap-btn--danger"
                        onClick={() => { void handleReject(sel.quote_id); }}
                        disabled={processing !== null}
                      >
                        {processing === sel.quote_id ? "İşleniyor…" : "✕ Reddet"}
                      </button>
                    </div>
                  </div>
                )}
              </Section>

              <div className="ap-facts">
                <div className="ap-fact"><span>Onay seviyesi</span><b>Kademe {sel.approval_level}</b></div>
                <div className="ap-fact"><span>Quote ID</span><b>#{sel.quote_id}</b></div>
                <div className="ap-fact"><span>Talep tarihi</span><b>{fmtDate(sel.requested_at)}</b></div>
                <div className="ap-fact"><span>Oluşturma</span><b>{fmtDate(sel.created_at)}</b></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

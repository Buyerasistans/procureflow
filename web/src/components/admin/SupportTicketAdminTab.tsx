/**
 * SupportTicketAdminTab — İki bölmeli destek talebi yönetim paneli.
 * Sol: filtrelenebilir liste (master) · Sağ: seçili talep detayı + güncelleme
 */
import { useEffect, useState } from "react";
import { PageHeader, Section, StatCard } from "../../pages/admin/AdminTabContent";
import {
  adminListSupportTickets,
  adminUpdateSupportTicket,
  getPersonnel,
  type SupportTicket,
} from "../../services/admin.service";
import "./SupportTicketAdminTab.css";

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  in_progress: "İşlemde",
  waiting_response: "Yanıt Bekleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
};

const STATUS_CLS: Record<string, string> = {
  open: "wait",
  in_progress: "info",
  waiting_response: "warn",
  resolved: "ok",
  closed: "off",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  urgent: "Acil",
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "Genel",
  onboarding: "Kurulum & Aktivasyon",
  billing: "Fatura & Ödeme",
  technical: "Teknik Sorun",
  account: "Hesap & Yetki",
};

const SOURCE_LABELS: Record<string, string> = {
  tenant_portal: "Tenant Portalı",
  panel: "Panel",
  email: "E-posta",
  phone: "Telefon",
};

const TENANT_COLORS = [
  "#1d4ed8", "#be123c", "#7c3aed", "#047857",
  "#b45309", "#0891b2", "#c2410c", "#0f766e",
];

const STATUS_SEGS: [string, string][] = [
  ["all", "Tümü"],
  ["open", "Açık"],
  ["in_progress", "İşlemde"],
  ["waiting_response", "Bekliyor"],
  ["resolved", "Çözüldü"],
  ["closed", "Kapandı"],
];

function tColor(ticket: SupportTicket): string {
  return TENANT_COLORS[ticket.tenant_id % TENANT_COLORS.length];
}

function slaText(ticket: SupportTicket): string {
  if (!ticket.sla_due_at) return "—";
  if (["resolved", "closed"].includes(ticket.status)) return "tamam";
  const diff = new Date(ticket.sla_due_at).getTime() - Date.now();
  if (diff < 0) return "gecikti";
  const h = Math.round(diff / 3_600_000);
  if (h < 24) return `${h} sa kaldı`;
  return `${Math.round(diff / 86_400_000)} gün kaldı`;
}

function slaCls(ticket: SupportTicket): string {
  const t = slaText(ticket);
  if (t === "gecikti") return "red";
  if (t.includes("kaldı")) return "amber";
  return "slate";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

function isBreached(ticket: SupportTicket): boolean {
  if (!ticket.sla_due_at) return false;
  return (
    new Date(ticket.sla_due_at) < new Date() &&
    !["resolved", "closed"].includes(ticket.status)
  );
}

export function SupportTicketAdminTab() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [flt, setFlt] = useState("all");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [platformUsers, setPlatformUsers] = useState<{ id: number; full_name: string }[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminListSupportTickets()
      .then((data) => {
        setTickets(data);
        if (data.length > 0) setSelId(data[0].id);
      })
      .catch(() => setError("Destek talepleri yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getPersonnel({ scope: "portal" })
      .then((users) =>
        setPlatformUsers(
          users
            .filter((u) => u.full_name)
            .map((u) => ({ id: u.id, full_name: u.full_name })),
        ),
      )
      .catch(() => undefined);
  }, []);

  const ql = q.trim().toLowerCase();
  const list = tickets.filter((t) => {
    if (flt !== "all" && t.status !== flt) return false;
    if (ql && !`${t.subject} ${t.tenant_name ?? ""} #${t.id}`.toLowerCase().includes(ql)) return false;
    return true;
  });

  const sel = tickets.find((t) => t.id === selId) ?? list[0] ?? null;

  function patchTicket(updated: SupportTicket) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function applyStatus(id: number, status: string) {
    setSaving(true);
    try {
      const payload: { status: string; resolution_note?: string } = { status };
      if (status === "resolved" && note.trim()) payload.resolution_note = note.trim();
      const updated = await adminUpdateSupportTicket(id, payload);
      patchTicket(updated);
      if (status === "resolved") setNote("");
    } catch { /* sessiz */ }
    finally { setSaving(false); }
  }

  async function applyAssignee(id: number, userId: string) {
    setSaving(true);
    try {
      const updated = await adminUpdateSupportTicket(id, {
        assigned_to_user_id: userId === "" ? null : Number(userId),
      });
      patchTicket(updated);
    } catch { /* sessiz */ }
    finally { setSaving(false); }
  }

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProcCount = tickets.filter((t) => t.status === "in_progress").length;
  const breachedCount = tickets.filter(isBreached).length;
  const urgentCount = tickets.filter(
    (t) => t.priority === "urgent" && !["resolved", "closed"].includes(t.status),
  ).length;

  return (
    <div className="support-ticket-admin-tab">
      <PageHeader
        eyebrow="Sistem · Destek"
        title="Destek Talepleri"
        sub="Stratejik partner destek talepleri — kategori, öncelik, SLA, atama ve çözüm yönetimi."
      />

      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Açık talep" value={openCount} accent="warn" />
        <StatCard label="İşlemde" value={inProcCount} sub="aktif müdahale" accent="blue" />
        <StatCard label="SLA riski" value={breachedCount} sub="geciken/yaklaşan" accent="violet" />
        <StatCard label="Acil" value={urgentCount} accent="red" />
      </div>

      <div className="spt-toolbar">
        <div className="spt-search">
          <span className="spt-search__icon">⌕</span>
          <input
            className="spt-search__input"
            placeholder="Konu, partner veya #ID ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="spt-segs">
          {STATUS_SEGS.map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={"spt-seg__btn" + (flt === v ? " on" : "")}
              onClick={() => setFlt(v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="spt-error">{error}</div>}

      <div className="spt-split">
        {/* ── List pane ── */}
        <aside className="spt-pool">
          <div className="spt-pool__hd">
            Talepler <span>{list.length}</span>
          </div>
          <div className="spt-pool__list">
            {loading ? (
              <div className="spt-state">Yükleniyor…</div>
            ) : list.length === 0 ? (
              <div className="spt-state">Bu filtreyle talep bulunamadı.</div>
            ) : (
              list.map((t) => {
                const color = tColor(t);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={"spt-row" + (t.id === sel?.id ? " on" : "")}
                    onClick={() => { setSelId(t.id); setNote(""); }}
                  >
                    <span className="spt-row__bar" style={{ background: color }} />
                    <span
                      className={"spt-prio spt-prio--" + t.priority}
                      title={PRIORITY_LABELS[t.priority] ?? t.priority}
                    />
                    <span className="spt-row__meta">
                      <b>
                        {t.subject}{" "}
                        <span className={"spt-badge spt-badge--" + (STATUS_CLS[t.status] ?? "off")}>
                          {STATUS_LABELS[t.status] ?? t.status}
                        </span>
                      </b>
                      <span>
                        <span
                          className="spt-tpill"
                          style={{ background: color + "1f", color }}
                        >
                          {t.tenant_name ?? "—"}
                        </span>
                        {" "}#{t.id} · {CATEGORY_LABELS[t.category] ?? t.category}
                      </span>
                    </span>
                    <span className={"spt-sla spt-sla--" + slaCls(t)}>{slaText(t)}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Detail pane ── */}
        <div className="spt-detail">
          {!sel ? (
            <div className="spt-state spt-state--pad">Listeden bir talep seçin.</div>
          ) : (
            <>
              <div className="spt-detail__hd">
                <h3 className="spt-detail__title">
                  {sel.subject}{" "}
                  <span className={"spt-badge spt-badge--" + (STATUS_CLS[sel.status] ?? "off")}>
                    {STATUS_LABELS[sel.status] ?? sel.status}
                  </span>{" "}
                  <span className={"spt-prio-lbl spt-prio-lbl--" + sel.priority}>
                    {PRIORITY_LABELS[sel.priority] ?? sel.priority} öncelik
                  </span>
                </h3>
                <div className="spt-detail__meta">
                  <span
                    className="spt-tpill spt-tpill--lg"
                    style={{ background: tColor(sel) + "1f", color: tColor(sel) }}
                  >
                    {sel.tenant_name ?? "—"}
                  </span>
                  <span className="spt-sep">·</span>
                  <span>Açan: <b>{sel.created_by_name ?? "—"}</b></span>
                  <span className="spt-sep">·</span>
                  <span>{fmtDate(sel.created_at)}</span>
                  <span className="spt-sep">·</span>
                  <code className="spt-code">#{sel.id}</code>
                </div>
              </div>

              <div className="split-1-1">
                <Section
                  title="Talep detayı"
                  sub={(CATEGORY_LABELS[sel.category] ?? sel.category) + " · " + (SOURCE_LABELS[sel.source] ?? sel.source)}
                >
                  {sel.description && (
                    <p className="spt-desc">{sel.description}</p>
                  )}
                  <div className="spt-facts">
                    <div className="spt-fact">
                      <span>Kategori</span>
                      <b>{CATEGORY_LABELS[sel.category] ?? sel.category}</b>
                    </div>
                    <div className="spt-fact">
                      <span>Kaynak</span>
                      <b>{SOURCE_LABELS[sel.source] ?? sel.source}</b>
                    </div>
                    <div className="spt-fact">
                      <span>SLA</span>
                      <b className={"spt-sla spt-sla--" + slaCls(sel)}>{slaText(sel)}</b>
                    </div>
                    <div className="spt-fact">
                      <span>Oluşturma</span>
                      <b>{fmtDate(sel.created_at)}</b>
                    </div>
                    <div className="spt-fact">
                      <span>Güncelleme</span>
                      <b>{fmtDate(sel.updated_at)}</b>
                    </div>
                    <div className="spt-fact">
                      <span>Partner görünürlüğü</span>
                      <b>{sel.is_visible_to_tenant ? "Görünür" : "Gizli"}</b>
                    </div>
                  </div>
                </Section>

                <Section title="Atama & Durum" sub="destek ekibi">
                  <label className="spt-field">
                    <span className="spt-field__lbl">Atanan temsilci</span>
                    <select
                      className="spt-input"
                      value={sel.assigned_to_user_id ?? ""}
                      onChange={(e) => { void applyAssignee(sel.id, e.target.value); }}
                      disabled={saving}
                    >
                      <option value="">— Atanmamış —</option>
                      {platformUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="spt-field">
                    <span className="spt-field__lbl">Durum</span>
                    <div className="spt-dseg">
                      {(["open", "in_progress", "waiting_response", "resolved", "closed"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={sel.status === s ? "on" : ""}
                          onClick={() => { void applyStatus(sel.id, s); }}
                          disabled={saving}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {sel.assigned_to_name && (
                    <div className="spt-field">
                      <span className="spt-field__lbl">Atanan kişi</span>
                      <span className="spt-asgn">{sel.assigned_to_name}</span>
                    </div>
                  )}
                </Section>
              </div>

              <Section title="Çözüm" sub="resolution_note">
                {sel.resolution_note && (
                  <div className="spt-resolution">{sel.resolution_note}</div>
                )}
                {!["resolved", "closed"].includes(sel.status) ? (
                  <>
                    <textarea
                      className="spt-input spt-input--ta"
                      rows={3}
                      placeholder="Çözüm notu yazın…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="spt-btns">
                      <button
                        type="button"
                        className="spt-btn spt-btn--primary"
                        onClick={() => { void applyStatus(sel.id, "resolved"); }}
                        disabled={saving}
                      >
                        ✓ Çözüldü olarak işaretle
                      </button>
                      <button
                        type="button"
                        className="spt-btn spt-btn--ghost"
                        onClick={() => { void applyStatus(sel.id, "waiting_response"); }}
                        disabled={saving}
                      >
                        Yanıt bekliyor
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="spt-muted">
                    Bu talep {(STATUS_LABELS[sel.status] ?? sel.status).toLowerCase()} durumda.
                  </p>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * SupportTicketAdminTab — Platform personelinin tüm destek taleplerini yönettiği admin sekmesi.
 * Özellikler:
 *   - Durum / kategori / öncelik filtresi
 *   - Satır bazlı hızlı güncelleme (durum, atama, çözüm notu)
 *   - SLA aşım uyarısı
 */
import { useCallback, useEffect, useState } from "react";
import { PageHeader, StatCard } from "../../pages/admin/AdminTabContent";
import {
  adminListSupportTickets,
  adminUpdateSupportTicket,
  getPersonnel,
  type SupportTicket,
  type TicketAdminUpdatePayload,
} from "../../services/admin.service";
import "./SupportTicketAdminTab.css";

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  in_progress: "İşlemde",
  waiting_response: "Yanıt Bekleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
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

const ALL_STATUSES = Object.keys(STATUS_LABELS);
const ALL_PRIORITIES = Object.keys(PRIORITY_LABELS);
const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

function isSlaBreached(ticket: SupportTicket): boolean {
  if (!ticket.sla_due_at) return false;
  return new Date(ticket.sla_due_at) < new Date() && !["resolved", "closed"].includes(ticket.status);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

interface InlineUpdateFormProps {
  ticket: SupportTicket;
  platformUserOptions: { id: number; full_name: string }[];
  onSaved: (updated: SupportTicket) => void;
  onCancel: () => void;
}

function InlineUpdateForm({ ticket, platformUserOptions, onSaved, onCancel }: InlineUpdateFormProps) {
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [assignedTo, setAssignedTo] = useState<number | "">(ticket.assigned_to_user_id ?? "");
  const [resolutionNote, setResolutionNote] = useState(ticket.resolution_note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload: TicketAdminUpdatePayload = {};
    if (status !== ticket.status) payload.status = status;
    if (priority !== ticket.priority) payload.priority = priority;
    if (assignedTo !== (ticket.assigned_to_user_id ?? "")) {
      payload.assigned_to_user_id = assignedTo === "" ? null : assignedTo;
    }
    if (resolutionNote !== (ticket.resolution_note ?? "")) payload.resolution_note = resolutionNote;

    try {
      const updated = await adminUpdateSupportTicket(ticket.id, payload);
      onSaved(updated);
    } catch {
      setError("Kayıt başarısız. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="support-ticket-admin-tab__inline-form">
      <label className="support-ticket-admin-tab__inline-form-label">
        <span className="support-ticket-admin-tab__inline-form-label-text">Durum</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          title="Destek talebi durum seçimi"
          aria-label="Destek talebi durum seçimi"
          className="support-ticket-admin-tab__inline-form-select"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="support-ticket-admin-tab__inline-form-label">
        <span className="support-ticket-admin-tab__inline-form-label-text">Öncelik</span>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          title="Destek talebi öncelik seçimi"
          aria-label="Destek talebi öncelik seçimi"
          className="support-ticket-admin-tab__inline-form-select"
        >
          {ALL_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      <label className="support-ticket-admin-tab__inline-form-label support-ticket-admin-tab__inline-form-label--full">
        <span className="support-ticket-admin-tab__inline-form-label-text">Atanan Kişi</span>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value === "" ? "" : Number(e.target.value))}
          title="Destek talebi atanan kişi seçimi"
          aria-label="Destek talebi atanan kişi seçimi"
          className="support-ticket-admin-tab__inline-form-select"
        >
          <option value="">— Atanmamış —</option>
          {platformUserOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
      </label>

      <label className="support-ticket-admin-tab__inline-form-label support-ticket-admin-tab__inline-form-label--full">
        <span className="support-ticket-admin-tab__inline-form-label-text">Çözüm Notu</span>
        <textarea
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          rows={2}
          placeholder="Müşteriye görünecek çözüm notu..."
          className="support-ticket-admin-tab__inline-form-textarea"
        />
      </label>

      {error && (
        <div className="support-ticket-admin-tab__inline-form-error">{error}</div>
      )}

      <div className="support-ticket-admin-tab__inline-form-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="support-ticket-admin-tab__button support-ticket-admin-tab__button--secondary"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="support-ticket-admin-tab__button support-ticket-admin-tab__button--primary"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </div>
  );
}

interface TicketRowProps {
  ticket: SupportTicket;
  isExpanded: boolean;
  platformUserOptions: { id: number; full_name: string }[];
  onToggle: () => void;
  onUpdated: (updated: SupportTicket) => void;
}

function TicketRow({ ticket, isExpanded, platformUserOptions, onToggle, onUpdated }: TicketRowProps) {
  const breached = isSlaBreached(ticket);

  return (
    <div
      className={`support-ticket-admin-tab__ticket-row ${
        breached ? "support-ticket-admin-tab__ticket-row--breached" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="support-ticket-admin-tab__ticket-header"
      >
        <div>
          <div className="support-ticket-admin-tab__ticket-main-title">
            #{ticket.id} — {ticket.subject}
          </div>
          <div className="support-ticket-admin-tab__ticket-main-meta">
            {ticket.tenant_name ?? "—"} · {ticket.created_by_name ?? "—"} · {formatDate(ticket.created_at)}
          </div>
        </div>

        <span className="support-ticket-admin-tab__ticket-category">
          {CATEGORY_LABELS[ticket.category] ?? ticket.category}
        </span>

        <span
          className={`support-ticket-admin-tab__ticket-priority support-ticket-admin-tab__ticket-priority--${ticket.priority}`}
        >
          {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
        </span>

        <span
          className={`support-ticket-admin-tab__ticket-status support-ticket-admin-tab__ticket-status--${ticket.status}`}
        >
          {STATUS_LABELS[ticket.status] ?? ticket.status}
        </span>

        <span
          className={`support-ticket-admin-tab__ticket-sla ${
            breached
              ? "support-ticket-admin-tab__ticket-sla--breached"
              : "support-ticket-admin-tab__ticket-sla--ok"
          }`}
        >
          {breached ? "⚠ SLA" : "SLA: " + formatDate(ticket.sla_due_at)}
        </span>
      </button>

      {isExpanded && (
        <div className="support-ticket-admin-tab__ticket-details">
          {ticket.description && (
            <div className="support-ticket-admin-tab__ticket-description">
              {ticket.description}
            </div>
          )}
          {ticket.resolution_note && (
            <div className="support-ticket-admin-tab__ticket-resolution">
              <strong>Çözüm Notu:</strong> {ticket.resolution_note}
            </div>
          )}
          <div className="support-ticket-admin-tab__ticket-assignee">
            Atanan: <strong>{ticket.assigned_to_name ?? "Atanmamış"}</strong> · Kaynak: {ticket.source} · Güncellenme: {formatDate(ticket.updated_at)}
          </div>
          <InlineUpdateForm
            ticket={ticket}
            platformUserOptions={platformUserOptions}
            onSaved={(updated) => {
              onUpdated(updated);
            }}
            onCancel={onToggle}
          />
        </div>
      )}
    </div>
  );
}

export function SupportTicketAdminTab() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");

  const [platformUsers, setPlatformUsers] = useState<{ id: number; full_name: string }[]>([]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {};
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const data = await adminListSupportTickets(params);
      setTickets(data);
    } catch {
      setError("Destek talepleri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, priorityFilter]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    getPersonnel({ scope: "portal" })
      .then((users) =>
        setPlatformUsers(
          users
            .filter((u) => u.full_name)
            .map((u) => ({ id: u.id, full_name: u.full_name })),
        ),
      )
      .catch(() => {
        /* sessiz hata */
      });
  }, []);

  function handleUpdated(updated: SupportTicket) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setExpandedId(null);
  }

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const breachedCount = tickets.filter(isSlaBreached).length;
  const urgentCount = tickets.filter(
    (t) => t.priority === "urgent" && !["resolved", "closed"].includes(t.status),
  ).length;

  return (
    <div className="support-ticket-admin-tab">
      <PageHeader
        eyebrow="Sistem"
        title="Destek Talepleri"
        sub="Tenant kullanıcılarının platform personeline ilettiği destek talepleri"
      />
      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Açık" value={openCount} accent="blue" sub="Yanıt bekleyen talepler" />
        <StatCard label="İşlemde" value={inProgressCount} accent="warn" sub="Aktif müdahale" />
        <StatCard label="SLA Aşımı" value={breachedCount} accent="red" sub="Süre aşıldı" />
        <StatCard label="Acil" value={urgentCount} accent="violet" sub="Yüksek öncelikli" />
      </div>

      <div className="support-ticket-admin-tab__summary-row">
        {[
          {
            label: "Açık",
            value: openCount,
            colorClass: "support-ticket-admin-tab__summary-value--open",
          },
          {
            label: "İşlemde",
            value: inProgressCount,
            colorClass: "support-ticket-admin-tab__summary-value--in-progress",
          },
          {
            label: "Acil",
            value: urgentCount,
            colorClass: "support-ticket-admin-tab__summary-value--urgent",
          },
          {
            label: "SLA Aşımı",
            value: breachedCount,
            colorClass: "support-ticket-admin-tab__summary-value--breached",
          },
          {
            label: "Toplam",
            value: tickets.length,
            colorClass: "support-ticket-admin-tab__summary-value--total",
          },
        ].map((m) => (
          <div key={m.label} className="support-ticket-admin-tab__summary-card">
            <div className={`support-ticket-admin-tab__summary-value ${m.colorClass}`}>{m.value}</div>
            <div className="support-ticket-admin-tab__summary-label">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="support-ticket-admin-tab__filters">
        <label>
          <span className="support-ticket-admin-tab__summary-label">Durum</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            title="Destek talebi durum filtresi"
            aria-label="Destek talebi durum filtresi"
            className="support-ticket-admin-tab__filter-select"
          >
            <option value="">Tüm Durumlar</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="support-ticket-admin-tab__summary-label">Kategori</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            title="Destek talebi kategori filtresi"
            aria-label="Destek talebi kategori filtresi"
            className="support-ticket-admin-tab__filter-select"
          >
            <option value="">Tüm Kategoriler</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="support-ticket-admin-tab__summary-label">Öncelik</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            title="Destek talebi öncelik filtresi"
            aria-label="Destek talebi öncelik filtresi"
            className="support-ticket-admin-tab__filter-select"
          >
            <option value="">Tüm Öncelikler</option>
            {ALL_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void loadTickets()}
          className="support-ticket-admin-tab__refresh-button"
        >
          ↻ Yenile
        </button>

        <span className="support-ticket-admin-tab__record-count">{tickets.length} kayıt</span>
      </div>

      {error && <div className="support-ticket-admin-tab__error">{error}</div>}

      {loading && <div className="support-ticket-admin-tab__loading">Yükleniyor...</div>}

      {!loading && tickets.length === 0 && !error && (
        <div className="support-ticket-admin-tab__empty-state">
          Bu filtreyle eşleşen destek talebi bulunamadı.
        </div>
      )}

      {!loading && (
        <div className="support-ticket-admin-tab__ticket-list">
          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              isExpanded={expandedId === ticket.id}
              platformUserOptions={platformUsers}
              onToggle={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

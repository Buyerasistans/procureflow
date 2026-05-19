/**
 * SupportTicketAdminTab — Platform personelinin tüm destek taleplerini yönettiği admin sekmesi.
 * Özellikler:
 *   - Durum / kategori / öncelik filtresi
 *   - Satır bazlı hızlı güncelleme (durum, atama, çözüm notu)
 *   - SLA aşım uyarısı
 */
import { useCallback, useEffect, useState } from "react";
import {
  adminListSupportTickets,
  adminUpdateSupportTicket,
  getPersonnel,
  type SupportTicket,
  type TicketAdminUpdatePayload,
} from "../../services/admin.service";

// ---------------------------------------------------------------------------
// Etiket/renk tanımları
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  in_progress: "İşlemde",
  waiting_response: "Yanıt Bekleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#1d4ed8",
  in_progress: "#c2410c",
  waiting_response: "#7c3aed",
  resolved: "#15803d",
  closed: "#64748b",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  urgent: "Acil",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#64748b",
  medium: "#1d4ed8",
  high: "#c2410c",
  urgent: "#dc2626",
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

// ---------------------------------------------------------------------------
// Yardımcı: SLA aşım kontrolü
// ---------------------------------------------------------------------------
function isSlaBreached(ticket: SupportTicket): boolean {
  if (!ticket.sla_due_at) return false;
  return new Date(ticket.sla_due_at) < new Date() && !["resolved", "closed"].includes(ticket.status);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

// ---------------------------------------------------------------------------
// Inline güncelleme formu
// ---------------------------------------------------------------------------
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
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "14px 16px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "10px 14px",
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        <span style={{ fontWeight: 600, color: "#475569" }}>Durum</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        <span style={{ fontWeight: 600, color: "#475569" }}>Öncelik</span>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
        >
          {ALL_PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, gridColumn: "1 / -1" }}>
        <span style={{ fontWeight: 600, color: "#475569" }}>Atanan Kişi</span>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
        >
          <option value="">— Atanmamış —</option>
          {platformUserOptions.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, gridColumn: "1 / -1" }}>
        <span style={{ fontWeight: 600, color: "#475569" }}>Çözüm Notu</span>
        <textarea
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          rows={2}
          placeholder="Müşteriye görünecek çözüm notu..."
          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, resize: "vertical" }}
        />
      </label>

      {error && (
        <div style={{ gridColumn: "1 / -1", color: "#dc2626", fontSize: 12 }}>{error}</div>
      )}

      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          İptal
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#1d4ed8", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Satır bileşeni
// ---------------------------------------------------------------------------
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
      style={{
        border: "1px solid",
        borderColor: breached ? "#fca5a5" : "#e2e8f0",
        borderRadius: 10,
        overflow: "hidden",
        background: breached ? "#fff5f5" : "#fff",
      }}
    >
      {/* Başlık satırı */}
      <div
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
        style={{
          padding: "12px 14px",
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto auto",
          alignItems: "center",
          gap: "8px 12px",
          cursor: "pointer",
        }}
      >
        {/* Konu */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", lineHeight: 1.4 }}>
            #{ticket.id} — {ticket.subject}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {ticket.tenant_name ?? "—"} · {ticket.created_by_name ?? "—"} · {formatDate(ticket.created_at)}
          </div>
        </div>

        {/* Kategori */}
        <span style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>
          {CATEGORY_LABELS[ticket.category] ?? ticket.category}
        </span>

        {/* Öncelik */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: PRIORITY_COLORS[ticket.priority] ?? "#64748b",
            whiteSpace: "nowrap",
          }}
        >
          {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
        </span>

        {/* Durum rozeti */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#fff",
            background: STATUS_COLORS[ticket.status] ?? "#64748b",
            borderRadius: 6,
            padding: "2px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {STATUS_LABELS[ticket.status] ?? ticket.status}
        </span>

        {/* SLA / ok */}
        <span style={{ fontSize: 11, color: breached ? "#dc2626" : "#94a3b8", whiteSpace: "nowrap" }}>
          {breached ? "⚠ SLA" : "SLA: " + formatDate(ticket.sla_due_at)}
        </span>
      </div>

      {/* Genişletilmiş panel */}
      {isExpanded && (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: "12px 14px", background: "#f8fafc" }}>
          {ticket.description && (
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 10, lineHeight: 1.6 }}>
              {ticket.description}
            </div>
          )}
          {ticket.resolution_note && (
            <div style={{ fontSize: 12, color: "#15803d", marginBottom: 10, background: "#f0fdf4", borderRadius: 6, padding: "6px 10px" }}>
              <strong>Çözüm Notu:</strong> {ticket.resolution_note}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>
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

// ---------------------------------------------------------------------------
// Ana bileşen
// ---------------------------------------------------------------------------
export function SupportTicketAdminTab() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filtreler
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");

  // Platform personeli listesi (atama için)
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
      .catch(() => {/* sessiz hata */});
  }, []);

  function handleUpdated(updated: SupportTicket) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setExpandedId(null);
  }

  // Özet metrikler
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const breachedCount = tickets.filter(isSlaBreached).length;
  const urgentCount = tickets.filter((t) => t.priority === "urgent" && !["resolved", "closed"].includes(t.status)).length;

  return (
    <div style={{ padding: "20px 0" }}>
      {/* Başlık */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Destek Talepleri</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          Tenant kullanıcılarının platform personeline ilettiği destek talepleri.
        </div>
      </div>

      {/* Özet kartlar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {[
          { label: "Açık", value: openCount, color: "#1d4ed8" },
          { label: "İşlemde", value: inProgressCount, color: "#c2410c" },
          { label: "Acil", value: urgentCount, color: "#dc2626" },
          { label: "SLA Aşımı", value: breachedCount, color: "#b45309" },
          { label: "Toplam", value: tickets.length, color: "#0f172a" },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 16px",
              minWidth: 90,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Filtre çubuğu */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13 }}
        >
          <option value="">Tüm Durumlar</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13 }}
        >
          <option value="">Tüm Kategoriler</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13 }}
        >
          <option value="">Tüm Öncelikler</option>
          {ALL_PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>

        <button
          onClick={() => void loadTickets()}
          style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          ↻ Yenile
        </button>

        <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>
          {tickets.length} kayıt
        </span>
      </div>

      {/* Hata */}
      {error && (
        <div style={{ borderRadius: 8, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Yükleniyor */}
      {loading && (
        <div style={{ padding: 24, color: "#64748b", textAlign: "center" }}>Yükleniyor...</div>
      )}

      {/* Talep listesi */}
      {!loading && tickets.length === 0 && !error && (
        <div style={{ padding: 24, color: "#94a3b8", textAlign: "center" }}>
          Bu filtreyle eşleşen destek talebi bulunamadı.
        </div>
      )}

      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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

/**
 * SupportTicketWidget — Tenant kullanıcısının platform personeline destek talebi açmasını sağlar.
 * Floating veya embed modunda kullanılabilir.
 */
import { useState } from "react";
import type { CSSProperties } from "react";
import { createSupportTicket, getMySupportTickets, type SupportTicket } from "../services/admin.service";
import "./SupportTicketWidget.css";

type Mode = "closed" | "form" | "list";

const CATEGORY_OPTIONS = [
  { value: "general", label: "Genel" },
  { value: "onboarding", label: "Kurulum & Aktivasyon" },
  { value: "billing", label: "Fatura & Ödeme" },
  { value: "technical", label: "Teknik Sorun" },
  { value: "account", label: "Hesap & Yetki" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Düşük" },
  { value: "medium", label: "Orta" },
  { value: "high", label: "Yüksek" },
  { value: "urgent", label: "Acil" },
];

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

interface SupportTicketWidgetProps {
  /** Kaynak: nerede açıldı */
  source?: string;
  /** Embed mod: floating buton gösterme, direkt formu göster */
  embed?: boolean;
  /** Önceden doldurulan konu */
  prefilledSubject?: string;
  /** Önceden doldurulan kategori */
  prefilledCategory?: string;
  /** Form gönderildikten sonra çağrılır */
  onCreated?: (ticket: SupportTicket) => void;
}

export default function SupportTicketWidget({
  source = "tenant_portal",
  embed = false,
  prefilledSubject = "",
  prefilledCategory = "general",
  onCreated,
}: SupportTicketWidgetProps) {
  const [mode, setMode] = useState<Mode>(embed ? "form" : "closed");
  const [subject, setSubject] = useState(prefilledSubject);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(prefilledCategory);
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTicket, setSuccessTicket] = useState<SupportTicket | null>(null);
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim()) {
      setError("Konu alanı zorunludur.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ticket = await createSupportTicket({ subject: subject.trim(), description: description.trim() || undefined, category, priority, source });
      setSuccessTicket(ticket);
      setSubject("");
      setDescription("");
      setCategory("general");
      setPriority("medium");
      onCreated?.(ticket);
    } catch {
      setError("Destek talebi oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenList = async () => {
    setMode("list");
    setLoadingList(true);
    try {
      const tickets = await getMySupportTickets();
      setMyTickets(tickets);
    } catch {
      // sessiz hata
    } finally {
      setLoadingList(false);
    }
  };

  if (!embed && mode === "closed") {
    return null; // HelpCenter tarafından kontrol edilir
  }

  if (successTicket) {
    return (
      <div className="stw-success">
        <div className="stw-success__title">✅ Destek Talebiniz Alındı</div>
        <div className="stw-success__body">
          Talep No: <strong>#{successTicket.id}</strong> — Konunuz: <strong>{successTicket.subject}</strong>
        </div>
        <div className="stw-success__sla">
          Platform ekibi en kısa sürede sizinle iletişime geçecek.
          SLA süreniz:{" "}
          <strong>
            {successTicket.sla_due_at
              ? new Date(successTicket.sla_due_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
              : "—"}
          </strong>
        </div>
        <div className="stw-success__actions">
          <button
            type="button"
            onClick={() => { setSuccessTicket(null); setMode(embed ? "form" : "closed"); }}
            className="stw-success__ok-btn"
          >
            Tamam
          </button>
          <button
            type="button"
            onClick={() => { setSuccessTicket(null); void handleOpenList(); }}
            className="stw-success__list-btn"
          >
            Tüm Taleplerim
          </button>
        </div>
      </div>
    );
  }

  if (mode === "list") {
    return (
      <div className="stw-list">
        <div className="stw-list__header">
          <div className="stw-list__title">Destek Taleplerim</div>
          <button
            type="button"
            onClick={() => setMode(embed ? "form" : "closed")}
            className="stw-list__back-btn"
          >
            ← Geri
          </button>
        </div>
        {loadingList ? (
          <div className="stw-list__loading">Yükleniyor...</div>
        ) : myTickets.length === 0 ? (
          <div className="stw-list__empty">Henüz destek talebiniz bulunmuyor.</div>
        ) : (
          <div className="stw-ticket-list">
            {myTickets.map((t) => (
              <div key={t.id} className="stw-ticket-card">
                <div className="stw-ticket-card__row">
                  <div className="stw-ticket-card__subject">#{t.id} — {t.subject}</div>
                  <span
                    className="stw-status-badge"
                    style={{ "--stw-status-color": STATUS_COLORS[t.status] || "#0f172a" } as CSSProperties}
                  >
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                </div>
                <div className="stw-ticket-card__meta">
                  {CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label || t.category} •{" "}
                  {new Date(t.created_at).toLocaleDateString("tr-TR")}
                  {t.assigned_to_name ? ` • Sorumlu: ${t.assigned_to_name}` : ""}
                </div>
                {t.resolution_note && (
                  <div className="stw-ticket-card__resolution">
                    Çözüm: {t.resolution_note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => { setMode(embed ? "form" : "closed"); setSuccessTicket(null); }}
          className="stw-list__new-btn"
        >
          + Yeni Talep Oluştur
        </button>
      </div>
    );
  }

  // Form modu
  return (
    <div className="stw-form">
      <div className="stw-form__header">
        <div className="stw-form__title">Destek Talebi Oluştur</div>
        <button
          type="button"
          onClick={() => void handleOpenList()}
          className="stw-form__list-btn"
        >
          Taleplerim →
        </button>
      </div>

      {error && (
        <div className="stw-form__error">
          {error}
        </div>
      )}

      <label className="stw-form__label">
        Konu *
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Sorununuzu kısaca özetleyin"
          maxLength={200}
          className="stw-form__input"
        />
      </label>

      <div className="stw-form__2col">
        <label className="stw-form__label">
          Kategori
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="stw-form__select"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="stw-form__label">
          Öncelik
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="stw-form__select"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="stw-form__label">
        Açıklama (isteğe bağlı)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Sorununuzu daha ayrıntılı açıklayın..."
          rows={3}
          className="stw-form__textarea"
        />
      </label>

      <div className="stw-form__actions">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving}
          className={`stw-form__submit-btn${saving ? " stw-form__submit-btn--saving" : ""}`}
        >
          {saving ? "Gönderiliyor..." : "Talebi Gönder"}
        </button>
        {!embed && (
          <button
            type="button"
            onClick={() => setMode("closed")}
            className="stw-form__cancel-btn"
          >
            İptal
          </button>
        )}
      </div>
    </div>
  );
}

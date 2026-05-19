/**
 * SupportTicketWidget — Tenant kullanıcısının platform personeline destek talebi açmasını sağlar.
 * Floating veya embed modunda kullanılabilir.
 */
import { useState } from "react";
import { createSupportTicket, getMySupportTickets, type SupportTicket } from "../services/admin.service";

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
      <div style={{ borderRadius: 16, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: 20, display: "grid", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#15803d" }}>✅ Destek Talebiniz Alındı</div>
        <div style={{ color: "#166534", fontSize: 14 }}>
          Talep No: <strong>#{successTicket.id}</strong> — Konunuz: <strong>{successTicket.subject}</strong>
        </div>
        <div style={{ color: "#166534", fontSize: 13 }}>
          Platform ekibi en kısa sürede sizinle iletişime geçecek.
          SLA süreniz:{" "}
          <strong>
            {successTicket.sla_due_at
              ? new Date(successTicket.sla_due_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
              : "—"}
          </strong>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => { setSuccessTicket(null); setMode(embed ? "form" : "closed"); }}
            style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#15803d", color: "white", fontWeight: 700, cursor: "pointer" }}
          >
            Tamam
          </button>
          <button
            type="button"
            onClick={() => { setSuccessTicket(null); void handleOpenList(); }}
            style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #86efac", background: "white", color: "#166534", fontWeight: 700, cursor: "pointer" }}
          >
            Tüm Taleplerim
          </button>
        </div>
      </div>
    );
  }

  if (mode === "list") {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Destek Taleplerim</div>
          <button
            type="button"
            onClick={() => setMode(embed ? "form" : "closed")}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", color: "#334155", fontWeight: 700, cursor: "pointer" }}
          >
            ← Geri
          </button>
        </div>
        {loadingList ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>Yükleniyor...</div>
        ) : myTickets.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 13, padding: "12px 0" }}>Henüz destek talebiniz bulunmuyor.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {myTickets.map((t) => (
              <div key={t.id} style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "10px 14px", display: "grid", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>#{t.id} — {t.subject}</div>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: "#e0f2fe", color: STATUS_COLORS[t.status] || "#0f172a", fontSize: 11, fontWeight: 800 }}>
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  {CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label || t.category} •{" "}
                  {new Date(t.created_at).toLocaleDateString("tr-TR")}
                  {t.assigned_to_name ? ` • Sorumlu: ${t.assigned_to_name}` : ""}
                </div>
                {t.resolution_note && (
                  <div style={{ color: "#15803d", fontSize: 12, borderRadius: 8, background: "#f0fdf4", padding: "6px 8px", marginTop: 4 }}>
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
          style={{ justifySelf: "start", padding: "8px 16px", borderRadius: 10, border: "none", background: "#1d4ed8", color: "white", fontWeight: 700, cursor: "pointer" }}
        >
          + Yeni Talep Oluştur
        </button>
      </div>
    );
  }

  // Form modu
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Destek Talebi Oluştur</div>
        <button
          type="button"
          onClick={() => void handleOpenList()}
          style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #dbe3ee", background: "white", color: "#334155", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          Taleplerim →
        </button>
      </div>

      {error && (
        <div style={{ borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", color: "#991b1b", fontSize: 13 }}>
          {error}
        </div>
      )}

      <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 700, color: "#334155" }}>
        Konu *
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Sorununuzu kısaca özetleyin"
          maxLength={200}
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#0f172a", background: "white", fontFamily: "inherit" }}
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 700, color: "#334155" }}>
          Kategori
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#0f172a", background: "white" }}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 700, color: "#334155" }}>
          Öncelik
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#0f172a", background: "white" }}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 700, color: "#334155" }}>
        Açıklama (isteğe bağlı)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Sorununuzu daha ayrıntılı açıklayın..."
          rows={3}
          style={{ resize: "vertical", padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#0f172a", background: "white", fontFamily: "inherit" }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving}
          style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: saving ? "#93c5fd" : "#1d4ed8", color: "white", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer" }}
        >
          {saving ? "Gönderiliyor..." : "Talebi Gönder"}
        </button>
        {!embed && (
          <button
            type="button"
            onClick={() => setMode("closed")}
            style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #dbe3ee", background: "white", color: "#334155", fontWeight: 700, cursor: "pointer" }}
          >
            İptal
          </button>
        )}
      </div>
    </div>
  );
}

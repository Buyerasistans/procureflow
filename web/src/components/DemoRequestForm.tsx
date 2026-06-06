import { useState } from "react";
import { http } from "../lib/http";
import "./DemoRequestForm.css";

interface Props {
  audience?: "strategic" | "supplier" | "channel" | "employer" | "seeker";
  source?: string;
  accentColor?: string;
}

export default function DemoRequestForm({ audience = "strategic", source = "role_landing", accentColor = "#134E37" }: Props) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", company: "", phone: "" });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await http.post("/onboarding/commercial-requests", {
        request_type: "demo_request",
        audience,
        source_surface: source,
        requester_name: form.fullName.trim(),
        requester_email: form.email.trim(),
        company_name: form.company.trim() || undefined,
        phone: form.phone.trim() || undefined,
        notes: `Demo talebi — kaynak: ${source}`,
      });
      setSent(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Talep kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="drf-sent">
        ✅ <strong>Talebiniz alındı!</strong> En kısa sürede size geri dönüş yapacağız.
      </div>
    );
  }

  return (
    <div className="drf-root">
      <div className="drf-title">Demo Talebi</div>
      <form onSubmit={handleSubmit} className="drf-form">
        <input required value={form.fullName} onChange={set("fullName")} placeholder="Ad Soyad *" className="drf-input" />
        <input required type="email" value={form.email} onChange={set("email")} placeholder="İş e-postası *" className="drf-input" />
        <input value={form.company} onChange={set("company")} placeholder="Firma" className="drf-input" />
        <input value={form.phone} onChange={set("phone")} placeholder="Telefon" className="drf-input" />
        {err && <div className="drf-error">{err}</div>}
        <button
          type="submit"
          className="drf-btn"
          disabled={busy}
          style={{ "--drf-accent": accentColor } as React.CSSProperties}
        >
          {busy ? "Gönderiliyor..." : "Demo Talebi Gönder →"}
        </button>
      </form>
    </div>
  );
}

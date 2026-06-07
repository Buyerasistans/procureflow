import { useState, useEffect, useCallback } from "react";
import { http } from "../lib/http";

interface MarketingPlan {
  id: number;
  supplier_id: number;
  headline: string;
  description?: string | null;
  categories: string[];
  target_segments: string[];
  campaign_id?: number | null;
  visibility: "draft" | "active" | "paused";
  is_featured: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  created_at: string;
  updated_at?: string | null;
}

const VISIBILITY_LABELS: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  paused: "Durduruldu",
};

const SEGMENT_OPTS = [
  { value: "stratejik_partner", label: "Stratejik Partner" },
  { value: "platform_network", label: "Platform Ağı" },
  { value: "kanal", label: "İş Ortağı (Kanal)" },
  { value: "all", label: "Tümü" },
];

const EMPTY_FORM = {
  headline: "",
  description: "",
  categories: "",
  target_segments: [] as string[],
  visibility: "draft" as "draft" | "active" | "paused",
  is_featured: false,
};

interface Props {
  supplierId: number;
  canEdit: boolean;
}

export function SupplierMarketingPlansSection({ supplierId, canEdit }: Props) {
  const [plans, setPlans] = useState<MarketingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await http.get<MarketingPlan[]>(`/suppliers/${supplierId}/marketing-plans`);
      setPlans(res.data);
    } catch {
      setError("Pazarlama planları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setShowForm(true);
    setError(null);
  }

  function openEdit(p: MarketingPlan) {
    setForm({
      headline: p.headline,
      description: p.description ?? "",
      categories: p.categories.join(", "),
      target_segments: p.target_segments,
      visibility: p.visibility,
      is_featured: p.is_featured,
    });
    setEditId(p.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      headline: form.headline,
      description: form.description || null,
      categories: form.categories.split(",").map((s) => s.trim()).filter(Boolean),
      target_segments: form.target_segments,
      visibility: form.visibility,
      is_featured: form.is_featured,
    };
    try {
      if (editId) {
        await http.put(`/suppliers/${supplierId}/marketing-plans/${editId}`, payload);
      } else {
        await http.post(`/suppliers/${supplierId}/marketing-plans`, payload);
      }
      setSuccess(editId ? "Plan güncellendi." : "Plan oluşturuldu.");
      setShowForm(false);
      void load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt hatası.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(planId: number) {
    if (!confirm("Bu pazarlama planını silmek istediğinizden emin misiniz?")) return;
    try {
      await http.delete(`/suppliers/${supplierId}/marketing-plans/${planId}`);
      void load();
    } catch {
      setError("Silme hatası.");
    }
  }

  function toggleSegment(val: string) {
    setForm((prev) => ({
      ...prev,
      target_segments: prev.target_segments.includes(val)
        ? prev.target_segments.filter((s) => s !== val)
        : [...prev.target_segments, val],
    }));
  }

  return (
    <div className="smps">
      {success && <div className="smps-alert smps-alert--success">{success}</div>}
      {error && <div className="smps-alert smps-alert--error">{error}</div>}

      {loading ? (
        <div className="smps-empty">Yükleniyor…</div>
      ) : plans.length === 0 && !showForm ? (
        <div className="smps-empty">Henüz pazarlama planı tanımlanmamış.</div>
      ) : null}

      {plans.map((p) => (
        <div key={p.id} className={`smps-card smps-card--${p.visibility}`}>
          <div className="smps-card__head">
            <div>
              <span className="smps-card__headline">{p.headline}</span>
              {p.is_featured && <span className="smps-badge smps-badge--featured">Öne Çıkan</span>}
              <span className={`smps-badge smps-badge--vis smps-badge--${p.visibility}`}>
                {VISIBILITY_LABELS[p.visibility] ?? p.visibility}
              </span>
            </div>
            {canEdit && (
              <div className="smps-card__actions">
                <button type="button" className="smps-btn smps-btn--sm" onClick={() => openEdit(p)}>Düzenle</button>
                <button type="button" className="smps-btn smps-btn--sm smps-btn--danger" onClick={() => void handleDelete(p.id)}>Sil</button>
              </div>
            )}
          </div>
          {p.description && <p className="smps-card__desc">{p.description}</p>}
          <div className="smps-card__meta">
            {p.categories.length > 0 && (
              <span>Kategori: {p.categories.join(", ")}</span>
            )}
            {p.target_segments.length > 0 && (
              <span>Hedef: {p.target_segments.map((s) => SEGMENT_OPTS.find((o) => o.value === s)?.label ?? s).join(", ")}</span>
            )}
          </div>
        </div>
      ))}

      {canEdit && !showForm && (
        <button type="button" className="smps-btn" onClick={openCreate}>+ Yeni Pazarlama Planı</button>
      )}

      {showForm && (
        <form className="smps-form" onSubmit={(e) => void handleSave(e)}>
          <h4 className="smps-form__title">{editId ? "Planı Düzenle" : "Yeni Plan"}</h4>
          <div className="smps-form__group">
            <label className="smps-form__label">Başlık *</label>
            <input className="smps-form__input" required value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
          </div>
          <div className="smps-form__group">
            <label className="smps-form__label">Açıklama</label>
            <textarea className="smps-form__textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="smps-form__group">
            <label className="smps-form__label">Kategoriler (virgülle ayır)</label>
            <input className="smps-form__input" value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} placeholder="Yazılım, Hizmet, Donanım" />
          </div>
          <div className="smps-form__group">
            <label className="smps-form__label">Hedef Kitle</label>
            <div className="smps-segments">
              {SEGMENT_OPTS.map((opt) => (
                <label key={opt.value} className="smps-seg-check">
                  <input type="checkbox" checked={form.target_segments.includes(opt.value)} onChange={() => toggleSegment(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="smps-form__row">
            <div className="smps-form__group">
              <label className="smps-form__label">Görünürlük</label>
              <select className="smps-form__select" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as "draft" | "active" | "paused" })}>
                <option value="draft">Taslak</option>
                <option value="active">Aktif</option>
                <option value="paused">Durduruldu</option>
              </select>
            </div>
            <div className="smps-form__group smps-form__group--check">
              <label className="smps-form__label smps-form__label--check">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
                Öne Çıkan
              </label>
            </div>
          </div>
          <div className="smps-form__actions">
            <button type="submit" className="smps-btn" disabled={saving}>{saving ? "Kaydediliyor…" : (editId ? "Güncelle" : "Oluştur")}</button>
            <button type="button" className="smps-btn smps-btn--secondary" onClick={() => setShowForm(false)}>İptal</button>
          </div>
        </form>
      )}
    </div>
  );
}

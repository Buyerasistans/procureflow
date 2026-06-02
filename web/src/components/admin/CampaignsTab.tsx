/**
 * CampaignsAdminTab — Kampanyalar & Landing
 * İki alt sekme: Kampanya Programları (master/detail) ve Landing & Davet Linkleri.
 * Ödeme sağlayıcı ayarları en altta ayrı Section olarak korunur.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Section, StatCard } from "../../pages/admin/AdminTabContent";
import {
  applyCampaignGrant,
  createCampaignProgram,
  getCampaignPrograms,
  getPaymentProviderSettings,
  updatePaymentProviderSetting,
  type CampaignProgram,
  type PaymentProviderSettingItem,
} from "../../services/admin.service";
import "./CampaignsTab.css";

// ── Display metadata ──────────────────────────────────────────────────────────

const AUD_META: Record<string, { label: string; color: string; desc: string }> = {
  strategic: { label: "Stratejik Partner", color: "#1d4ed8", desc: "Üyelik, partner getirme, abonelik avantajları" },
  supplier:  { label: "Tedarikçi",         color: "#be123c", desc: "Havuza geçiş, tedarikçi getirme, teklif aktivitesi" },
  channel:   { label: "İş Ortağı",         color: "#047857", desc: "Tedarikçi / stratejik partner getirme, komisyon" },
  career:    { label: "Kariyer & Yetenek", color: "#7c3aed", desc: "İlan hakkı, proje bazlı personel" },
};

const GOAL_META: Record<string, { label: string; unit: string }> = {
  partner_signup:              { label: "Üye olma",                  unit: "üyelik"      },
  partner_referral_activated:  { label: "Partner getirme",            unit: "partner"     },
  pool_join:                   { label: "Havuza katılma",             unit: "katılım"     },
  supplier_referral_activated: { label: "Tedarikçi getirme",          unit: "tedarikçi"   },
  quote_submissions:           { label: "Teklif verme",               unit: "teklif"      },
  channel_supplier_referral:   { label: "Tedarikçi getirme",          unit: "tedarikçi"   },
  mixed_referral:              { label: "Karma getirme",              unit: "kayıt"       },
  job_posts:                   { label: "İlan yayınlama",             unit: "ilan"        },
  talent_hire:                 { label: "Proje bazlı işe alım",       unit: "işe alım"    },
};

const GOAL_BY_AUD: Record<string, string[]> = {
  strategic: ["partner_signup", "partner_referral_activated"],
  supplier:  ["pool_join", "supplier_referral_activated", "quote_submissions"],
  channel:   ["channel_supplier_referral", "mixed_referral"],
  career:    ["job_posts", "talent_hire"],
};

const REWARD_LABEL: Record<string, string> = {
  discount_percent:     "Abonelik indirimi",
  free_months:          "Ücretsiz ay",
  commission_bonus:     "Komisyon üstü",
  quote_bonus:          "Teklif bonusu",
  special_list_access:  "Özel liste erişimi",
  strategic_quote_access: "Stratejik RFQ erişimi",
  project_visibility:   "Proje görünürlüğü",
  permission_override:  "Yetki yükseltme",
  pool_priority:        "Havuz öncelik",
  job_post_credits:     "Ek ilan hakkı",
  talent_discount:      "Proje bazlı personel indirimi",
};

const REWARD_BY_AUD: Record<string, string[]> = {
  strategic: ["discount_percent", "free_months", "commission_bonus", "job_post_credits", "talent_discount"],
  supplier:  ["quote_bonus", "special_list_access", "strategic_quote_access", "project_visibility", "pool_priority"],
  channel:   ["commission_bonus", "project_visibility", "permission_override", "strategic_quote_access"],
  career:    ["job_post_credits", "talent_discount", "discount_percent", "permission_override"],
};

const CAMP_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif",   cls: "ok"   },
  draft:  { label: "Taslak",  cls: "wait" },
  ended:  { label: "Bitti",   cls: "off"  },
};

const TARGET_LABEL: Record<string, string> = {
  supplier: "Tedarikçi", partner: "Stratejik partner",
  channel:  "İş ortağı",  career: "Kariyer", mixed: "Karma",
};

// ── Mock data for landing links — TODO(data): wire to real API ────────────────

const MOCK_LINKS = [
  { id: 1, code: "VEKTOR2026", name: "Vektör · Partner daveti", campaign: "Partner Getirene Bonus Komisyon", landing: "/landing/partner", target: "partner", clicks: 1840, signups: 12, active: true },
  { id: 2, code: "PARTNER-GETIR", name: "Stratejik partner referansı", campaign: "Stratejik Partner Getir, Kazan", landing: "/landing/strategic", target: "partner", clicks: 1320, signups: 7, active: true },
  { id: 3, code: "TED-DAVET", name: "Tedarikçi davet kampanyası", campaign: "5 Tedarikçi Getir, Ayrıcalık Kazan", landing: "/landing/supplier", target: "supplier", clicks: 1240, signups: 9, active: true },
  { id: 4, code: "HAVUZA-GEC", name: "Havuza geçiş daveti", campaign: "Havuza Geç, Öncelikli Teklif", landing: "/landing/supplier", target: "supplier", clicks: 880, signups: 5, active: true },
  { id: 5, code: "BAHAR-LP", name: "Bahar genel landing", campaign: null as string | null, landing: "/landing/campaign", target: "mixed", clicks: 3100, signups: 21, active: true },
  { id: 6, code: "KARIYER-LP", name: "Kariyer kampanya sayfası", campaign: null as string | null, landing: "/landing/career", target: "career", clicks: 410, signups: 2, active: false },
];

const MOCK_UTM = [
  { label: "Google Ads",      count: 3100, color: "#1d4ed8" },
  { label: "İş ortağı linki", count: 2720, color: "#047857" },
  { label: "E-posta",         count: 2560, color: "#7c3aed" },
  { label: "LinkedIn",        count: 410,  color: "#0e7490" },
  { label: "Doğrudan",        count: 640,  color: "#64748b" },
];

const MOCK_INTENTS = [
  { label: "campaign (kampanya)", count: 5840, color: "#be123c" },
  { label: "corporate (kurumsal)", count: 2100, color: "#1d4ed8" },
  { label: "global",              count: 980,  color: "#047857" },
  { label: "knowledge (bilgi)",   count: 420,  color: "#7c3aed" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function clNum(n: number): string {
  return Number(n).toLocaleString("tr-TR");
}

function goalUnit(triggerEvent: string): string {
  return GOAL_META[triggerEvent]?.unit ?? "";
}

function goalLabel(triggerEvent: string): string {
  return GOAL_META[triggerEvent]?.label ?? triggerEvent;
}

function rewardLabel(rewardType: string): string {
  return REWARD_LABEL[rewardType] ?? rewardType;
}

function audMeta(audType: string): { label: string; color: string } {
  return AUD_META[audType] ?? { label: audType, color: "#64748b" };
}

function campStatusMeta(status: string): { label: string; cls: string } {
  return CAMP_STATUS[status] ?? { label: status, cls: "off" };
}

function landingPath(aud: string): string {
  const MAP: Record<string, string> = {
    strategic: "strategic", supplier: "supplier", channel: "partner", career: "career",
  };
  return "/landing/" + (MAP[aud] ?? aud);
}

function audiencePanel(aud: string): string {
  if (aud === "strategic") return "Stratejik partner paneli · Üyelik & Avantajlar";
  if (aud === "supplier")  return "Tedarikçi portalı · Kampanyalar sekmesi";
  if (aud === "channel")   return "İş ortağı paneli · /profile/campaigns";
  return "Stratejik partner paneli · Kariyer & İlanlar";
}

// ── Wizard helpers ────────────────────────────────────────────────────────────

function clSlug(s: string): string {
  return (s || "")
    .toLocaleUpperCase("tr")
    .replace(/[^A-Z0-9ÇĞİÖŞÜ]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

interface WizardRule { threshold: number; reward: string; value: string }

interface WizardState {
  step: 1 | 2 | 3;
  audience: string;
  name: string;
  code: string;
  codeEdited: boolean;
  goal: string;
  starts: string;
  ends: string;
  desc: string;
  is_public: boolean;
  publishNow: boolean;
  rules: WizardRule[];
}

// ── CampaignWizard ────────────────────────────────────────────────────────────

interface WizardProps {
  onClose: () => void;
  onCreate: (c: CampaignProgram) => void;
  setError: (msg: string | null) => void;
}

function CampaignWizard({ onClose, onCreate, setError }: WizardProps) {
  const [w, setW] = useState<WizardState>({
    step: 1, audience: "", name: "", code: "", codeEdited: false,
    goal: "", starts: "", ends: "", desc: "", is_public: true, publishNow: false, rules: [],
  });
  const [submitting, setSubmitting] = useState(false);

  function up(patch: Partial<WizardState>) { setW((p) => ({ ...p, ...patch })); }

  function pickAudience(aud: string) {
    const goals = GOAL_BY_AUD[aud] ?? [];
    up({ audience: aud, goal: goals[0] ?? "", rules: [{ threshold: 1, reward: (REWARD_BY_AUD[aud] ?? [])[0] ?? "", value: "" }] });
  }

  function setName(v: string) { up({ name: v, code: w.codeEdited ? w.code : clSlug(v) }); }
  function setRule(i: number, k: keyof WizardRule, v: string | number) {
    up({ rules: w.rules.map((r, j) => j === i ? { ...r, [k]: k === "threshold" ? (Number(v) || 0) : v } : r) });
  }
  function addRule() {
    up({ rules: [...w.rules, { threshold: 5, reward: (REWARD_BY_AUD[w.audience] ?? [])[0] ?? "", value: "" }] });
  }
  function delRule(i: number) { up({ rules: w.rules.filter((_, j) => j !== i) }); }

  const unit = goalUnit(w.goal);
  const step2Valid = w.name.trim().length > 0 && w.rules.length > 0 && w.rules.every((r) => r.threshold > 0);

  async function submit() {
    if (!step2Valid) return;
    setSubmitting(true);
    try {
      const camp = await createCampaignProgram({
        code: w.code || clSlug(w.name) || "KAMPANYA",
        name: w.name.trim(),
        description: w.desc.trim() || undefined,
        audience_type: w.audience,
        trigger_event: w.goal,
        status: w.publishNow ? "active" : "draft",
        is_public: w.is_public,
        rules: w.rules
          .filter((r) => r.threshold > 0)
          .sort((a, b) => a.threshold - b.threshold)
          .map((r, idx) => ({
            threshold_count: r.threshold,
            reward_type: r.reward,
            reward_value_json: r.value.trim() ? JSON.stringify({ label: r.value.trim() }) : undefined,
            sort_order: idx + 1,
          })),
      });
      onCreate(camp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kampanya oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  }

  const STEPS = ["Kitle & Hedef", "Kurallar & Detay", "Önizleme & Yayın"];

  return (
    <div className="cl-modal__backdrop" onClick={onClose}>
      <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal__hd">
          <div>
            <b>Yeni Kampanya</b>
            <span>kazanım programı oluştur</span>
          </div>
          <button type="button" className="cl-mini" onClick={onClose}>Kapat</button>
        </div>

        <div className="cl-steps">
          {STEPS.map((s, i) => (
            <div key={i} className={"cl-step" + (w.step === i + 1 ? " on" : w.step > i + 1 ? " done" : "")}>
              <span className="cl-step__n">{w.step > i + 1 ? "✓" : i + 1}</span>{s}
            </div>
          ))}
        </div>

        <div className="cl-modal__bd">
          {/* ADIM 1 */}
          {w.step === 1 && (
            <>
              <p className="cl-muted">Kampanyanın hedef kitlesini ve hedefini seç.</p>
              <div className="cl-aud-grid">
                {Object.keys(AUD_META).map((k) => {
                  const m = AUD_META[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      className={"cl-aud-card" + (w.audience === k ? " on" : "")}
                      style={w.audience === k ? { borderColor: m.color, boxShadow: "0 0 0 2px " + m.color + "33" } : {}}
                      onClick={() => pickAudience(k)}
                    >
                      <span className="cl-aud-card__ico" style={{ background: m.color + "1f", color: m.color }}>●</span>
                      <b>{m.label}</b>
                      <span>{m.desc}</span>
                    </button>
                  );
                })}
              </div>

              {w.audience && (
                <>
                  <div className="cl-tpl-hd">Hedef seç — {AUD_META[w.audience].label}</div>
                  <div className="cl-sel-goals">
                    {(GOAL_BY_AUD[w.audience] ?? []).map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={"cl-goal-opt" + (w.goal === g ? " on" : "")}
                        style={w.goal === g ? { borderColor: AUD_META[w.audience].color, background: AUD_META[w.audience].color + "1a" } : {}}
                        onClick={() => up({ goal: g })}
                      >
                        <b>{GOAL_META[g]?.label ?? g}</b>
                        <span>birim: {GOAL_META[g]?.unit ?? g}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ADIM 2 */}
          {w.step === 2 && (
            <>
              <span className="cl-pickbadge" style={{ background: AUD_META[w.audience].color + "1f", color: AUD_META[w.audience].color }}>
                {AUD_META[w.audience].label}
              </span>
              <div className="cl-row2">
                <label className="cl-field">
                  <span className="cl-field__label">Kampanya adı <i>zorunlu</i></span>
                  <input className="cl-input" value={w.name} onChange={(e) => setName(e.target.value)} placeholder="örn. Stratejik Partner Getir, Kazan" />
                </label>
                <label className="cl-field">
                  <span className="cl-field__label">Kod</span>
                  <input className="cl-input cl-input--mono" value={w.code} onChange={(e) => up({ code: clSlug(e.target.value), codeEdited: true })} placeholder="OTOMATİK" />
                </label>
              </div>
              <div className="cl-row2">
                <label className="cl-field">
                  <span className="cl-field__label">Başlangıç</span>
                  <input className="cl-input cl-input--mono" value={w.starts} onChange={(e) => up({ starts: e.target.value })} placeholder="01.03.2026" />
                </label>
                <label className="cl-field">
                  <span className="cl-field__label">Bitiş</span>
                  <input className="cl-input cl-input--mono" value={w.ends} onChange={(e) => up({ ends: e.target.value })} placeholder="30.06.2026" />
                </label>
              </div>
              <label className="cl-field">
                <span className="cl-field__label">Açıklama</span>
                <input className="cl-input" value={w.desc} onChange={(e) => up({ desc: e.target.value })} placeholder="Kampanyanın amacı ve koşulları" />
              </label>
              <label className="cl-field">
                <span className="cl-field__label">
                  <input type="checkbox" checked={w.is_public} onChange={(e) => up({ is_public: e.target.checked })} />
                  {" "}Herkese açık (landing'de yayınla)
                </span>
              </label>

              <div className="cl-field">
                <span className="cl-field__label">Hedef & ödül kuralları <i>{unit} eşiği → ödül</i></span>
                <div className="cl-rb">
                  {w.rules.map((r, i) => (
                    <div key={i} className="cl-rb-row">
                      <div className="cl-rb-th">
                        <input className="cl-input cl-input--mono cl-input--sm" type="number" min={1} value={r.threshold} aria-label="Eşik sayısı" onChange={(e) => setRule(i, "threshold", e.target.value)} />
                        <span>{unit}</span>
                      </div>
                      <span className="cl-rb-arrow">→</span>
                      <select className="cl-input" value={r.reward} onChange={(e) => setRule(i, "reward", e.target.value)} aria-label="Ödül tipi">
                        {(REWARD_BY_AUD[w.audience] ?? []).map((k) => (
                          <option key={k} value={k}>{REWARD_LABEL[k] ?? k}</option>
                        ))}
                      </select>
                      <input className="cl-input" value={r.value} onChange={(e) => setRule(i, "value", e.target.value)} placeholder="Ödül açıklaması" />
                      <button type="button" className="cl-mini cl-mini--danger" onClick={() => delRule(i)} disabled={w.rules.length <= 1}>×</button>
                    </div>
                  ))}
                  <button type="button" className="cl-rb-add" onClick={addRule}>+ Kademe ekle</button>
                </div>
              </div>
            </>
          )}

          {/* ADIM 3 */}
          {w.step === 3 && (
            <div className="cl-preview">
              <div className="cl-preview__card">
                <div className="cl-preview__top">
                  <span className="cl-aud-pill" style={{ background: AUD_META[w.audience].color + "1f", color: AUD_META[w.audience].color }}>
                    {AUD_META[w.audience].label}
                  </span>
                  <span className={"cl-badge cl-badge--" + (w.publishNow ? "ok" : "wait")}>{w.publishNow ? "Yayınlanacak" : "Taslak"}</span>
                </div>
                <h3 className="cl-preview__title">{w.name || "Adsız kampanya"}</h3>
                <p className="cl-preview__desc">{w.desc || "—"}</p>
                <div className="cl-preview__line">
                  <b>Hedef:</b> {goalLabel(w.goal)} · {w.starts || "—"} → {w.ends || "—"}
                </div>
                <div className="cl-preview__rules">
                  {w.rules.map((r, i) => (
                    <div key={i} className="cl-preview__rule">
                      <span className="cl-preview__th">{r.threshold} {unit}</span>
                      {" → "}<b>{rewardLabel(r.reward)}</b>{" "}<i>{r.value}</i>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="cl-modal__ft">
          {w.step === 3 && (
            <label className="cl-pubnow">
              <input type="checkbox" checked={w.publishNow} onChange={(e) => up({ publishNow: e.target.checked })} />
              {" "}Hemen yayına al
            </label>
          )}
          <div style={{ flex: 1 }} />
          {w.step > 1
            ? <button type="button" className="cl-btn cl-btn--ghost" onClick={() => up({ step: (w.step - 1) as 1 | 2 | 3 })}>Geri</button>
            : <button type="button" className="cl-btn cl-btn--ghost" onClick={onClose}>İptal</button>
          }
          {w.step === 1 && (
            <button type="button" className="cl-btn cl-btn--primary" disabled={!w.audience || !w.goal} onClick={() => up({ step: 2 })}>
              İleri
            </button>
          )}
          {w.step === 2 && (
            <button type="button" className="cl-btn cl-btn--primary" disabled={!step2Valid} onClick={() => up({ step: 3 })}>
              İleri · Önizleme
            </button>
          )}
          {w.step === 3 && (
            <button type="button" className="cl-btn cl-btn--primary" disabled={!step2Valid || submitting} onClick={() => void submit()}>
              {submitting ? "Oluşturuluyor…" : w.publishNow ? "Oluştur & Yayınla" : "Taslak oluştur"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CampaignsAdminTab ─────────────────────────────────────────────────────────

export function CampaignsAdminTab() {
  // ── Server state ──────────────────────────────────────────────────────────
  const [campaigns, setCampaigns]   = useState<CampaignProgram[]>([]);
  const [providers, setProviders]   = useState<PaymentProviderSettingItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [subTab, setSubTab]         = useState<"campaigns" | "landing">("campaigns");
  const [audFilter, setAudFilter]   = useState<string>("all");
  const [selId, setSelId]           = useState<number | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Local-only status overrides (not persisted — TODO(data): add PATCH /admin/campaigns/:id)
  const [statusOverrides, setStatusOverrides] = useState<Record<number, string>>({});
  const [publicOverrides, setPublicOverrides] = useState<Record<number, boolean>>({});

  // ── Landing links local state (TODO(data): wire to real API) ──────────────
  const [links, setLinks] = useState(MOCK_LINKS);

  // ── Payment provider state ────────────────────────────────────────────────
  const [selectedProviderCode, setSelectedProviderCode] = useState<string>("");
  const [providerDraft, setProviderDraft]               = useState<Record<string, string>>({});
  const [providerNoteDraft, setProviderNoteDraft]       = useState<string>("");
  const [providerActiveDraft, setProviderActiveDraft]   = useState<boolean>(false);
  const [savingProvider, setSavingProvider]             = useState(false);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.code === selectedProviderCode) ?? null,
    [providers, selectedProviderCode],
  );

  const hydrateProviderDraft = useCallback((prov: PaymentProviderSettingItem | null) => {
    if (!prov) { setProviderDraft({}); setProviderNoteDraft(""); setProviderActiveDraft(false); return; }
    const draft: Record<string, string> = {};
    for (const f of prov.fields) draft[f.key] = f.secret ? "" : String(f.value || "");
    setProviderDraft(draft);
    setProviderNoteDraft(prov.notes || "");
    setProviderActiveDraft(Boolean(prov.is_active));
  }, []);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campRows, provRows] = await Promise.all([getCampaignPrograms(), getPaymentProviderSettings()]);
      setCampaigns(campRows);
      setProviders(provRows);
      if (!selectedProviderCode && provRows[0]) {
        setSelectedProviderCode(provRows[0].code);
        hydrateProviderDraft(provRows[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [hydrateProviderDraft, selectedProviderCode]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => { hydrateProviderDraft(selectedProvider); }, [hydrateProviderDraft, selectedProvider]);

  // Auto-select first campaign
  useEffect(() => {
    if (selId === null && campaigns.length > 0) setSelId(campaigns[0].id);
  }, [campaigns, selId]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const visibleCamps = useMemo(
    () => audFilter === "all" ? campaigns : campaigns.filter((c) => c.audience_type === audFilter),
    [campaigns, audFilter],
  );

  const sel = useMemo(
    () => visibleCamps.find((c) => c.id === selId) ?? visibleCamps[0] ?? null,
    [visibleCamps, selId],
  );

  const selStatus  = sel ? (statusOverrides[sel.id] ?? sel.status) : "";
  const selPublic  = sel ? (publicOverrides[sel.id] ?? sel.is_public) : false;
  const selAud     = sel ? audMeta(sel.audience_type) : { label: "", color: "#64748b" };
  const selStatus_ = campStatusMeta(selStatus);
  const selUnit    = sel ? goalUnit(sel.trigger_event) : "";
  const linkedLinks = sel ? links.filter((l) => l.campaign === sel.name) : [];

  const activeCount      = campaigns.filter((c) => (statusOverrides[c.id] ?? c.status) === "active").length;
  const totalParticipants = campaigns.reduce((s, c) => s + (c.participants?.length ?? 0), 0);
  const totalGrants      = campaigns.reduce((s, c) => s + (c.grants?.length ?? 0), 0);
  const appliedGrants    = campaigns.reduce((s, c) => s + (c.grants?.filter((g) => g.status === "applied").length ?? 0), 0);

  const totalClicks  = links.reduce((s, l) => s + l.clicks, 0);
  const totalSignups = links.reduce((s, l) => s + l.signups, 0);
  const convAvg      = totalClicks ? ((totalSignups / totalClicks) * 100).toFixed(1) : "0";
  const utmTotal     = MOCK_UTM.reduce((s, x) => s + x.count, 0);
  const intentMax    = Math.max(...MOCK_INTENTS.map((x) => x.count));

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleApplyGrant = async (grantId: number) => {
    try {
      await applyCampaignGrant(grantId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ödül uygulanamadı");
    }
  };

  const handleSaveProvider = async () => {
    if (!selectedProvider) return;
    setSavingProvider(true);
    setError(null);
    try {
      await updatePaymentProviderSetting(selectedProvider.code, {
        is_active: providerActiveDraft,
        notes: providerNoteDraft,
        credentials: providerDraft,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sağlayıcı ayarları kaydedilemedi");
    } finally {
      setSavingProvider(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="cl-tab">
      <PageHeader
        eyebrow="Ticari · Büyüme"
        title="Kampanyalar & Landing"
        sub="Stratejik partner, tedarikçi, iş ortağı ve kariyer kazanım kampanyaları (hedef → eşik → ödül) ve davet/landing linklerinin dönüşüm takibi."
        actions={
          <button type="button" className="cl-btn cl-btn--primary" onClick={() => { if (subTab === "campaigns") setShowWizard(true); }}>
            + {subTab === "campaigns" ? "Yeni kampanya" : "Yeni landing linki"}
          </button>
        }
      />

      {error && <div className="cl-banner cl-banner--error">{error}</div>}

      <div className="kpi-grid kpi-grid--4">
        {subTab === "campaigns" ? (
          <>
            <StatCard label="Aktif kampanya"  value={activeCount}       sub={campaigns.length + " program · 4 kitle"} />
            <StatCard label="Katılımcı"       value={totalParticipants} sub="tüm kitleler"       accent="blue"   />
            <StatCard label="Verilen ödül"    value={totalGrants}       sub="hak ediş kaydı"     accent="violet" />
            <StatCard label="Uygulanan ödül"  value={appliedGrants}     sub="hesaba yansıyan"    accent="green"  />
          </>
        ) : (
          <>
            <StatCard label="Aktif link"      value={links.filter((l) => l.active).length} sub={links.length + " davet/landing linki"} />
            <StatCard label="Toplam tıklama"  value={clNum(totalClicks)}  sub="tüm linkler"          accent="blue"  />
            <StatCard label="Kayıt"           value={totalSignups}        sub="dönüşen ziyaretçi"    accent="green" />
            <StatCard label="Ort. dönüşüm"    value={"%" + convAvg}       sub="kayıt / tıklama"      accent="gold"  />
          </>
        )}
      </div>

      {/* Sub-tab bar */}
      <div className="cl-subtabs">
        <button type="button" className={"cl-subtab" + (subTab === "campaigns" ? " on" : "")} onClick={() => setSubTab("campaigns")}>
          ◉ Kampanya Programları
        </button>
        <button type="button" className={"cl-subtab" + (subTab === "landing" ? " on" : "")} onClick={() => setSubTab("landing")}>
          ⊞ Landing & Davet Linkleri
        </button>
      </div>

      {/* ─── Kampanya Programları ─── */}
      {subTab === "campaigns" && (
        <>
          <div className="cl-audfilter">
            <button type="button" className={audFilter === "all" ? "on" : ""} onClick={() => setAudFilter("all")}>Tüm kitleler</button>
            {Object.keys(AUD_META).map((k) => (
              <button
                key={k}
                type="button"
                className={audFilter === k ? "on" : ""}
                onClick={() => setAudFilter(k)}
                style={audFilter === k ? { background: AUD_META[k].color, borderColor: AUD_META[k].color, color: "#fff" } : {}}
              >
                <span className="cl-dot" style={{ background: AUD_META[k].color }} />
                {AUD_META[k].label}
              </button>
            ))}
          </div>

          <div className="cl-split">
            {/* List pane */}
            <aside className="cl-list">
              <div className="cl-list__hd">Kampanyalar <span>{visibleCamps.length}</span></div>
              <div className="cl-list__scroll">
                {loading ? (
                  <div className="cl-state">Yükleniyor…</div>
                ) : visibleCamps.length === 0 ? (
                  <div className="cl-state">Kampanya bulunamadı.</div>
                ) : (
                  visibleCamps.map((c) => {
                    const am = audMeta(c.audience_type);
                    const sm = campStatusMeta(statusOverrides[c.id] ?? c.status);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={"cl-row" + (c.id === sel?.id ? " on" : "")}
                        onClick={() => { setSelId(c.id); }}
                      >
                        <span className="cl-row__bar" style={{ background: am.color }} />
                        <span className="cl-row__ico" style={{ background: am.color + "1f", color: am.color }}>●</span>
                        <span className="cl-row__meta">
                          <b>{c.name}</b>
                          <i>{am.label} · {goalLabel(c.trigger_event)}</i>
                        </span>
                        <span className={"cl-badge cl-badge--" + sm.cls}>{sm.label}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Detail pane */}
            <div className="cl-detail">
              {!sel ? (
                <div className="cl-state cl-state--pad">Listeden bir kampanya seçin.</div>
              ) : (
                <>
                  <div className="cl-detail__hd">
                    <div className="cl-detail__info">
                      <h3 className="cl-detail__title">
                        {sel.name}
                        <span className={"cl-badge cl-badge--" + selStatus_.cls}>{selStatus_.label}</span>
                        <span className="cl-aud-pill" style={{ background: selAud.color + "1f", color: selAud.color }}>{selAud.label}</span>
                      </h3>
                      <p className="cl-detail__desc">{sel.description || "—"}</p>
                      <p className="cl-detail__meta">
                        <code className="cl-code">{sel.code}</code>
                        {" · "}Hedef: <b>{goalLabel(sel.trigger_event)}</b>
                      </p>
                    </div>
                    <div className="cl-detail__acts">
                      {selStatus === "draft" && (
                        <button type="button" className="cl-act cl-act--ok" onClick={() => setStatusOverrides((p) => ({ ...p, [sel.id]: "active" }))}>Yayına al</button>
                      )}
                      {selStatus === "active" && (
                        <button type="button" className="cl-act" onClick={() => setStatusOverrides((p) => ({ ...p, [sel.id]: "ended" }))}>Bitir</button>
                      )}
                    </div>
                  </div>

                  <Section title="Yayın & Görünürlük" sub="kampanya nerede yayınlanıyor">
                    <label className="cl-toggle">
                      <input
                        type="checkbox"
                        checked={selPublic}
                        onChange={(e) => setPublicOverrides((p) => ({ ...p, [sel.id]: e.target.checked }))}
                      />
                      <span><b>Herkese açık (landing'de yayınla)</b> <em>is_public</em></span>
                    </label>
                    <div className="cl-chans">
                      <div className="cl-chan">
                        <span className="cl-chan__ico" style={{ background: "#eef6ff", color: "#1d4ed8" }}>⊞</span>
                        <div className="cl-chan__b">
                          <b>Public landing sayfası</b>
                          <code>app.buyerasistans.com.tr{landingPath(sel.audience_type)}</code>
                        </div>
                        <span className={"cl-badge cl-badge--" + (selStatus === "active" && selPublic ? "ok" : "wait")}>
                          {selStatus === "active" && selPublic ? "Yayında" : "Yayında değil"}
                        </span>
                      </div>
                      <div className="cl-chan">
                        <span className="cl-chan__ico" style={{ background: selAud.color + "1f", color: selAud.color }}>●</span>
                        <div className="cl-chan__b">
                          <b>Hedef kitle paneli</b>
                          <span>{audiencePanel(sel.audience_type)}</span>
                        </div>
                        <span className={"cl-badge cl-badge--" + (selStatus === "active" ? "ok" : "wait")}>
                          {selStatus === "active" ? "Görünür" : "Gizli"}
                        </span>
                      </div>
                      <div className="cl-chan">
                        <span className="cl-chan__ico" style={{ background: "#ecfdf5", color: "#047857" }}>◎</span>
                        <div className="cl-chan__b">
                          <b>Bağlı davet linkleri</b>
                          <span>{linkedLinks.length} link · {clNum(linkedLinks.reduce((s, l) => s + l.clicks, 0))} tıklama</span>
                        </div>
                        <button type="button" className="cl-mini" onClick={() => setSubTab("landing")}>Linklere git</button>
                      </div>
                    </div>
                  </Section>

                  <Section title="Hedef & ödül kuralları" sub={"eşik (" + selUnit + ") → açılan ödül"}>
                    <div className="cl-rules">
                      {(sel.rules ?? []).map((r, i) => (
                        <div key={i} className="cl-rule">
                          <span className="cl-rule__th">{r.threshold_count}<em>{selUnit}</em></span>
                          <span className="cl-rule__arrow">→</span>
                          <div className="cl-rule__body">
                            <b>{rewardLabel(r.reward_type)}</b>
                            {r.reward_value_json ? (
                              <span>{(() => { try { return (JSON.parse(r.reward_value_json) as { label?: string }).label ?? r.reward_value_json; } catch { return r.reward_value_json; } })()}</span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>

                  <Section title="Katılımcılar & ilerleme" sub="campaign_participants">
                    {(sel.participants?.length ?? 0) === 0 ? (
                      <p className="cl-muted">Henüz katılımcı yok.</p>
                    ) : (
                      <table className="cl-table">
                        <thead><tr><th>Katılımcı</th><th>Tip</th><th>İlerleme</th><th>Son olay</th></tr></thead>
                        <tbody>
                          {sel.participants.map((p) => (
                            <tr key={p.id}>
                              <td><b>{p.owner_type} #{p.owner_id}</b></td>
                              <td className="cl-mut">{p.owner_type}</td>
                              <td>
                                <div className="cl-prog">
                                  <div className="cl-prog__track">
                                    <div className="cl-prog__bar" style={{ width: Math.min(100, p.progress_count * 10) + "%", background: selAud.color }} />
                                  </div>
                                  <span>{p.progress_count} {selUnit}</span>
                                </div>
                              </td>
                              <td className="cl-mut">{p.last_event_at ? new Date(p.last_event_at).toLocaleDateString("tr-TR") : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Section>

                  <Section title="Ödül hak edişleri" sub="granted → applied">
                    {(sel.grants?.length ?? 0) === 0 ? (
                      <p className="cl-muted">Henüz hak ediş yok.</p>
                    ) : (
                      <table className="cl-table">
                        <thead><tr><th>Sahip</th><th>Ödül</th><th>Durum</th><th aria-label="Eylemler" /></tr></thead>
                        <tbody>
                          {sel.grants.map((g, i) => (
                            <tr key={i}>
                              <td><b>{g.owner_type} #{g.owner_id}</b></td>
                              <td>{rewardLabel(g.reward_type)}</td>
                              <td><span className={"cl-badge cl-badge--" + (g.status === "applied" ? "ok" : "wait")}>{g.status === "applied" ? "Uygulandı" : "Hak edildi"}</span></td>
                              <td>
                                {g.status !== "applied" && (
                                  <button type="button" className="cl-act cl-act--ok" onClick={() => void handleApplyGrant(g.id)}>Uygula</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Section>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Landing & Davet Linkleri ─── */}
      {subTab === "landing" && (
        <>
          <Section title="Davet & landing linkleri" sub="channel_referral_links · UTM dönüşüm">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Link</th><th>Kampanya</th><th>Hedef</th><th>Landing</th>
                  <th>Tıklama</th><th>Kayıt</th><th>Dönüşüm</th><th>Durum</th><th aria-label="Eylemler" />
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const conv = l.clicks ? ((l.signups / l.clicks) * 100).toFixed(1) : "0";
                  return (
                    <tr key={l.id} className={l.active ? "" : "cl-row-off"}>
                      <td>
                        <b>{l.name}</b>
                        <div className="cl-code">/r/{l.code}</div>
                      </td>
                      <td className="cl-mut">{l.campaign ?? "— (genel)"}</td>
                      <td><span className="cl-badge cl-badge--info">{TARGET_LABEL[l.target] ?? l.target}</span></td>
                      <td className="cl-mono">{l.landing}</td>
                      <td className="cl-mono">{clNum(l.clicks)}</td>
                      <td className="cl-mono">{l.signups}</td>
                      <td className="cl-mono">%{conv}</td>
                      <td><span className={"cl-badge cl-badge--" + (l.active ? "ok" : "off")}>{l.active ? "Aktif" : "Pasif"}</span></td>
                      <td>
                        <button type="button" className="cl-act" onClick={() => setLinks((p) => p.map((x) => x.id === l.id ? { ...x, active: !x.active } : x))}>
                          {l.active ? "Durdur" : "Aç"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          <div className="split-1-1">
            <Section title="Trafik kaynakları (UTM)" sub="utm_source dağılımı">
              <div className="cl-bars">
                {MOCK_UTM.map((d) => (
                  <div key={d.label} className="cl-bar-row">
                    <span className="cl-bar-row__lbl">{d.label}</span>
                    <div className="cl-bar-row__track">
                      <div className="cl-bar-row__fill" style={{ width: (d.count / utmTotal * 100) + "%", background: d.color }} />
                    </div>
                    <span className="cl-bar-row__n">{clNum(d.count)} <small>({Math.round(d.count / utmTotal * 100)}%)</small></span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Landing intent dağılımı" sub="public_telemetry · sayfa amacı">
              <div className="cl-bars">
                {MOCK_INTENTS.map((it) => (
                  <div key={it.label} className="cl-bar-row">
                    <span className="cl-bar-row__lbl">{it.label}</span>
                    <div className="cl-bar-row__track">
                      <div className="cl-bar-row__fill" style={{ width: (it.count / intentMax * 100) + "%", background: it.color }} />
                    </div>
                    <span className="cl-bar-row__n">{clNum(it.count)}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </>
      )}

      {/* ─── Ödeme Sağlayıcıları ─── */}
      <Section title="Ödeme Sağlayıcıları" sub="Entegre ödeme gateway ayarları">
        <div className="cl-prov-layout">
          <div className="cl-prov-list">
            {providers.map((prov) => (
              <button
                key={prov.code}
                type="button"
                className={"cl-prov-card" + (prov.code === selectedProviderCode ? " on" : "")}
                onClick={() => setSelectedProviderCode(prov.code)}
              >
                <div className="cl-prov-card__hd">
                  <span className="cl-prov-card__name">{prov.name}</span>
                  <div className="cl-prov-card__badges">
                    <span className={"cl-badge cl-badge--" + (prov.is_active ? "ok" : "off")}>{prov.is_active ? "Aktif" : "Pasif"}</span>
                    <span className={"cl-badge cl-badge--" + (prov.ready ? "ok" : "wait")}>{prov.ready ? "Hazır" : "Eksik"}</span>
                  </div>
                </div>
                <div className="cl-prov-card__meta">{prov.category} · {prov.integration_level}</div>
                <div className="cl-prov-card__chips">
                  {prov.supports.map((s) => <span key={s} className="cl-chip">{s}</span>)}
                </div>
              </button>
            ))}
          </div>

          <div className="cl-prov-settings">
            {!selectedProvider ? (
              <div className="cl-state">Sağlayıcı seçin.</div>
            ) : (
              <div className="cl-prov-form">
                <div className="cl-prov-form__hd">
                  <div>
                    <div className="cl-prov-form__name">{selectedProvider.name}</div>
                    <div className="cl-prov-form__code">{selectedProvider.code} · {selectedProvider.country}</div>
                  </div>
                  <label className="cl-toggle">
                    <input type="checkbox" checked={providerActiveDraft} onChange={(e) => setProviderActiveDraft(e.target.checked)} />
                    <span>Ödeme ekranında aktif</span>
                  </label>
                </div>
                <p className="cl-muted">Gizli alanlar boş bırakılırsa mevcut değer korunur.</p>
                <div className="cl-cred-grid">
                  {selectedProvider.fields.map((f) => (
                    <label key={f.key} className="cl-field">
                      <span className="cl-field__label">{f.label}{f.required ? " *" : ""}</span>
                      <input
                        type={f.secret ? "password" : "text"}
                        value={providerDraft[f.key] ?? ""}
                        onChange={(e) => setProviderDraft((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder ?? f.key}
                        className="cl-input"
                      />
                    </label>
                  ))}
                </div>
                <label className="cl-field">
                  <span className="cl-field__label">Not</span>
                  <textarea
                    value={providerNoteDraft}
                    onChange={(e) => setProviderNoteDraft(e.target.value)}
                    placeholder="Ortam notu, test account, callback notları…"
                    className="cl-input cl-input--ta"
                  />
                </label>
                <button type="button" className="cl-btn cl-btn--primary" onClick={() => void handleSaveProvider()} disabled={savingProvider}>
                  {savingProvider ? "Kaydediliyor…" : "Ayarları Kaydet"}
                </button>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ─── Wizard ─── */}
      {showWizard && (
        <CampaignWizard
          onClose={() => setShowWizard(false)}
          onCreate={(c) => {
            setCampaigns((p) => [c, ...p]);
            setSelId(c.id);
            setSubTab("campaigns");
            setAudFilter("all");
            setShowWizard(false);
          }}
          setError={setError}
        />
      )}
    </div>
  );
}


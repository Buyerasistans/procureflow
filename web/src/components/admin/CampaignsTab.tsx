import { useEffect, useMemo, useState } from "react";

import {
  applyCampaignGrant,
  createCampaignProgram,
  getCampaignPrograms,
  getPaymentProviderSettings,
  recordCampaignEvent,
  updatePaymentProviderSetting,
  type CampaignProgram,
  type PaymentProviderSettingItem,
} from "../../services/admin.service";

export function CampaignsAdminTab() {
  const [campaigns, setCampaigns] = useState<CampaignProgram[]>([]);
  const [providers, setProviders] = useState<PaymentProviderSettingItem[]>([]);
  const [selectedProviderCode, setSelectedProviderCode] = useState<string>("");
  const [providerDraft, setProviderDraft] = useState<Record<string, string>>({});
  const [providerNoteDraft, setProviderNoteDraft] = useState<string>("");
  const [providerActiveDraft, setProviderActiveDraft] = useState<boolean>(false);
  const [savingProvider, setSavingProvider] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "supplier-growth-bonus",
    name: "Tedarikci Buyume Bonusu",
    description: "Getirilen aktif tedarikci sayisina gore gorunurluk ve ozel liste odulleri.",
    audience_type: "supplier",
    trigger_event: "supplier_referral_activated",
    status: "active",
  });
  const [eventForm, setEventForm] = useState({
    campaign_id: 0,
    owner_type: "supplier",
    owner_id: 1,
    event_type: "supplier_referral_activated",
    quantity: 1,
    source_reference: "demo-ref-1",
  });

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.code === selectedProviderCode) ?? null,
    [providers, selectedProviderCode],
  );

  function hydrateProviderDraft(provider: PaymentProviderSettingItem | null) {
    if (!provider) {
      setProviderDraft({});
      setProviderNoteDraft("");
      setProviderActiveDraft(false);
      return;
    }

    const draft: Record<string, string> = {};
    for (const field of provider.fields) {
      draft[field.key] = field.secret ? "" : String(field.value || "");
    }

    setProviderDraft(draft);
    setProviderNoteDraft(provider.notes || "");
    setProviderActiveDraft(Boolean(provider.is_active));
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [campaignRows, providerRows] = await Promise.all([
        getCampaignPrograms(),
        getPaymentProviderSettings(),
      ]);
      setCampaigns(campaignRows);
      setProviders(providerRows);
      setEventForm((current) => ({
        ...current,
        campaign_id: current.campaign_id || campaignRows[0]?.id || 0,
      }));

      const fallbackCode = selectedProviderCode || providerRows[0]?.code || "";
      setSelectedProviderCode(fallbackCode);
      const selected = providerRows.find((item) => item.code === fallbackCode) || null;
      hydrateProviderDraft(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kampanya verileri alinamadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    hydrateProviderDraft(selectedProvider);
  }, [selectedProvider]);

  async function handleCreateCampaign() {
    try {
      await createCampaignProgram({
        code: form.code,
        name: form.name,
        description: form.description,
        audience_type: form.audience_type,
        trigger_event: form.trigger_event,
        status: form.status,
        is_public: false,
        rules: [
          { threshold_count: 5, reward_type: "quote_bonus", reward_value_json: '{"limit":20,"unit":"quote"}', sort_order: 1 },
          { threshold_count: 10, reward_type: "special_list_access", reward_value_json: '{"access":"special_list"}', sort_order: 2 },
          { threshold_count: 20, reward_type: "strategic_quote_access", reward_value_json: '{"access":"strategic_quote_digest"}', sort_order: 3 },
        ],
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kampanya olusturulamadi");
    }
  }

  async function handleRecordEvent() {
    try {
      await recordCampaignEvent({
        campaign_id: Number(eventForm.campaign_id),
        owner_type: eventForm.owner_type,
        owner_id: Number(eventForm.owner_id),
        event_type: eventForm.event_type,
        quantity: Number(eventForm.quantity),
        source_reference: eventForm.source_reference,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Event kaydedilemedi");
    }
  }

  async function handleApplyGrant(grantId: number) {
    try {
      await applyCampaignGrant(grantId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Odul uygulanamadi");
    }
  }

  async function handleSaveProviderSettings() {
    if (!selectedProvider) {
      return;
    }

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
      setError(err instanceof Error ? err.message : "Provider ayarlari kaydedilemedi");
    } finally {
      setSavingProvider(false);
    }
  }

  return (
    <div style={{ padding: "24px 0", display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Kampanyalar ve Odeme Ayarlari</h2>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "6px 0 0" }}>
            Odeme saglayicilarinin aktif/pasif ve credential ayarlarini yonetin; pasif olanlar odeme ekranina dusmez.
          </p>
        </div>
        <button onClick={() => void loadData()} style={secondaryBtn}>Yenile</button>
      </div>

      {error ? <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: 12 }}>{error}</div> : null}

      <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Odeme Saglayici Ayarlari</div>
        <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 14 }}>
          <div style={{ display: "grid", gap: 10, maxHeight: 560, overflow: "auto", paddingRight: 4 }}>
            {providers.map((provider) => (
              <button
                key={provider.code}
                type="button"
                onClick={() => setSelectedProviderCode(provider.code)}
                style={{
                  textAlign: "left",
                  border: provider.code === selectedProviderCode ? "1px solid #0f766e" : "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 12,
                  background: provider.code === selectedProviderCode ? "#f0fdfa" : "#fcfcfd",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>{provider.name}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ ...badge(provider.is_active ? "ready" : "pending") }}>{provider.is_active ? "Aktif" : "Pasif"}</span>
                    <span style={{ ...badge(provider.ready ? "ready" : "pending") }}>{provider.ready ? "Hazir" : "Eksik"}</span>
                  </div>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{provider.category} · {provider.integration_level}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {provider.supports.map((item) => <span key={`${provider.code}-${item}`} style={chip}>{item}</span>)}
                </div>
              </button>
            ))}
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#fff" }}>
            {!selectedProvider ? (
              <div style={{ color: "#6b7280" }}>Saglayici secin.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{selectedProvider.name}</div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>{selectedProvider.code} · {selectedProvider.country}</div>
                  </div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={providerActiveDraft}
                      onChange={(e) => setProviderActiveDraft(e.target.checked)}
                    />
                    Odeme ekraninda aktif
                  </label>
                </div>

                <div style={{ color: "#6b7280", fontSize: 12 }}>
                  Gizli alanlar bos birakilirsa mevcut deger korunur. Maskeleme sadece gorunum amaclidir.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {selectedProvider.fields.map((field) => (
                    <label key={`${selectedProvider.code}-${field.key}`} style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                        {field.label}{field.required ? " *" : ""}
                      </span>
                      <input
                        type={field.secret ? "password" : "text"}
                        value={providerDraft[field.key] ?? ""}
                        onChange={(e) => setProviderDraft((current) => ({ ...current, [field.key]: e.target.value }))}
                        placeholder={field.placeholder || field.key}
                        style={input}
                      />
                      {field.secret && field.has_value ? (
                        <span style={{ fontSize: 11, color: "#6b7280" }}>Kayitli deger: {field.value}</span>
                      ) : null}
                    </label>
                  ))}
                </div>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Not</span>
                  <textarea
                    value={providerNoteDraft}
                    onChange={(e) => setProviderNoteDraft(e.target.value)}
                    placeholder="Ortam notu, test account, callback notlari..."
                    style={{ ...input, minHeight: 74 }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleSaveProviderSettings()}
                  disabled={savingProvider}
                  style={{ ...primaryBtn, opacity: savingProvider ? 0.7 : 1 }}
                >
                  {savingProvider ? "Kaydediliyor..." : "Ayarlari Kaydet"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Yeni Kampanya Kur</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input value={form.code} onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))} placeholder="Kod" style={input} />
            <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Ad" style={input} />
            <select value={form.audience_type} onChange={(e) => setForm((c) => ({ ...c, audience_type: e.target.value }))} style={input}>
              <option value="supplier">supplier</option>
              <option value="channel">channel</option>
            </select>
            <select value={form.trigger_event} onChange={(e) => setForm((c) => ({ ...c, trigger_event: e.target.value }))} style={input}>
              <option value="supplier_referral_activated">supplier_referral_activated</option>
              <option value="partner_referral_activated">partner_referral_activated</option>
            </select>
            <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="Aciklama" style={{ ...input, minHeight: 84, gridColumn: "1 / -1" }} />
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Varsayilan odul seti: 5 aktif referansta teklif bonusu, 10'da ozel liste, 20'de stratejik teklif erisimi.</div>
            <button onClick={() => void handleCreateCampaign()} style={primaryBtn}>Kampanya Olustur</button>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Test Event Gonder</div>
          <div style={{ display: "grid", gap: 10 }}>
            <select value={eventForm.campaign_id} onChange={(e) => setEventForm((c) => ({ ...c, campaign_id: Number(e.target.value) }))} style={input}>
              <option value={0}>Kampanya secin</option>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
            <input value={eventForm.owner_type} onChange={(e) => setEventForm((c) => ({ ...c, owner_type: e.target.value }))} placeholder="owner_type" style={input} />
            <input value={eventForm.owner_id} onChange={(e) => setEventForm((c) => ({ ...c, owner_id: Number(e.target.value) }))} placeholder="owner_id" type="number" style={input} />
            <input value={eventForm.event_type} onChange={(e) => setEventForm((c) => ({ ...c, event_type: e.target.value }))} placeholder="event_type" style={input} />
            <input value={eventForm.quantity} onChange={(e) => setEventForm((c) => ({ ...c, quantity: Number(e.target.value) }))} placeholder="quantity" type="number" style={input} />
            <button onClick={() => void handleRecordEvent()} style={primaryBtn}>Event Kaydet</button>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        {loading ? <div style={{ color: "#6b7280" }}>Yukleniyor...</div> : null}
        {campaigns.map((campaign) => (
          <article key={campaign.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{campaign.name}</div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 12 }}>{campaign.code} · {campaign.audience_type} · {campaign.trigger_event}</div>
                <div style={{ marginTop: 8, color: "#374151", fontSize: 13 }}>{campaign.description || "Aciklama yok"}</div>
              </div>
              <span style={{ ...badge(campaign.status === "active" ? "ready" : "pending") }}>{campaign.status}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              <div>
                <div style={sectionTitle}>Kurallar</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {campaign.rules.map((rule, index) => (
                    <div key={`${campaign.id}-${rule.id ?? index}`} style={miniCard}>#{rule.threshold_count}{" -> "}{rule.reward_type}</div>
                  ))}
                </div>
              </div>
              <div>
                <div style={sectionTitle}>Ilerleme</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {campaign.participants.length === 0 ? <div style={emptyText}>Katilimci yok</div> : campaign.participants.map((participant) => (
                    <div key={participant.id} style={miniCard}>{participant.owner_type} #{participant.owner_id} · ilerleme {participant.progress_count}</div>
                  ))}
                </div>
              </div>
              <div>
                <div style={sectionTitle}>Oduller</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {campaign.grants.length === 0 ? <div style={emptyText}>Odul yok</div> : campaign.grants.map((grant) => (
                    <div key={grant.id} style={miniCard}>
                      <div>{grant.reward_type} · {grant.owner_type} #{grant.owner_id}</div>
                      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ ...badge(grant.status === "applied" ? "ready" : "pending") }}>{grant.status}</span>
                        {grant.status !== "applied" ? <button onClick={() => void handleApplyGrant(grant.id)} style={secondaryBtn}>Uygula</button> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

const input = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
} as const;

const primaryBtn = {
  background: "#0f766e",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const secondaryBtn = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "9px 12px",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const chip = {
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 11,
  background: "#f3f4f6",
  color: "#374151",
  border: "1px solid #e5e7eb",
} as const;

const miniCard = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 12,
  background: "#fcfcfd",
} as const;

const emptyText = {
  color: "#6b7280",
  fontSize: 12,
} as const;

const sectionTitle = {
  fontWeight: 700,
  fontSize: 12,
  color: "#111827",
  marginBottom: 8,
} as const;

function badge(tone: "ready" | "pending") {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 700,
    background: tone === "ready" ? "#ecfdf5" : "#fff7ed",
    color: tone === "ready" ? "#047857" : "#b45309",
    border: tone === "ready" ? "1px solid #a7f3d0" : "1px solid #fed7aa",
  } as const;
}

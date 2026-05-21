import { useCallback, useEffect, useMemo, useState } from "react";

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
import "./CampaignsTab.css";

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

  const hydrateProviderDraft = useCallback((provider: PaymentProviderSettingItem | null) => {
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
  }, []);

  const loadData = useCallback(async () => {
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
      hydrateProviderDraft(providerRows.find((item) => item.code === fallbackCode) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kampanya verileri alinamadi");
    } finally {
      setLoading(false);
    }
  }, [hydrateProviderDraft, selectedProviderCode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    hydrateProviderDraft(selectedProvider);
  }, [hydrateProviderDraft, selectedProvider]);

  const handleCreateCampaign = async () => {
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
          {
            threshold_count: 5,
            reward_type: "quote_bonus",
            reward_value_json: '{"limit":20,"unit":"quote"}',
            sort_order: 1,
          },
          {
            threshold_count: 10,
            reward_type: "special_list_access",
            reward_value_json: '{"access":"special_list"}',
            sort_order: 2,
          },
          {
            threshold_count: 20,
            reward_type: "strategic_quote_access",
            reward_value_json: '{"access":"strategic_quote_digest"}',
            sort_order: 3,
          },
        ],
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kampanya olusturulamadi");
    }
  };

  const handleRecordEvent = async () => {
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
  };

  const handleApplyGrant = async (grantId: number) => {
    try {
      await applyCampaignGrant(grantId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Odul uygulanamadi");
    }
  };

  const handleSaveProviderSettings = async () => {
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
      setError(err instanceof Error ? err.message : "Provider ayarlari kaydedilemedi");
    } finally {
      setSavingProvider(false);
    }
  };

  return (
    <div className="campaigns-admin-tab">
      <div className="campaigns-admin-tab__header">
        <div>
          <h2 className="campaigns-admin-tab__title">Kampanyalar ve Odeme Ayarlari</h2>
          <p className="campaigns-admin-tab__description">
            Odeme saglayicilarinin aktif/pasif ve credential ayarlarini yonetin; pasif olanlar odeme ekranina dusmez.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="campaigns-admin-tab__button campaigns-admin-tab__button--secondary"
        >
          Yenile
        </button>
      </div>

      {error ? <div className="campaigns-admin-tab__error">{error}</div> : null}

      <section className="campaigns-admin-tab__section">
        <div className="campaigns-admin-tab__section-title">Odeme Saglayici Ayarlari</div>
        <div className="campaigns-admin-tab__layout">
          <div className="campaigns-admin-tab__provider-list">
            {providers.map((provider) => (
              <button
                key={provider.code}
                type="button"
                onClick={() => setSelectedProviderCode(provider.code)}
                className={`campaigns-admin-tab__provider-card ${
                  provider.code === selectedProviderCode
                    ? "campaigns-admin-tab__provider-card--selected"
                    : ""
                }`}
              >
                <div className="campaigns-admin-tab__provider-header">
                  <div className="campaigns-admin-tab__provider-name">{provider.name}</div>
                  <div className="campaigns-admin-tab__badge-row">
                    <span
                      className={`campaigns-admin-tab__badge ${
                        provider.is_active
                          ? "campaigns-admin-tab__badge--ready"
                          : "campaigns-admin-tab__badge--pending"
                      }`}
                    >
                      {provider.is_active ? "Aktif" : "Pasif"}
                    </span>
                    <span
                      className={`campaigns-admin-tab__badge ${
                        provider.ready
                          ? "campaigns-admin-tab__badge--ready"
                          : "campaigns-admin-tab__badge--pending"
                      }`}
                    >
                      {provider.ready ? "Hazir" : "Eksik"}
                    </span>
                  </div>
                </div>
                <div className="campaigns-admin-tab__provider-meta">
                  {provider.category} · {provider.integration_level}
                </div>
                <div className="campaigns-admin-tab__provider-supports">
                  {provider.supports.map((item) => (
                    <span key={`${provider.code}-${item}`} className="campaigns-admin-tab__chip">
                      {item}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="campaigns-admin-tab__settings-panel">
            {!selectedProvider ? (
              <div className="campaigns-admin-tab__settings-empty">Saglayici secin.</div>
            ) : (
              <div className="campaigns-admin-tab__settings-content">
                <div className="campaigns-admin-tab__settings-header">
                  <div>
                    <div className="campaigns-admin-tab__settings-name">{selectedProvider.name}</div>
                    <div className="campaigns-admin-tab__settings-code">
                      {selectedProvider.code} · {selectedProvider.country}
                    </div>
                  </div>
                  <label className="campaigns-admin-tab__toggle">
                    <input
                      type="checkbox"
                      checked={providerActiveDraft}
                      onChange={(e) => setProviderActiveDraft(e.target.checked)}
                    />
                    Odeme ekraninda aktif
                  </label>
                </div>

                <div className="campaigns-admin-tab__note">
                  Gizli alanlar bos birakilirsa mevcut deger korunur. Maskeleme sadece gorunum amaclidir.
                </div>

                <div className="campaigns-admin-tab__credentials-grid">
                  {selectedProvider.fields.map((field) => (
                    <label
                      key={`${selectedProvider.code}-${field.key}`}
                      className="campaigns-admin-tab__field"
                    >
                      <span className="campaigns-admin-tab__label">
                        {field.label}
                        {field.required ? " *" : ""}
                      </span>
                      <input
                        type={field.secret ? "password" : "text"}
                        value={providerDraft[field.key] ?? ""}
                        onChange={(e) =>
                          setProviderDraft((current) => ({ ...current, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder || field.key}
                        className="campaigns-admin-tab__input"
                      />
                      {field.secret && field.has_value ? (
                        <span className="campaigns-admin-tab__note">
                          Kayitli deger: {field.value}
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>

                <label className="campaigns-admin-tab__field">
                  <span className="campaigns-admin-tab__label">Not</span>
                  <textarea
                    value={providerNoteDraft}
                    onChange={(e) => setProviderNoteDraft(e.target.value)}
                    placeholder="Ortam notu, test account, callback notlari..."
                    className="campaigns-admin-tab__input campaigns-admin-tab__textarea"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleSaveProviderSettings()}
                  disabled={savingProvider}
                  className="campaigns-admin-tab__button campaigns-admin-tab__button--primary"
                >
                  {savingProvider ? "Kaydediliyor..." : "Ayarlari Kaydet"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="campaigns-admin-tab__campaign-grid">
        <div className="campaigns-admin-tab__section">
          <div className="campaigns-admin-tab__section-title">Yeni Kampanya Kur</div>
          <div className="campaigns-admin-tab__credentials-grid">
            <label className="campaigns-admin-tab__field">
              <span className="campaigns-admin-tab__label">Kod</span>
              <input
                value={form.code}
                onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))}
                placeholder="Kod"
                className="campaigns-admin-tab__input"
              />
            </label>

            <label className="campaigns-admin-tab__field">
              <span className="campaigns-admin-tab__label">Ad</span>
              <input
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                placeholder="Ad"
                className="campaigns-admin-tab__input"
              />
            </label>

            <label className="campaigns-admin-tab__field">
              <span className="campaigns-admin-tab__label">Hedef Kitle</span>
              <select
                value={form.audience_type}
                onChange={(e) => setForm((c) => ({ ...c, audience_type: e.target.value }))}
                aria-label="Kampanya hedef kitle seçimi"
                title="Kampanya hedef kitle seçimi"
                className="campaigns-admin-tab__select"
              >
                <option value="supplier">supplier</option>
                <option value="channel">channel</option>
              </select>
            </label>

            <label className="campaigns-admin-tab__field">
              <span className="campaigns-admin-tab__label">Tetik Olay</span>
              <select
                value={form.trigger_event}
                onChange={(e) => setForm((c) => ({ ...c, trigger_event: e.target.value }))}
                aria-label="Kampanya tetik olay seçimi"
                title="Kampanya tetik olay seçimi"
                className="campaigns-admin-tab__select"
              >
                <option value="supplier_referral_activated">supplier_referral_activated</option>
                <option value="partner_referral_activated">partner_referral_activated</option>
              </select>
            </label>

            <label className="campaigns-admin-tab__field campaigns-admin-tab__field--full">
              <span className="campaigns-admin-tab__label">Açıklama</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                placeholder="Aciklama"
                className="campaigns-admin-tab__input campaigns-admin-tab__textarea campaigns-admin-tab__textarea--full"
              />
            </label>
          </div>
          <div className="campaigns-admin-tab__stack">
            <div className="campaigns-admin-tab__note">
              Varsayilan odul seti: 5 aktif referansta teklif bonusu, 10'da ozel liste, 20'de stratejik teklif erisimi.
            </div>
            <button
              type="button"
              onClick={() => void handleCreateCampaign()}
              className="campaigns-admin-tab__button campaigns-admin-tab__button--primary"
            >
              Kampanya Olustur
            </button>
          </div>
        </div>

        <div className="campaigns-admin-tab__section">
          <div className="campaigns-admin-tab__section-title">Test Event Gonder</div>
          <div className="campaigns-admin-tab__stack">
            <label className="campaigns-admin-tab__field">
              <span className="campaigns-admin-tab__label">Kampanya</span>
              <select
                value={eventForm.campaign_id}
                onChange={(e) =>
                  setEventForm((c) => ({ ...c, campaign_id: Number(e.target.value) }))
                }
                aria-label="Event için kampanya seçimi"
                title="Event için kampanya seçimi"
                className="campaigns-admin-tab__select"
              >
                <option value={0}>Kampanya secin</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="campaigns-admin-tab__field">
              <span className="campaigns-admin-tab__label">Owner Tipi</span>
              <input
                value={eventForm.owner_type}
                onChange={(e) => setEventForm((c) => ({ ...c, owner_type: e.target.value }))}
                placeholder="owner_type"
                className="campaigns-admin-tab__input"
              />
            </label>

            <label className="campaigns-admin-tab__field">
              <span className="campaigns-admin-tab__label">Owner ID</span>
              <input
                value={eventForm.owner_id}
                onChange={(e) =>
                  setEventForm((c) => ({ ...c, owner_id: Number(e.target.value) }))
                }
                placeholder="owner_id"
                type="number"
                className="campaigns-admin-tab__input"
              />
            </label>

            <label className="campaigns-admin-tab__field">
              <span className="campaigns-admin-tab__label">Event Tipi</span>
              <input
                value={eventForm.event_type}
                onChange={(e) => setEventForm((c) => ({ ...c, event_type: e.target.value }))}
                placeholder="event_type"
                className="campaigns-admin-tab__input"
              />
            </label>

            <label className="campaigns-admin-tab__field">
              <span className="campaigns-admin-tab__label">Adet</span>
              <input
                value={eventForm.quantity}
                onChange={(e) => setEventForm((c) => ({ ...c, quantity: Number(e.target.value) }))}
                placeholder="quantity"
                type="number"
                className="campaigns-admin-tab__input"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleRecordEvent()}
              className="campaigns-admin-tab__button campaigns-admin-tab__button--primary"
            >
              Event Kaydet
            </button>
          </div>
        </div>
      </section>

      <section className="campaigns-admin-tab__stack">
        {loading ? <div className="campaigns-admin-tab__note">Yukleniyor...</div> : null}
        {campaigns.map((campaign) => (
          <article key={campaign.id} className="campaigns-admin-tab__campaign-card">
            <div className="campaigns-admin-tab__campaign-header">
              <div>
                <div className="campaigns-admin-tab__provider-name">{campaign.name}</div>
                <div className="campaigns-admin-tab__campaign-meta">
                  {campaign.code} · {campaign.audience_type} · {campaign.trigger_event}
                </div>
                <div className="campaigns-admin-tab__campaign-description">
                  {campaign.description || "Aciklama yok"}
                </div>
              </div>
              <span
                className={`campaigns-admin-tab__badge ${
                  campaign.status === "active"
                    ? "campaigns-admin-tab__badge--ready"
                    : "campaigns-admin-tab__badge--pending"
                }`}
              >
                {campaign.status}
              </span>
            </div>

            <div className="campaigns-admin-tab__campaign-columns">
              <div>
                <div className="campaigns-admin-tab__column-title">Kurallar</div>
                <div className="campaigns-admin-tab__mini-list">
                  {campaign.rules.map((rule, index) => (
                    <div key={`${campaign.id}-${rule.id ?? index}`} className="campaigns-admin-tab__mini-card">
                      #{rule.threshold_count}{" -> "}{rule.reward_type}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="campaigns-admin-tab__column-title">Ilerleme</div>
                <div className="campaigns-admin-tab__mini-list">
                  {campaign.participants.length === 0 ? (
                    <div className="campaigns-admin-tab__empty">Katilimci yok</div>
                  ) : (
                    campaign.participants.map((participant) => (
                      <div key={participant.id} className="campaigns-admin-tab__mini-card">
                        {participant.owner_type} #{participant.owner_id} · ilerleme {participant.progress_count}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="campaigns-admin-tab__column-title">Oduller</div>
                <div className="campaigns-admin-tab__mini-list">
                  {campaign.grants.length === 0 ? (
                    <div className="campaigns-admin-tab__empty">Odul yok</div>
                  ) : (
                    campaign.grants.map((grant) => (
                      <div key={grant.id} className="campaigns-admin-tab__mini-card">
                        <div>
                          {grant.reward_type} · {grant.owner_type} #{grant.owner_id}
                        </div>
                        <div className="campaigns-admin-tab__grant-row">
                          <span
                            className={`campaigns-admin-tab__badge ${
                              grant.status === "applied"
                                ? "campaigns-admin-tab__badge--ready"
                                : "campaigns-admin-tab__badge--pending"
                            }`}
                          >
                            {grant.status}
                          </span>
                          {grant.status !== "applied" ? (
                            <button
                              type="button"
                              onClick={() => void handleApplyGrant(grant.id)}
                              className="campaigns-admin-tab__button campaigns-admin-tab__button--secondary"
                            >
                              Uygula
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

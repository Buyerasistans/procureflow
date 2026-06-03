import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { getUserDisplayRoleLabel, getUserScopeType } from "../auth/permissions";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import {
  getChannelCampaigns,
  getChannelSocialLinks,
  getChannelCommissionReport,
  getChannelConversionMetrics,
  getChannelGamification,
  getChannelProfileSummary,
  getChannelReferralLinks,
  createChannelReferralLink,
  getChannelTeamHierarchy,
  getChannelTeamPerformance,
  recalculateChannelCommissions,
  type ChannelGamification,
  type ChannelSocialLinks,
  type ChannelCampaignList,
  type ChannelCommissionReport,
  type ChannelConversionMetrics,
  type ChannelProfileSummary,
  type ChannelReferralLink,
  type TeamHierarchy,
  type TeamPerformance,
} from "../services/profile.service";
import { TeamHierarchyTree } from "../components/channel/TeamHierarchyTree";
import { CampaignPanel } from "../components/channel/CampaignPanel";
import { GamificationPanel } from "../components/channel/GamificationPanel";
import { SocialSharePanel } from "../components/channel/SocialSharePanel";
import { TeamPerformanceTable } from "../components/channel/TeamPerformanceTable";
import { PartnerSummaryCard } from "../components/channel/PartnerSummaryCard";
import { ReferralLinkCenter } from "../components/channel/ReferralLinkCenter";
import { ConversionOverviewPanel } from "../components/channel/ConversionOverviewPanel";
import { SectionCard, SectionHeader } from "../components/channel/ChannelPrimitives";
import "./ProfilePage.css";

export default function ProfilePage() {
  const { user } = useAuth();
  const { profile, refreshProfile, updateProfile, changePassword } = useProfile();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [channelSummary, setChannelSummary] = useState<ChannelProfileSummary | null>(null);
  const [channelReferralLinks, setChannelReferralLinks] = useState<ChannelReferralLink[]>([]);
  const [channelConversionMetrics, setChannelConversionMetrics] = useState<ChannelConversionMetrics | null>(null);
  const [channelCommissionReport, setChannelCommissionReport] = useState<ChannelCommissionReport | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCreateLoading, setReferralCreateLoading] = useState(false);
  const [conversionLoading, setConversionLoading] = useState(false);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionSyncLoading, setCommissionSyncLoading] = useState(false);
  const [teamHierarchy, setTeamHierarchy] = useState<TeamHierarchy | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [channelCampaigns, setChannelCampaigns] = useState<ChannelCampaignList | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [channelSocialLinks, setChannelSocialLinks] = useState<ChannelSocialLinks | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance | null>(null);
  const [teamPerformanceLoading, setTeamPerformanceLoading] = useState(false);
  const [channelGamification, setChannelGamification] = useState<ChannelGamification | null>(null);
  const [gamificationLoading, setGamificationLoading] = useState(false);
  const isChannelWorkspace = getUserScopeType(user) === "channel";

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", work_email: "" });

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      await refreshProfile();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Profil yükleme hatası",
      });
    } finally {
      setLoading(false);
    }
  }, [refreshProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile) {
      setEditForm({ full_name: profile.full_name, work_email: profile.work_email || "" });
    }
  }, [profile, editMode]);

  useEffect(() => {
    if (!isChannelWorkspace) {
      setChannelSummary(null);
      setChannelReferralLinks([]);
      setChannelConversionMetrics(null);
      setChannelCommissionReport(null);
      setTeamHierarchy(null);
      setChannelCampaigns(null);
      setChannelSocialLinks(null);
      setTeamPerformance(null);
      setChannelGamification(null);
      return;
    }

    let cancelled = false;

    async function loadChannelSummary() {
      try {
        setSummaryLoading(true);
        setReferralLoading(true);
        setConversionLoading(true);
        setCommissionLoading(true);
        setHierarchyLoading(true);
        setCampaignLoading(true);
        setSocialLoading(true);
        setTeamPerformanceLoading(true);
        setGamificationLoading(true);
        const data = await getChannelProfileSummary();
        const links = await getChannelReferralLinks();
        const conversion = await getChannelConversionMetrics("30d");
        const commissionReport = await getChannelCommissionReport("30d");
        const hierarchy = await getChannelTeamHierarchy();
        const campaigns = await getChannelCampaigns();
        const socialLinks = await getChannelSocialLinks();
        const perf = await getChannelTeamPerformance("30d");
        const gamification = await getChannelGamification();
        if (!cancelled) {
          setChannelSummary(data);
          setChannelReferralLinks(links);
          setChannelConversionMetrics(conversion);
          setChannelCommissionReport(commissionReport);
          setTeamHierarchy(hierarchy);
          setChannelCampaigns(campaigns);
          setChannelSocialLinks(socialLinks);
          setTeamPerformance(perf);
          setChannelGamification(gamification);
        }
      } catch {
        if (!cancelled) {
          setChannelSummary(null);
          setChannelReferralLinks([]);
          setChannelConversionMetrics(null);
          setChannelCommissionReport(null);
          setTeamHierarchy(null);
          setChannelCampaigns(null);
          setChannelSocialLinks(null);
          setTeamPerformance(null);
          setChannelGamification(null);
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
          setReferralLoading(false);
          setConversionLoading(false);
          setCommissionLoading(false);
          setHierarchyLoading(false);
          setCampaignLoading(false);
          setSocialLoading(false);
          setTeamPerformanceLoading(false);
          setGamificationLoading(false);
        }
      }
    }

    void loadChannelSummary();

    return () => {
      cancelled = true;
    };
  }, [isChannelWorkspace]);

  const handleCommissionSync = async () => {
    try {
      setCommissionSyncLoading(true);
      await recalculateChannelCommissions("30d");
      const report = await getChannelCommissionReport("30d");
      setChannelCommissionReport(report);
      setMessage({ type: "success", text: "Komisyon kayitlari guncellendi" });
    } catch {
      setMessage({ type: "error", text: "Komisyon hesaplama calistirilamadi" });
    } finally {
      setCommissionSyncLoading(false);
    }
  };

  const handleCreateReferralLink = async (
    targetType: "mixed" | "partner" | "supplier",
    campaignId?: number
  ) => {
    try {
      setReferralCreateLoading(true);
      await createChannelReferralLink({
        target_type: targetType,
        campaign_id: campaignId ?? null,
      });
      const links = await getChannelReferralLinks();
      setChannelReferralLinks(links);
      const socialLinks = await getChannelSocialLinks();
      setChannelSocialLinks(socialLinks);
      const successText = campaignId
        ? `Kampanya linki olusturuldu (#${campaignId})`
        : "Genel referral link olusturuldu";
      setMessage({ type: "success", text: successText });
    } catch (error) {
      let detail = "Referral link olusturulamadi";
      if (axios.isAxiosError(error)) {
        detail =
          (error.response?.data as { detail?: string } | undefined)?.detail ||
          error.message ||
          detail;
      }
      setMessage({ type: "error", text: detail });
    } finally {
      setReferralCreateLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editForm.full_name.trim()) {
      setMessage({ type: "error", text: "Ad ve soyad boş olamaz" });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      await updateProfile({ full_name: editForm.full_name, work_email: editForm.work_email || null });
      setMessage({ type: "success", text: "Profil başarıyla güncellendi" });
      setEditMode(false);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Güncelleme hatası",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordForm.old_password) {
      setMessage({ type: "error", text: "Mevcut şifre gerekli" });
      return;
    }

    if (!passwordForm.new_password) {
      setMessage({ type: "error", text: "Yeni şifre gerekli" });
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setMessage({ type: "error", text: "Yeni şifre en az 8 karakter olmalı" });
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setMessage({ type: "error", text: "Şifreler eşleşmiyor" });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      await changePassword(passwordForm.old_password, passwordForm.new_password);
      setMessage({ type: "success", text: "Şifre başarıyla değiştirildi" });
      setShowPasswordForm(false);
      setPasswordForm({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Şifre değişme hatası",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!profile && loading) {
    return (
      <div className="prp-loading">
        <div className="prp-loading-inner">⏳ Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="prp-root">
      <div className="prp-page-header">
        <h1 className="prp-page-title">👤 Profilim</h1>
        <p className="prp-page-subtitle">Kişisel bilgilerinizi yönetin</p>
      </div>

      {message && (
        <div className={`prp-message prp-message--${message.type}`}>
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}

      {profile && (
        <>
          {isChannelWorkspace && (
            <>
              <PartnerSummaryCard summary={channelSummary} loading={summaryLoading} />

              <ReferralLinkCenter
                links={channelReferralLinks}
                loading={referralLoading}
                creating={referralCreateLoading}
                campaignOptions={(channelCampaigns?.campaigns || []).map((item) => ({
                  id: item.id,
                  name: item.name,
                }))}
                onCreateLink={handleCreateReferralLink}
              />

              <div className="prp-social-card">
                <div className="prp-social-card-header">
                  <h2 className="prp-social-card-title">Sosyal Baglanti Paneli</h2>
                  <span className="prp-badge-sm">
                    {socialLoading ? "Yukleniyor..." : channelSocialLinks?.source_link_code || "Hazir"}
                  </span>
                </div>
                {socialLoading ? (
                  <p className="prp-muted-text-sm">Yukleniyor...</p>
                ) : (
                  <SocialSharePanel data={channelSocialLinks} />
                )}
              </div>

              <ConversionOverviewPanel
                conversionMetrics={channelConversionMetrics}
                conversionLoading={conversionLoading}
                commissionReport={channelCommissionReport}
                commissionLoading={commissionLoading}
                commissionSyncLoading={commissionSyncLoading}
                onCommissionSync={handleCommissionSync}
              />

              <SectionCard marginBottom={20}>
                <SectionHeader title="Ekip Hiyerarşisi" />
                {hierarchyLoading ? (
                  <p className="prp-muted-text">Yükleniyor...</p>
                ) : teamHierarchy && teamHierarchy.nodes.length > 0 ? (
                  <>
                    <div className="prp-team-info">
                      Toplam: {teamHierarchy.total_members} üye · Aktif: {teamHierarchy.active_members}
                    </div>
                    <TeamHierarchyTree
                      nodes={teamHierarchy.nodes}
                      rootUserId={teamHierarchy.root_user_id}
                    />
                  </>
                ) : (
                  <p className="prp-muted-text">Henüz ekip üyesi yok.</p>
                )}
              </SectionCard>

              <SectionCard marginBottom={20}>
                <SectionHeader
                  title="Ekip Performans Tablosu"
                  right={
                    <span className="prp-badge-subtle">
                      {teamPerformanceLoading ? "Yukleniyor..." : teamPerformance?.period || "30d"}
                    </span>
                  }
                />
                {teamPerformanceLoading ? (
                  <p className="prp-muted-text">Yukleniyor...</p>
                ) : (
                  <TeamPerformanceTable data={teamPerformance} />
                )}
              </SectionCard>

              <GamificationPanel data={channelGamification} loading={gamificationLoading} />

              <SectionCard marginBottom={20}>
                <SectionHeader
                  title="Kampanya Paneli"
                  right={
                    channelCampaigns && channelCampaigns.total > 0 ? (
                      <span className="prp-badge-muted">
                        {channelCampaigns.active_count} aktif · {channelCampaigns.joined_count} katılınan
                      </span>
                    ) : null
                  }
                />
                {campaignLoading ? (
                  <p className="prp-muted-text">Yükleniyor...</p>
                ) : (
                  <CampaignPanel campaigns={channelCampaigns?.campaigns ?? []} />
                )}
              </SectionCard>
            </>
          )}

          <div className="prp-card prp-card--mb">
            <div className="prp-card-header">
              <h2 className="prp-card-title">Temel Bilgiler</h2>
              {!editMode && (
                <button type="button" onClick={() => setEditMode(true)} className="prp-edit-btn">
                  Düzenle
                </button>
              )}
            </div>

            {editMode ? (
              <form onSubmit={handleUpdateProfile} className="prp-form">
                <div className="prp-form-group">
                  <label className="prp-form-label">Ad ve Soyad</label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    disabled={loading}
                    className="prp-form-input"
                    aria-label="Ad ve Soyad"
                  />
                </div>
                <div className="prp-form-group">
                  <label className="prp-form-label">İş Maili</label>
                  <input
                    type="email"
                    value={editForm.work_email}
                    onChange={(e) => setEditForm({ ...editForm, work_email: e.target.value })}
                    disabled={loading}
                    placeholder="Mail popup hesabı için kullanılacak adres"
                    className="prp-form-input"
                    aria-label="İş Maili"
                  />
                </div>
                <div className="prp-form-actions">
                  <button type="submit" disabled={loading} className="prp-submit-btn prp-submit-btn--save">
                    {loading ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    disabled={loading}
                    className="prp-cancel-btn"
                  >
                    İptal
                  </button>
                </div>
              </form>
            ) : (
              <div className="prp-info-grid">
                <strong>Ad & Soyad:</strong>
                <span>{profile.full_name}</span>

                <strong>Email:</strong>
                <span>{profile.email}</span>

                <strong>İş Maili:</strong>
                <span>{profile.work_email || "-"}</span>

                <strong>Rol:</strong>
                <span>{getUserDisplayRoleLabel(profile)}</span>

                <strong>Durum:</strong>
                <span className={profile.is_active ? "prp-status--active" : "prp-status--inactive"}>
                  {profile.is_active ? "✅ Aktif" : "❌ Pasif"}
                </span>
              </div>
            )}
          </div>

          <div className="prp-card">
            <div className="prp-card-header">
              <h2 className="prp-card-title">🔐 Şifre</h2>
              {!showPasswordForm && (
                <button type="button" onClick={() => setShowPasswordForm(true)} className="prp-edit-btn">
                  Şifre Değiştir
                </button>
              )}
            </div>

            {showPasswordForm ? (
              <form onSubmit={handleChangePassword} className="prp-form">
                <div className="prp-form-group">
                  <label className="prp-form-label">Mevcut Şifre</label>
                  <input
                    type="password"
                    value={passwordForm.old_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, old_password: e.target.value })
                    }
                    disabled={loading}
                    className="prp-form-input"
                    aria-label="Mevcut Şifre"
                  />
                </div>

                <div className="prp-form-group">
                  <label className="prp-form-label">Yeni Şifre</label>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, new_password: e.target.value })
                    }
                    disabled={loading}
                    placeholder="En az 8 karakter"
                    className="prp-form-input"
                    aria-label="Yeni Şifre"
                  />
                </div>

                <div className="prp-form-group">
                  <label className="prp-form-label">Yeni Şifre (Tekrar)</label>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                    }
                    disabled={loading}
                    className="prp-form-input"
                    aria-label="Yeni Şifre (Tekrar)"
                  />
                </div>

                <div className="prp-form-actions">
                  <button type="submit" disabled={loading} className="prp-submit-btn prp-submit-btn--pwd">
                    {loading ? "Değiştiriliyor..." : "Şifre Değiştir"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordForm({
                        old_password: "",
                        new_password: "",
                        confirm_password: "",
                      });
                    }}
                    disabled={loading}
                    className="prp-cancel-btn"
                  >
                    İptal
                  </button>
                </div>

                <p className="prp-form-hint">
                  💡 Yeni şifre en az 8 karakter olmalı ve eski şifreden farklı olmalı.
                </p>
              </form>
            ) : (
              <p className="prp-static-text">
                Hesap güvenliğinizi sağlamak için düzenli olarak şifrenizi değiştirin.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

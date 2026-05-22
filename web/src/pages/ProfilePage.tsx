// FILE: web/src/pages/ProfilePage.tsx
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

  // Profile edit
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", work_email: "" });

  // Password change
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
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div style={{ display: "inline-block" }}>⏳ Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ marginBottom: 8 }}>👤 Profilim</h1>
        <p style={{ color: "#666", margin: 0 }}>Kişisel bilgilerinizi yönetin</p>
      </div>

      {/* Messages */}
      {message && (
        <div
          style={{
            padding: 12,
            marginBottom: 20,
            borderRadius: 8,
            backgroundColor:
              message.type === "success"
                ? "#d1fae5"
                : "#fee2e2",
            color: message.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${
              message.type === "success" ? "#6ee7b7" : "#fca5a5"
            }`,
          }}
        >
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

              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e0e7ff",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Sosyal Baglanti Paneli</h2>
                  <span style={{ fontSize: 12, color: "#475569" }}>
                    {socialLoading ? "Yukleniyor..." : channelSocialLinks?.source_link_code || "Hazir"}
                  </span>
                </div>
                {socialLoading ? (
                  <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Yukleniyor...</p>
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

              {/* Ekip Hiyerarşisi */}
              <SectionCard marginBottom={20}>
                <SectionHeader title="Ekip Hiyerarşisi" />
                {hierarchyLoading ? (
                  <p style={{ color: "#9ca3af", fontSize: 13 }}>Yükleniyor...</p>
                ) : teamHierarchy && teamHierarchy.nodes.length > 0 ? (
                  <>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                      Toplam: {teamHierarchy.total_members} üye · Aktif: {teamHierarchy.active_members}
                    </div>
                    <TeamHierarchyTree
                      nodes={teamHierarchy.nodes}
                      rootUserId={teamHierarchy.root_user_id}
                    />
                  </>
                ) : (
                  <p style={{ color: "#9ca3af", fontSize: 13 }}>Henüz ekip üyesi yok.</p>
                )}
              </SectionCard>

              <SectionCard marginBottom={20}>
                <SectionHeader
                  title="Ekip Performans Tablosu"
                  right={
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                    {teamPerformanceLoading ? "Yukleniyor..." : teamPerformance?.period || "30d"}
                    </span>
                  }
                />
                {teamPerformanceLoading ? (
                  <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Yukleniyor...</p>
                ) : (
                  <TeamPerformanceTable data={teamPerformance} />
                )}
              </SectionCard>

              {/* Performans ve Seviye */}
              <GamificationPanel data={channelGamification} loading={gamificationLoading} />

              {/* Kampanya Paneli */}
              <SectionCard marginBottom={20}>
                <SectionHeader
                  title="Kampanya Paneli"
                  right={
                    channelCampaigns && channelCampaigns.total > 0 ? (
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        {channelCampaigns.active_count} aktif · {channelCampaigns.joined_count} katılınan
                      </span>
                    ) : null
                  }
                />
                {campaignLoading ? (
                  <p style={{ color: "#9ca3af", fontSize: 13 }}>Yükleniyor...</p>
                ) : (
                  <CampaignPanel campaigns={channelCampaigns?.campaigns ?? []} />
                )}
              </SectionCard>
            </>
          )}

          {/* Profile Section */}
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 24,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Temel Bilgiler</h2>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Düzenle
                </button>
              )}
            </div>

            {editMode ? (
              <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>
                    Ad ve Soyad
                  </label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: 8,
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>
                    İş Maili
                  </label>
                  <input
                    type="email"
                    value={editForm.work_email}
                    onChange={(e) => setEditForm({ ...editForm, work_email: e.target.value })}
                    disabled={loading}
                    placeholder="Mail popup hesabı için kullanılacak adres"
                    style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4, boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    disabled={loading}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#f3f4f6",
                      color: "#1f2937",
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    İptal
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "16px 24px", lineHeight: 1.8 }}>
                <strong>Ad & Soyad:</strong>
                <span>{profile.full_name}</span>

                <strong>Email:</strong>
                <span>{profile.email}</span>

                <strong>İş Maili:</strong>
                <span>{profile.work_email || "-"}</span>

                <strong>Rol:</strong>
                <span>{getUserDisplayRoleLabel(profile)}</span>

                <strong>Durum:</strong>
                <span style={{ color: profile.is_active ? "#10b981" : "#ef4444" }}>
                  {profile.is_active ? "✅ Aktif" : "❌ Pasif"}
                </span>
              </div>
            )}
          </div>

          {/* Password Change Section */}
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>🔐 Şifre</h2>
              {!showPasswordForm && (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Şifre Değiştir
                </button>
              )}
            </div>

            {showPasswordForm ? (
              <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>
                    Mevcut Şifre
                  </label>
                  <input
                    type="password"
                    value={passwordForm.old_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, old_password: e.target.value })
                    }
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: 8,
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>
                    Yeni Şifre
                  </label>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, new_password: e.target.value })
                    }
                    disabled={loading}
                    placeholder="En az 8 karakter"
                    style={{
                      width: "100%",
                      padding: 8,
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>
                    Yeni Şifre (Tekrar)
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                    }
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: 8,
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
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
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#f3f4f6",
                      color: "#1f2937",
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    İptal
                  </button>
                </div>

                <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                  💡 Yeni şifre en az 8 karakter olmalı ve eski şifreden farklı olmalı.
                </p>
              </form>
            ) : (
              <p style={{ color: "#666", margin: 0 }}>
                Hesap güvenliğinizi sağlamak için düzenli olarak şifrenizi değiştirin.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

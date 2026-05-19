import type { ReactNode } from "react";
import type { AdminSupplierListItem, OnboardingStudioSummary } from "../../services/admin.service";
import type { AdminFocusBannerTone, AdminTabKey } from "./adminPageMeta";

type OnboardingStudioTabProps = {
  onboardingStudioSummary: OnboardingStudioSummary;
  searchParams: URLSearchParams;
  renderAdminFocusBanner: (options: {
    eyebrow: string;
    title: string;
    detail: string;
    tone: AdminFocusBannerTone;
    sourceLabel?: string;
    timestamp?: number | null;
    actions?: Array<{ label: string; onClick?: () => void; href?: string }>;
    testId?: string;
  }) => ReactNode;
  navigateAdminTab: (tab: AdminTabKey, params?: Record<string, string>) => void;
  handleStartOnboardingTemplate: (planCode: string) => void;
  handleCreateDraftTenant: (planCode: string) => Promise<void>;
  tenantGovernanceSuppliers: AdminSupplierListItem[];
  formatOnboardingApprovalStatus: (status: string | null | undefined) => string;
  formatOnboardingPaymentStatus: (status: string | null | undefined) => string;
  formatPartnerOnboardingStatus: (status: string | null | undefined) => string;
  formatActivationDeliveryStatus: (status: string | null | undefined) => string;
  formatCategoryRequestStatus: (status: string | null | undefined) => string;
  onboardingMembershipActionTenantId: number | null;
  handleReviewTenantCategory: (tenantId: number, categoryName: string, decision: "support_approved" | "final_approved" | "rejected") => Promise<void>;
  handleVerifyOnboardingPayment: (tenantId: number) => Promise<void>;
  handleApproveOnboardingMembership: (tenantId: number) => Promise<void>;
  handleRequestOnboardingInfo: (tenantId: number) => Promise<void>;
  handleRejectOnboardingMembership: (tenantId: number) => Promise<void>;
};

export function OnboardingStudioTab({
  onboardingStudioSummary,
  searchParams,
  renderAdminFocusBanner,
  navigateAdminTab,
  handleStartOnboardingTemplate,
  handleCreateDraftTenant,
  tenantGovernanceSuppliers,
  formatOnboardingApprovalStatus,
  formatOnboardingPaymentStatus,
  formatPartnerOnboardingStatus,
  formatActivationDeliveryStatus,
  formatCategoryRequestStatus,
  onboardingMembershipActionTenantId,
  handleReviewTenantCategory,
  handleVerifyOnboardingPayment,
  handleApproveOnboardingMembership,
  handleRequestOnboardingInfo,
  handleRejectOnboardingMembership,
}: OnboardingStudioTabProps) {
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Kurulum Studyosu</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Yeni Stratejik Partner kurulum iskeleti</div>
        <div style={{ color: "#64748b" }}>Plan secimi, Stratejik Partner kaydi, ilk admin aktivasyonu ve ilk kurulum sihirbazi icin operasyon akisini tek ekranda toplar.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Stratejik Partner", value: onboardingStudioSummary.tenant_count, note: "Toplam Stratejik Partner portfoyu", color: "#1d4ed8" },
          { label: "Onboarding Kuyrugu", value: onboardingStudioSummary.onboarding_queue_count, note: "Aktif olmayan kurulum akislari", color: "#b45309" },
          { label: "Owner Eksigi", value: onboardingStudioSummary.owner_pending_count, note: "Sahip atamasi bekleyen Stratejik Partner", color: "#dc2626" },
          { label: "Branding Eksigi", value: onboardingStudioSummary.branding_pending_count, note: "Logo veya brand name eksigi", color: "#7c3aed" },
          { label: "Yeni Uyelik", value: onboardingStudioSummary.new_membership_count, note: "Public onboarding ile gelen yeni basvurular", color: "#0f766e" },
          { label: "Odeme Kontrol", value: onboardingStudioSummary.payment_review_count, note: "Odeme dogrulamasi bekleyen uyelikler", color: "#c2410c" },
          { label: "Bilgi Istendi", value: onboardingStudioSummary.information_requested_count, note: "Ek bilgi veya yeni dekont bekleyen uyelikler", color: "#2563eb" },
          { label: "Onay Bekliyor", value: onboardingStudioSummary.activation_approval_waiting_count, note: "Aktivasyon onayi bekleyen uyelikler", color: "#6d28d9" },
          { label: "Onaylandi", value: onboardingStudioSummary.approved_membership_count, note: "Aktivasyonu tamamlanan yeni uyelikler", color: "#15803d" },
        ].map((item) => (
          <div key={item.label} style={{ borderRadius: 18, background: "white", border: "1px solid #e5e7eb", padding: 16, boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)", display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: item.color }}>{item.label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>{item.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {searchParams.get("onboardingPlanFocus") ? (
          <div style={{ gridColumn: "1 / -1" }}>
            {renderAdminFocusBanner({
              eyebrow: "Admin Focus",
              title: `Onboarding odagi: ${String(searchParams.get("onboardingPlanFocus") || "").toUpperCase()} plani`,
              detail: "Secilen onboarding planina ait kartlar oncelikli olarak vurgulaniyor.",
              tone: "blue",
              sourceLabel: "Onboarding deep-link",
              timestamp: Date.now(),
              actions: [{ label: "Odagi Temizle", onClick: () => navigateAdminTab("onboarding_studio") }],
              testId: "admin-focus-banner-onboarding",
            })}
          </div>
        ) : null}
        {[
          { title: "1. Plan Secimi", note: "Starter, Growth veya Enterprise paketi ile ticari cerceveyi sabitle.", status: "Hazir", color: "#2563eb", action: "starter" },
          { title: "2. Stratejik Partner Kaydi", note: "Stratejik Partner slug, branding ve sahip kullanici adayi ile workspace kaydini ac.", status: "Hazir", color: "#0f766e", action: "growth" },
          { title: "3. Ilk Admin Aktivasyonu", note: "Owner daveti ve ilk yonetici aktivasyonunu tamamla.", status: "Hazir", color: "#b45309", action: "enterprise" },
          { title: "4. Kurulum Sihirbazi", note: "Sirket, departman, roller, proje ve tedarikci tohumlarini adim adim tamamlama akisini kur.", status: "Taslak", color: "#7c3aed", action: null },
        ].filter((card) => {
          const focus = searchParams.get("onboardingPlanFocus");
          if (!focus) return true;
          return card.action === focus || card.action === null;
        }).map((card) => (
          <div key={card.title} style={{ borderRadius: 20, background: "white", border: searchParams.get("onboardingPlanFocus") === card.action ? "2px solid #1d4ed8" : "1px solid #e5e7eb", padding: 18, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)", display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: card.color }}>{card.status}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{card.title}</div>
            <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>{card.note}</div>
            {card.action ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => handleStartOnboardingTemplate(card.action)}
                  style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}
                >
                  Stratejik Partner formuna tasla
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateDraftTenant(card.action)}
                  style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", fontWeight: 800, cursor: "pointer" }}
                >
                  Taslak Stratejik Partner olustur
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, display: "grid", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#1d4ed8" }}>Yeni Uyelik Onay Masasi</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Odeme kontrolu ve aktivasyon onayi</div>
        <div style={{ color: "#64748b" }}>Public ana sayfadan gelen stratejik partner ve tedarikci uyelik basvurulari burada takip edilir. Ucretli planlarda EFT dahil tum odemeler dogrulanmadan ve super admin onayi verilmeden aktivasyon tamamlanmaz.</div>
        <div style={{ borderRadius: 16, background: "#eff6ff", border: "1px solid #bfdbfe", padding: "14px 16px", display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#1d4ed8" }}>Kategori ve Eslesme Notu</div>
          <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.7 }}>
            Onboarding sirasinda toplanan kategori bilgisi burada yalnizca bir profil alani olarak durmaz. Super admin ekibi bu veriyi stratejik partner kapsami, supplier uygunlugu ve kategori eksigi olan basvurulari hizlica ayiklamak icin kullanir.
          </div>
          <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.7 }}>
            Ozellikle supplier ve stratejik partner basvurularinda kategori uyumu; aktivasyon karari sonrasi hangi havuzun once acilacagini, hangi tenantin ek supplier sourcing ihtiyaci tasidigini ve hangi kayitlarin operasyonel takip gerektirdigini gosterir.
          </div>
        </div>
        {onboardingStudioSummary.recent_memberships.length === 0 ? (
          <div style={{ borderRadius: 14, background: "#f8fafc", border: "1px dashed #cbd5e1", padding: "12px 14px", color: "#64748b" }}>
            Gosterilecek yeni uyelik kaydi yok.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {onboardingStudioSummary.recent_memberships.map((tenant) => {
              const paymentStatus = String(tenant.onboarding_payment_status || "not_required").toLowerCase();
              const approvalStatus = String(tenant.onboarding_approval_status || "not_required").toLowerCase();
              const categoryTags = Array.isArray(tenant.category_tags) ? tenant.category_tags : [];
              const targetCategoryTags = Array.isArray(tenant.target_category_tags) ? tenant.target_category_tags : [];
              const categoryRequests = Array.isArray(tenant.category_requests) ? tenant.category_requests : [];
              const hasPendingCategoryReview = categoryRequests.some((item) => !["final_approved", "rejected"].includes(String(item.status || "").toLowerCase()));
              const normalizedTenantCategory = String(tenant.category || "").trim();
              const matchingCategoryPool = categoryTags.length > 0 ? categoryTags : normalizedTenantCategory ? [normalizedTenantCategory] : [];
              const matchingSupplierCount = matchingCategoryPool.length > 0
                ? tenantGovernanceSuppliers.filter((supplier) => matchingCategoryPool.includes(String(supplier.category || "").trim())).length
                : 0;
              const canVerifyPayment = paymentStatus === "submitted" || paymentStatus === "processing";
              const canApprove = ["pending", "needs_info"].includes(approvalStatus) && ["verified", "succeeded", "not_required"].includes(paymentStatus) && !hasPendingCategoryReview;
              const canRequestInfo = approvalStatus === "pending" || approvalStatus === "needs_info";
              const canReject = approvalStatus === "pending" || approvalStatus === "rejected";
              const decisionGuidance = canVerifyPayment
                ? "Dekont veya hareket kaniti geldigi icin once odeme dogrulama yapilmali. Dogrulama tamamlanmadan aktivasyon onayi verilmemeli."
                : hasPendingCategoryReview
                  ? "Listede olmayan kategori talepleri icin once destek ve final onay akisi tamamlanmali. Bu islem bitmeden aktivasyon onayi verilmemeli."
                  : canApprove
                    ? "Odeme gereklilikleri tamamlandi. Kategori uyumu ve tenant sahibi bilgilerinde eksik yoksa aktivasyon onayi verilebilir."
                    : approvalStatus === "needs_info"
                      ? "Kayit ek bilgi bekliyor. Yeni dekont, kategori netlestirmesi veya tenant sahibi teyidi tamamlanana kadar bekletilmeli."
                      : approvalStatus === "rejected"
                        ? "Bu kayit reddedilmis durumda. Yeniden ilerletilecekse once operasyon notu ve karar gerekcesi kontrol edilmeli."
                        : "Kayit ilk inceleme asamasinda. Kategori, plan, odeme ve aktivasyon notlari birlikte kontrol edilerek karar verilmelidir.";
              const decisionTone = canApprove ? "#dcfce7" : canVerifyPayment ? "#fff7ed" : approvalStatus === "needs_info" ? "#eff6ff" : approvalStatus === "rejected" ? "#fef2f2" : "#f8fafc";
              const decisionBorder = canApprove ? "#86efac" : canVerifyPayment ? "#fdba74" : approvalStatus === "needs_info" ? "#93c5fd" : approvalStatus === "rejected" ? "#fca5a5" : "#cbd5e1";
              const decisionColor = canApprove ? "#166534" : canVerifyPayment ? "#9a3412" : approvalStatus === "needs_info" ? "#1d4ed8" : approvalStatus === "rejected" ? "#b91c1c" : "#475569";
              return (
                <div key={tenant.id} style={{ borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0", padding: 14, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{tenant.brand_name || tenant.legal_name}</div>
                      <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{tenant.owner_email || "owner e-postasi yok"} • {tenant.subscription_plan_code || "starter"} • {String(tenant.subscription_plan_code || "").startsWith("supplier") ? "tedarikci uyeligi" : "stratejik partner uyeligi"}</div>
                    </div>
                    <span style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: approvalStatus === "approved" ? "#dcfce7" : "#ede9fe", color: approvalStatus === "approved" ? "#166534" : "#6d28d9", fontSize: 12, fontWeight: 800 }}>
                      {formatOnboardingApprovalStatus(tenant.onboarding_approval_status)}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    <div style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Odeme Durumu</div>
                      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{formatOnboardingPaymentStatus(tenant.onboarding_payment_status)}</div>
                      <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>{tenant.onboarding_payment_method || "yontem yok"}</div>
                    </div>
                    <div style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Kurulum Durumu</div>
                      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{formatPartnerOnboardingStatus(tenant.onboarding_status)}</div>
                      <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>{tenant.onboarding_approved_by_name || "super admin karari bekleniyor"}</div>
                    </div>
                    <div style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Aktivasyon</div>
                      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{formatActivationDeliveryStatus(tenant.activation_delivery_status)}</div>
                      <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                        {tenant.initial_admin_invitation_accepted ? "Ilk admin hesabi aktive edildi" : "Aktivasyon bekleniyor"}
                      </div>
                    </div>
                    <div style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Kategori ve Eslesme</div>
                      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(categoryTags.length > 0 ? categoryTags : [normalizedTenantCategory || "Kategori eksik"]).map((item) => (
                          <span key={`${tenant.id}-${item}`} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: item !== "Kategori eksik" ? "#ecfeff" : "#f8fafc", color: item !== "Kategori eksik" ? "#0f766e" : "#64748b", fontWeight: 700, fontSize: 11 }}>
                            {item}
                          </span>
                        ))}
                        {targetCategoryTags.map((item) => (
                          <span key={`${tenant.id}-target-${item}`} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#eef2ff", color: "#4338ca", fontWeight: 700, fontSize: 11 }}>
                            hedef: {item}
                          </span>
                        ))}
                        <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: matchingSupplierCount > 0 ? "#ecfdf5" : "#fff7ed", color: matchingSupplierCount > 0 ? "#166534" : "#9a3412", fontWeight: 700, fontSize: 11 }}>
                          {matchingSupplierCount > 0 ? `${matchingSupplierCount} supplier eslesiyor` : "Eslesen supplier yok"}
                        </span>
                      </div>
                      <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                        {matchingCategoryPool.length > 0 ? "Aktivasyon sonrasi sourcing havuzu secilen ve hedef kategorilere gore acilabilir." : "Kategori netlesmeden aktivasyon verilirse supplier havuzu zayif acilir."}
                      </div>
                    </div>
                  </div>
                  {categoryRequests.length > 0 ? (
                    <div style={{ borderRadius: 12, background: "white", border: "1px solid #dbe3ee", padding: "10px 12px", display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Kategori Talep Onayi</div>
                      {categoryRequests.map((item) => {
                        const requestStatus = String(item.status || "pending_support").toLowerCase();
                        const statusColor = requestStatus === "final_approved" ? "#166534" : requestStatus === "rejected" ? "#b91c1c" : requestStatus === "support_approved" ? "#1d4ed8" : "#9a3412";
                        const statusBg = requestStatus === "final_approved" ? "#ecfdf5" : requestStatus === "rejected" ? "#fef2f2" : requestStatus === "support_approved" ? "#eff6ff" : "#fff7ed";
                        const isBusy = onboardingMembershipActionTenantId === tenant.id;
                        return (
                          <div key={`${tenant.id}-request-${item.name}-${item.applies_to}`} style={{ borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "10px 12px", display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <div style={{ color: "#0f172a", fontWeight: 800 }}>{item.name}</div>
                              <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: statusBg, color: statusColor, fontSize: 11, fontWeight: 800 }}>
                                {formatCategoryRequestStatus(item.status)}
                              </span>
                            </div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>
                              {item.applies_to === "target" ? "Hedef kategori talebi" : "Faaliyet kategorisi talebi"}
                              {item.note ? ` • ${item.note}` : ""}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {requestStatus === "pending_support" ? (
                                <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "support_approved")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412", fontWeight: 800, cursor: isBusy ? "not-allowed" : "pointer" }}>
                                  Destek Onayi Ver
                                </button>
                              ) : null}
                              {["pending_support", "support_approved"].includes(requestStatus) ? (
                                <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "final_approved")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: isBusy ? "not-allowed" : "pointer" }}>
                                  Final Onayla
                                </button>
                              ) : null}
                              {!['final_approved', 'rejected'].includes(requestStatus) ? (
                                <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "rejected")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontWeight: 800, cursor: isBusy ? "not-allowed" : "pointer" }}>
                                  Reddet
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div style={{ borderRadius: 12, background: decisionTone, border: `1px solid ${decisionBorder}`, padding: "10px 12px", color: decisionColor, fontSize: 12, lineHeight: 1.7 }}>
                    <strong style={{ display: "block", marginBottom: 4 }}>Karar Rehberi</strong>
                    {decisionGuidance}
                  </div>
                  {tenant.onboarding_payment_receipt_url || tenant.onboarding_payment_note || tenant.onboarding_activation_notes ? (
                    <div style={{ borderRadius: 12, background: "white", border: "1px solid #dbe3ee", padding: "10px 12px", display: "grid", gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Operasyon Notlari</div>
                      {tenant.onboarding_payment_receipt_url ? (
                        <a href={tenant.onboarding_payment_receipt_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 700 }}>
                          {tenant.onboarding_payment_receipt_name || "Dekontu ac"}
                        </a>
                      ) : null}
                      {tenant.onboarding_payment_note ? <div style={{ color: "#475569", fontSize: 12 }}>{tenant.onboarding_payment_note}</div> : null}
                      {tenant.onboarding_activation_notes ? <div style={{ color: "#7c2d12", fontSize: 12 }}>{tenant.onboarding_activation_notes}</div> : null}
                    </div>
                  ) : null}
                  {tenant.onboarding_decision_timeline && tenant.onboarding_decision_timeline.length > 0 ? (
                    <div style={{ borderRadius: 12, background: "white", border: "1px solid #dbe3ee", padding: "10px 12px", display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Karar Zaman Cizelgesi</div>
                      {tenant.onboarding_decision_timeline.slice().reverse().map((item, index) => (
                        <div key={`${item.at}-${index}`} style={{ paddingLeft: 12, borderLeft: "2px solid #cbd5e1", display: "grid", gap: 2 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{item.actor_name} • {item.action}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{new Date(item.at).toLocaleString("tr-TR")} • {item.actor_type}</div>
                          {item.note ? <div style={{ fontSize: 12, color: "#334155" }}>{item.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={!canVerifyPayment || onboardingMembershipActionTenantId === tenant.id}
                      onClick={() => void handleVerifyOnboardingPayment(tenant.id)}
                      style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #fed7aa", background: canVerifyPayment ? "#fff7ed" : "#f8fafc", color: canVerifyPayment ? "#c2410c" : "#94a3b8", fontWeight: 800, cursor: canVerifyPayment ? "pointer" : "not-allowed" }}
                    >
                      Odemeyi Dogrula
                    </button>
                    <button
                      type="button"
                      disabled={!canApprove || onboardingMembershipActionTenantId === tenant.id}
                      onClick={() => void handleApproveOnboardingMembership(tenant.id)}
                      style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: canApprove ? "#1d4ed8" : "#cbd5e1", color: "white", fontWeight: 800, cursor: canApprove ? "pointer" : "not-allowed" }}
                    >
                      Uyelik Aktivasyonunu Onayla
                    </button>
                    <button
                      type="button"
                      disabled={!canRequestInfo || onboardingMembershipActionTenantId === tenant.id}
                      onClick={() => void handleRequestOnboardingInfo(tenant.id)}
                      style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: canRequestInfo ? "#eff6ff" : "#f8fafc", color: canRequestInfo ? "#1d4ed8" : "#94a3b8", fontWeight: 800, cursor: canRequestInfo ? "pointer" : "not-allowed" }}
                    >
                      Ek Bilgi / Yeni Dekont Iste
                    </button>
                    <button
                      type="button"
                      disabled={!canReject || onboardingMembershipActionTenantId === tenant.id}
                      onClick={() => void handleRejectOnboardingMembership(tenant.id)}
                      style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #fecaca", background: canReject ? "#fef2f2" : "#f8fafc", color: canReject ? "#b91c1c" : "#94a3b8", fontWeight: 800, cursor: canReject ? "pointer" : "not-allowed" }}
                    >
                      Reddet ve Not Dus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, display: "grid", gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#0f766e" }}>Operasyon Akisi</div>
          {[
            "Stratejik Partner Yonetimi sekmesinden plan ve kurulum durumunu sec.",
            "Ilk admin e-postasini initial_admin alanlari ile ac ve owner atamasini tamamla.",
            "Kurulum durumunu taslak > onboarding > aktif seklinde ilerlet.",
            "Branding, destek kanali ve paket limitleri aktif olmadan canliya gecme.",
          ].map((item) => (
            <div key={item} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#334155" }}>{item}</div>
          ))}
        </div>

        <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, display: "grid", gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#7c3aed" }}>RFQ Gecis Hazirligi</div>
          <div style={{ borderRadius: 16, background: onboardingStudioSummary.rfq_readiness.transition_ready ? "#ecfdf5" : "#fff7ed", border: onboardingStudioSummary.rfq_readiness.transition_ready ? "1px solid #bbf7d0" : "1px solid #fed7aa", padding: "12px 14px", color: onboardingStudioSummary.rfq_readiness.transition_ready ? "#166534" : "#9a3412", fontWeight: 800 }}>
            {onboardingStudioSummary.rfq_readiness.transition_ready ? "Stratejik Partner RFQ gecisi icin kritik blokaj gorunmuyor" : "Stratejik Partner RFQ gecisi oncesi veri duzeltme gerekli"}
          </div>
          {[
            "Quotes, quote_approvals ve supplier_quotes Stratejik Partner tutarliligi audit ile izlenir.",
            "Platform network supplier senaryosu Stratejik Partner-private supplier ayrimiyla birlikte korunur.",
            "Stratejik Partner RFQ modeline gecmeden once quote domaini readiness skoru uretir.",
          ].map((item) => (
            <div key={item} style={{ borderRadius: 14, background: "#faf5ff", border: "1px solid #ede9fe", padding: "12px 14px", color: "#4c1d95" }}>{item}</div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {[
              { label: "Stratejik Partner Eksik Quote", value: onboardingStudioSummary.rfq_readiness.quotes_missing_tenant, color: "#dc2626" },
              { label: "Stratejik Partner Eksik Approval", value: onboardingStudioSummary.rfq_readiness.approvals_missing_tenant, color: "#ea580c" },
              { label: "Approval-Quote Uyumsuz", value: onboardingStudioSummary.rfq_readiness.approvals_quote_tenant_mismatch, color: "#9a3412" },
              { label: "Quote-Proje Uyumsuz", value: onboardingStudioSummary.rfq_readiness.quotes_project_tenant_mismatch, color: "#7c2d12" },
              { label: "Supplier-Quote Uyumsuz", value: onboardingStudioSummary.rfq_readiness.supplier_quote_scope_mismatch, color: "#7c3aed" },
              { label: "Platform Agi TedarikciTeklifi", value: onboardingStudioSummary.rfq_readiness.supplier_quotes_platform_network_count, color: "#0f766e" },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius: 14, background: "#fff", border: "1px solid #e9d5ff", padding: "12px 14px", display: "grid", gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "14px 16px", display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#0f766e" }}>Tedarikci Kaynak Dengesi</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ borderRadius: 14, background: "white", border: "1px solid #dbeafe", padding: "12px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase" }}>Ozel Tedarikci</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900, color: "#1d4ed8" }}>{onboardingStudioSummary.supplier_mix.private_count}</div>
              </div>
              <div style={{ borderRadius: 14, background: "white", border: "1px solid #ddd6fe", padding: "12px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase" }}>Platform Agi</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900, color: "#7c3aed" }}>{onboardingStudioSummary.supplier_mix.platform_network_count}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


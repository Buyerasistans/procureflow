import { useState } from "react";
import type { ReactNode } from "react";
import type { AdminSupplierListItem, OnboardingStudioSummary } from "../../services/admin.service";
import { resendTenantUserInvitation } from "../../services/admin.service";
import type { AdminFocusBannerTone, AdminTabKey } from "./adminPageMeta";
import { PageHeader, StatCard } from "./AdminTabContent";
import "./OnboardingStudioTab.css";

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
  const s = onboardingStudioSummary;

  // Approved/fully-onboarded cards start collapsed
  const [expandedCards, setExpandedCards] = useState<Set<number>>(() => {
    const initialExpanded = new Set<number>();
    s.recent_memberships.forEach((tenant) => {
      const approvalStatus = String(tenant.onboarding_approval_status || "").toLowerCase();
      if (approvalStatus !== "approved") {
        initialExpanded.add(tenant.id);
      }
    });
    return initialExpanded;
  });

  const [resendingTenantId, setResendingTenantId] = useState<number | null>(null);
  const [resendMessages, setResendMessages] = useState<Record<number, string>>({});

  function toggleCard(tenantId: number) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(tenantId)) {
        next.delete(tenantId);
      } else {
        next.add(tenantId);
      }
      return next;
    });
  }

  async function handleResendActivation(tenantId: number, ownerUserId: number | null | undefined) {
    if (!ownerUserId) {
      setResendMessages((prev) => ({ ...prev, [tenantId]: "Owner kullanıcı bulunamadı." }));
      return;
    }
    try {
      setResendingTenantId(tenantId);
      const result = await resendTenantUserInvitation(ownerUserId);
      setResendMessages((prev) => ({
        ...prev,
        [tenantId]: result.invitation_email_sent ? "Aktivasyon maili gönderildi." : "Mail gönderilemedi, sistem logunu kontrol edin.",
      }));
    } catch {
      setResendMessages((prev) => ({ ...prev, [tenantId]: "Mail gönderme başarısız." }));
    } finally {
      setResendingTenantId(null);
    }
  }

  return (
    <section className="osTab">

      {/* ── Header ─────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="Operasyon"
        title="Kurulum Stüdyosu"
        sub="Public kayıt formundan gelen stratejik partner ve tedarikçi başvuruları — ödeme ve onay akışı"
      />
      <div className="kpi-grid">
        <StatCard label="Toplam Partner" value={s.tenant_count} accent="blue" sub="Kayıtlı stratejik partner" />
        <StatCard label="Onboarding Kuyruğu" value={s.onboarding_queue_count} accent="warn" sub="Aktif işlem bekleyen" />
        <StatCard label="Ödeme Kontrolü" value={s.payment_review_count} accent="violet" sub="Ödeme doğrulaması gerekli" />
        <StatCard label="Onay Bekliyor" value={s.activation_approval_waiting_count} accent="slate" sub="Süper admin onayı bekleniyor" />
        <StatCard label="Onaylandı" value={s.approved_membership_count} accent="green" sub="Aktivasyon tamamlandı" />
      </div>

      {/* ── Metric strip (legacy — detay satırları) ────────────── */}
      <div className="osTab__metrics">
        {[
          { label: "Toplam Stratejik Partner", value: s.tenant_count, tone: "blue" },
          { label: "Onboarding Kuyruğu", value: s.onboarding_queue_count, tone: "amber" },
          { label: "Yeni Üyelik", value: s.new_membership_count, tone: "teal" },
          { label: "Ödeme Kontrolü", value: s.payment_review_count, tone: "orange" },
          { label: "Bilgi Bekleniyor", value: s.information_requested_count, tone: "sky" },
          { label: "Onay Bekliyor", value: s.activation_approval_waiting_count, tone: "purple" },
          { label: "Onaylandı", value: s.approved_membership_count, tone: "green" },
          { label: "Owner Eksik", value: s.owner_pending_count, tone: "red" },
        ].map((item) => (
          <div key={item.label} className={`osTab__metricPill osTab__metricPill--${item.tone}`}>
            <span className="osTab__metricNum">{item.value}</span>
            <span className="osTab__metricLabel">{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Focus banner ───────────────────────────────────────── */}
      {searchParams.get("onboardingPlanFocus") ? (
        renderAdminFocusBanner({
          eyebrow: "Admin Focus",
          title: `Onboarding odağı: ${String(searchParams.get("onboardingPlanFocus") || "").toUpperCase()} planı`,
          detail: "Seçilen onboarding planına ait kartlar öncelikli olarak vurgulaniyor.",
          tone: "blue",
          sourceLabel: "Onboarding deep-link",
          actions: [{ label: "Odağı Temizle", onClick: () => navigateAdminTab("onboarding_studio") }],
          testId: "admin-focus-banner-onboarding",
        })
      ) : null}

      {/* ── Membership approval queue ───────────────────────────── */}
      <div className="osTab__panel">
        <div className="osTab__panelHead">
          <div className="osTab__eyebrow osTab__eyebrow--amber">Onay Kuyruğu</div>
          <div className="osTab__panelTitle">Üyelik Başvuruları</div>
          <div className="osTab__panelDesc">
            Ücretli planlarda EFT dahil tüm ödemeler doğrulanmadan ve süper admin onayı verilmeden aktivasyon tamamlanmaz.
            Onaylanmış firmalar varsayılan olarak kapalı gelir — başlığa tıklayarak açabilirsiniz.
          </div>
        </div>

        <div className="osTab__infoBox">
          <div className="osTab__infoBoxTitle">Kategori ve Eşleşme Notu</div>
          <div className="osTab__infoBoxBody">
            Onboarding sırasında toplanan kategori bilgisi; stratejik partner kapsamı, supplier uygunluğu ve
            kategori eksiği olan başvuruları hızlıca ayıklamak için kullanılır.
          </div>
          <div className="osTab__infoBoxNote">
            Kategori uyumu, aktivasyon kararı sonrası hangi havuzun önce açılacağını ve hangi kayıtların ek
            supplier sourcing ihtiyacı taşıdığını gösterir.
          </div>
        </div>

        {s.recent_memberships.length === 0 ? (
          <div className="osTab__empty">Onay kuyruğunda bekleyen üyelik başvurusu yok.</div>
        ) : (
          <div className="osTab__queue">
            {s.recent_memberships.map((tenant) => {
              const paymentStatus = String(tenant.onboarding_payment_status || "not_required").toLowerCase();
              const rawApprovalStatus = String(tenant.onboarding_approval_status || "not_required").toLowerCase();
              // "not_required" in onboarding queue = legacy tenant without approval status set → treat as pending
              const approvalStatus = rawApprovalStatus === "not_required" ? "pending" : rawApprovalStatus;
              const categoryTags = Array.isArray(tenant.category_tags) ? tenant.category_tags : [];
              const targetCategoryTags = Array.isArray(tenant.target_category_tags) ? tenant.target_category_tags : [];
              const categoryRequests = Array.isArray(tenant.category_requests) ? tenant.category_requests : [];
              const hasPendingCategoryReview = categoryRequests.some(
                (item) => !["final_approved", "rejected"].includes(String(item.status || "").toLowerCase()),
              );
              const normalizedCategory = String(tenant.category || "").trim();
              const matchingPool = categoryTags.length > 0 ? categoryTags : normalizedCategory ? [normalizedCategory] : [];
              const matchingSupplierCount = matchingPool.length > 0
                ? tenantGovernanceSuppliers.filter((sup) => matchingPool.includes(String(sup.category || "").trim())).length
                : 0;

              // "Ödemeyi Doğrula" active for any unverified payment — EFT/Havale needs manual admin check
              const canVerifyPayment = !["verified", "succeeded"].includes(paymentStatus);
              const canApprove = ["pending", "needs_info"].includes(approvalStatus)
                && ["verified", "succeeded", "not_required"].includes(paymentStatus)
                && !hasPendingCategoryReview;
              const canRequestInfo = ["pending", "needs_info"].includes(approvalStatus);
              const canReject = ["pending", "needs_info", "rejected"].includes(approvalStatus);
              const canResend = !tenant.initial_admin_invitation_accepted && !!tenant.owner_user_id;
              const isBusy = onboardingMembershipActionTenantId === tenant.id;
              const isExpanded = expandedCards.has(tenant.id);

              const decisionGuidance = canVerifyPayment
                ? "Dekont veya hareket kanıtı geldiği için önce ödeme doğrulama yapılmalı."
                : hasPendingCategoryReview
                  ? "Listede olmayan kategori talepleri için önce destek ve final onay akışı tamamlanmalı."
                  : canApprove
                    ? "Ödeme gereklilikleri tamamlandı. Kategori uyumu ve tenant sahibi bilgilerinde eksik yoksa aktivasyon onayı verilebilir."
                    : approvalStatus === "needs_info"
                      ? "Kayıt ek bilgi bekliyor. Yeni dekont veya teyit tamamlanana kadar bekletilmeli."
                      : approvalStatus === "rejected"
                        ? "Bu kayıt reddedilmiş. Yeniden ilerletilecekse önce operasyon notu kontrol edilmeli."
                        : "Kayıt ilk inceleme aşamasında. Kategori, plan, ödeme ve aktivasyon notları birlikte değerlendirilerek karar verilmeli.";

              const decisionTone = canApprove ? "green" : canVerifyPayment ? "orange" : approvalStatus === "needs_info" ? "blue" : approvalStatus === "rejected" ? "red" : "slate";

              // Card tone based on REAL approval status (not normalized)
              const cardTone = rawApprovalStatus === "approved" ? "approved"
                : rawApprovalStatus === "rejected" ? "rejected"
                : rawApprovalStatus === "needs_info" ? "needs_info"
                : "pending";

              // Badge shows REAL status
              const badgeLabel = rawApprovalStatus === "approved" ? "Onaylandı"
                : rawApprovalStatus === "rejected" ? "Reddedildi"
                : rawApprovalStatus === "needs_info" ? "Bilgi Bekliyor"
                : rawApprovalStatus === "pending" ? "Onay Bekliyor"
                : formatOnboardingApprovalStatus(tenant.onboarding_approval_status);

              return (
                <div key={tenant.id} className={`osTab__card osTab__card--${cardTone}`}>

                  {/* ── Collapsible header ────────────────────── */}
                  <button
                    type="button"
                    className="osTab__cardToggle"
                    onClick={() => toggleCard(tenant.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="osTab__cardTitleGroup">
                      <div className="osTab__cardName">{tenant.brand_name || tenant.legal_name}</div>
                      <div className="osTab__cardMeta">
                        <span>{tenant.owner_email || "owner e-postası yok"}</span>
                        <span className="osTab__dot" />
                        <span>{tenant.subscription_plan_code || "starter"}</span>
                        <span className="osTab__dot" />
                        <span>{String(tenant.subscription_plan_code || "").startsWith("supplier") ? "Tedarikçi" : "Stratejik Partner"}</span>
                      </div>
                    </div>
                    <div className="osTab__cardHeadRight">
                      <span className={`osTab__badge osTab__badge--${cardTone}`}>{badgeLabel}</span>
                      <span className={`osTab__chevron ${isExpanded ? "osTab__chevron--open" : ""}`}>▾</span>
                    </div>
                  </button>

                  {/* ── Collapsible body ──────────────────────── */}
                  {isExpanded ? (
                    <div className="osTab__cardBody">

                      {/* Status cells */}
                      <div className="osTab__statusRow">
                        <div className="osTab__statusCell">
                          <div className="osTab__cellLabel">Ödeme Durumu</div>
                          <div className="osTab__cellValue">{formatOnboardingPaymentStatus(tenant.onboarding_payment_status)}</div>
                          <div className="osTab__cellNote">{tenant.onboarding_payment_method || "yöntem yok"}</div>
                        </div>
                        <div className="osTab__statusCell">
                          <div className="osTab__cellLabel">Kurulum Durumu</div>
                          <div className="osTab__cellValue">{formatPartnerOnboardingStatus(tenant.onboarding_status)}</div>
                          <div className="osTab__cellNote">{tenant.onboarding_approved_by_name || "karar bekleniyor"}</div>
                        </div>
                        <div className="osTab__statusCell">
                          <div className="osTab__cellLabel">Aktivasyon</div>
                          <div className="osTab__cellValue">{formatActivationDeliveryStatus(tenant.activation_delivery_status)}</div>
                          <div className="osTab__cellNote">
                            {tenant.initial_admin_invitation_accepted ? "İlk admin aktive edildi" : "Mail bekleniyor"}
                          </div>
                        </div>
                        <div className="osTab__statusCell">
                          <div className="osTab__cellLabel">Kategori Eşleşme</div>
                          <div className="osTab__cellValue">
                            {matchingSupplierCount > 0 ? `${matchingSupplierCount} supplier` : "Eşleşme yok"}
                          </div>
                          <div className="osTab__cellNote">{normalizedCategory || "Kategori eksik"}</div>
                        </div>
                      </div>

                      {/* Category tags */}
                      <div className="osTab__tagRow">
                        {(categoryTags.length > 0 ? categoryTags : [normalizedCategory || "Kategori eksik"]).map((item) => (
                          <span key={`${tenant.id}-${item}`} className={`osTab__tag osTab__tag--${item !== "Kategori eksik" ? "teal" : "slate"}`}>
                            {item}
                          </span>
                        ))}
                        {targetCategoryTags.map((item) => (
                          <span key={`${tenant.id}-target-${item}`} className="osTab__tag osTab__tag--indigo">
                            hedef: {item}
                          </span>
                        ))}
                        <span className={`osTab__tag osTab__tag--${matchingSupplierCount > 0 ? "green" : "orange"}`}>
                          {matchingSupplierCount > 0 ? `${matchingSupplierCount} supplier eşleşiyor` : "Eşleşen supplier yok"}
                        </span>
                      </div>

                      {/* Category requests */}
                      {categoryRequests.length > 0 ? (
                        <div className="osTab__catRequestList">
                          <div className="osTab__notesLabel">Kategori Talep Onayı</div>
                          {categoryRequests.map((item) => {
                            const reqStatus = String(item.status || "pending_support").toLowerCase();
                            const reqTone = reqStatus === "final_approved" ? "green" : reqStatus === "rejected" ? "red" : reqStatus === "support_approved" ? "blue" : "orange";
                            return (
                              <div key={`${tenant.id}-req-${String(item.name)}-${String(item.applies_to)}`} className="osTab__catRequest">
                                <div className="osTab__catRequestHead">
                                  <span className="osTab__catRequestName">{String(item.name || "")}</span>
                                  <span className={`osTab__tag osTab__tag--${reqTone}`}>{formatCategoryRequestStatus(item.status)}</span>
                                </div>
                                <div className="osTab__catRequestNote">
                                  {item.applies_to === "target" ? "Hedef kategori talebi" : "Faaliyet kategorisi talebi"}
                                  {item.note ? ` • ${String(item.note)}` : ""}
                                </div>
                                <div className="osTab__actions">
                                  {reqStatus === "pending_support" ? (
                                    <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "support_approved")} className="osTab__btn osTab__btn--orange osTab__btn--sm">
                                      Destek Onayı
                                    </button>
                                  ) : null}
                                  {["pending_support", "support_approved"].includes(reqStatus) ? (
                                    <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "final_approved")} className="osTab__btn osTab__btn--blue osTab__btn--sm">
                                      Final Onayla
                                    </button>
                                  ) : null}
                                  {!["final_approved", "rejected"].includes(reqStatus) ? (
                                    <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "rejected")} className="osTab__btn osTab__btn--red osTab__btn--sm">
                                      Reddet
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {/* Decision guide */}
                      <div className={`osTab__guide osTab__guide--${decisionTone}`}>
                        <strong>Karar Rehberi</strong>
                        {decisionGuidance}
                      </div>

                      {/* Operation notes */}
                      {tenant.onboarding_payment_receipt_url || tenant.onboarding_payment_note || tenant.onboarding_activation_notes ? (
                        <div className="osTab__notes">
                          <div className="osTab__notesLabel">Operasyon Notları</div>
                          {tenant.onboarding_payment_receipt_url ? (
                            <a href={tenant.onboarding_payment_receipt_url} target="_blank" rel="noreferrer" className="osTab__link">
                              {tenant.onboarding_payment_receipt_name || "Dekontu Aç"}
                            </a>
                          ) : null}
                          {tenant.onboarding_payment_note ? (
                            <div className="osTab__noteText">{tenant.onboarding_payment_note}</div>
                          ) : null}
                          {tenant.onboarding_activation_notes ? (
                            <div className="osTab__noteText osTab__noteText--brown">{tenant.onboarding_activation_notes}</div>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Decision timeline */}
                      {tenant.onboarding_decision_timeline && tenant.onboarding_decision_timeline.length > 0 ? (
                        <div>
                          <div className="osTab__notesLabel osTab__subLabel">Karar Zaman Çizelgesi</div>
                          <div className="osTab__timeline">
                            {tenant.onboarding_decision_timeline.slice().reverse().map((item, index) => (
                              <div key={`${String(item.at)}-${index}`} className="osTab__timelineItem">
                                <div className="osTab__timelineTitle">{String(item.actor_name || "")} · {String(item.action || "")}</div>
                                <div className="osTab__timelineMeta">{new Date(String(item.at)).toLocaleString("tr-TR")} · {String(item.actor_type || "")}</div>
                                {item.note ? <div className="osTab__timelineNote">{String(item.note)}</div> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Resend message */}
                      {resendMessages[tenant.id] ? (
                        <div className="osTab__resendMsg">{resendMessages[tenant.id]}</div>
                      ) : null}

                      {/* Primary action buttons */}
                      <div className="osTab__actions">
                        <button
                          type="button"
                          disabled={!canVerifyPayment || isBusy}
                          onClick={() => void handleVerifyOnboardingPayment(tenant.id)}
                          className="osTab__btn osTab__btn--orange"
                        >
                          Ödemeyi Doğrula
                        </button>
                        <button
                          type="button"
                          disabled={!canApprove || isBusy}
                          onClick={() => void handleApproveOnboardingMembership(tenant.id)}
                          className="osTab__btn osTab__btn--primary"
                        >
                          Üyelik Aktivasyonunu Onayla
                        </button>
                        <button
                          type="button"
                          disabled={!canRequestInfo || isBusy}
                          onClick={() => void handleRequestOnboardingInfo(tenant.id)}
                          className="osTab__btn osTab__btn--blue"
                        >
                          Ek Bilgi / Dekont İste
                        </button>
                        <button
                          type="button"
                          disabled={!canReject || isBusy}
                          onClick={() => void handleRejectOnboardingMembership(tenant.id)}
                          className="osTab__btn osTab__btn--red"
                        >
                          Reddet
                        </button>
                        {canResend ? (
                          <button
                            type="button"
                            disabled={resendingTenantId === tenant.id}
                            onClick={() => void handleResendActivation(tenant.id, tenant.owner_user_id)}
                            className="osTab__btn osTab__btn--ghost"
                          >
                            {resendingTenantId === tenant.id ? "Gönderiliyor..." : "Aktivasyon Mailini Tekrar Gönder"}
                          </button>
                        ) : null}
                      </div>

                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom two-column ────────────────────────────────────── */}
      <div className="osTab__twoCol">

        {/* Operations guide */}
        <div className="osTab__panel">
          <div className="osTab__panelHead">
            <div className="osTab__eyebrow osTab__eyebrow--teal">Operasyon Akışı</div>
            <div className="osTab__panelTitle">Kurulum adımları</div>
          </div>
          <div className="osTab__flowList">
            {[
              "Stratejik Partner Yönetimi sekmesinden plan ve kurulum durumunu seç.",
              "İlk admin e-postasını initial_admin alanlarıyla aç ve owner atamasını tamamla.",
              "Kurulum durumunu taslak → onboarding → aktif sırasıyla ilerlet.",
              "Branding, destek kanalı ve paket limitleri aktif olmadan canlıya geçme.",
            ].map((item) => (
              <div key={item} className="osTab__flowItem">{item}</div>
            ))}
          </div>
        </div>

        {/* RFQ readiness */}
        <div className="osTab__panel">
          <div className="osTab__panelHead">
            <div className="osTab__eyebrow osTab__eyebrow--violet">RFQ Geçiş Hazırlığı</div>
            <div className="osTab__panelTitle">Veri tutarlılığı</div>
          </div>

          <div className={`osTab__readinessBanner osTab__readinessBanner--${s.rfq_readiness.transition_ready ? "ready" : "blocked"}`}>
            {s.rfq_readiness.transition_ready
              ? "Stratejik Partner RFQ geçişi için kritik blokaj görünmüyor"
              : "Stratejik Partner RFQ geçişi öncesi veri düzeltme gerekli"}
          </div>

          <div className="osTab__rfqNotes">
            {[
              "Quotes, quote_approvals ve supplier_quotes Stratejik Partner tutarlılığı audit ile izlenir.",
              "Platform network supplier senaryosu Stratejik Partner-private supplier ayrımıyla korunur.",
              "Stratejik Partner RFQ modeline geçmeden önce quote domain readiness skoru üretilir.",
            ].map((item) => (
              <div key={item} className="osTab__rfqNote">{item}</div>
            ))}
          </div>

          <div className="osTab__readinessGrid">
            {[
              { label: "SP Eksik Quote", value: s.rfq_readiness.quotes_missing_tenant, tone: "red" },
              { label: "SP Eksik Approval", value: s.rfq_readiness.approvals_missing_tenant, tone: "orange" },
              { label: "Approval-Quote Uyumsuz", value: s.rfq_readiness.approvals_quote_tenant_mismatch, tone: "brown" },
              { label: "Quote-Proje Uyumsuz", value: s.rfq_readiness.quotes_project_tenant_mismatch, tone: "dark-brown" },
              { label: "Supplier-Quote Uyumsuz", value: s.rfq_readiness.supplier_quote_scope_mismatch, tone: "violet" },
              { label: "Platform Ağı Teklif", value: s.rfq_readiness.supplier_quotes_platform_network_count, tone: "teal" },
            ].map((item) => (
              <div key={item.label} className={`osTab__readinessCard osTab__readinessCard--${item.tone}`}>
                <div className="osTab__readinessLabel">{item.label}</div>
                <div className="osTab__readinessValue">{item.value}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="osTab__eyebrow osTab__eyebrow--teal osTab__subLabel">Tedarikçi Kaynak Dengesi</div>
            <div className="osTab__supplierGrid">
              <div className="osTab__supplierCard osTab__supplierCard--blue">
                <div className="osTab__supplierLabel">Özel Tedarikçi</div>
                <div className="osTab__supplierValue">{s.supplier_mix.private_count}</div>
              </div>
              <div className="osTab__supplierCard osTab__supplierCard--violet">
                <div className="osTab__supplierLabel">Platform Ağı</div>
                <div className="osTab__supplierValue">{s.supplier_mix.platform_network_count}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

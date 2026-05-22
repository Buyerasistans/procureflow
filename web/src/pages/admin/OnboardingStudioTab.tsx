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
    <section className="onboarding-studio">
      <div className="onboarding-studio__hero">
        <div className="onboarding-studio__eyebrow onboarding-studio__eyebrow--warm">Kurulum Studyosu</div>
        <div className="onboarding-studio__title">Yeni Stratejik Partner kurulum iskeleti</div>
        <div className="onboarding-studio__copy">Plan secimi, Stratejik Partner kaydi, ilk admin aktivasyonu ve ilk kurulum sihirbazi icin operasyon akisini tek ekranda toplar.</div>
      </div>

      <div className="onboarding-studio__metric-grid">
        {[
          { label: "Stratejik Partner", value: onboardingStudioSummary.tenant_count, note: "Toplam Stratejik Partner portfoyu", tone: "blue" },
          { label: "Onboarding Kuyrugu", value: onboardingStudioSummary.onboarding_queue_count, note: "Aktif olmayan kurulum akislari", tone: "amber" },
          { label: "Owner Eksigi", value: onboardingStudioSummary.owner_pending_count, note: "Sahip atamasi bekleyen Stratejik Partner", tone: "red" },
          { label: "Branding Eksigi", value: onboardingStudioSummary.branding_pending_count, note: "Logo veya brand name eksigi", tone: "violet" },
          { label: "Yeni Uyelik", value: onboardingStudioSummary.new_membership_count, note: "Public onboarding ile gelen yeni basvurular", tone: "teal" },
          { label: "Odeme Kontrol", value: onboardingStudioSummary.payment_review_count, note: "Odeme dogrulamasi bekleyen uyelikler", tone: "orange" },
          { label: "Bilgi Istendi", value: onboardingStudioSummary.information_requested_count, note: "Ek bilgi veya yeni dekont bekleyen uyelikler", tone: "sky" },
          { label: "Onay Bekliyor", value: onboardingStudioSummary.activation_approval_waiting_count, note: "Aktivasyon onayi bekleyen uyelikler", tone: "purple" },
          { label: "Onaylandi", value: onboardingStudioSummary.approved_membership_count, note: "Aktivasyonu tamamlanan yeni uyelikler", tone: "green" },
        ].map((item) => (
          <div key={item.label} className={`onboarding-studio__metric onboarding-studio__tone--${item.tone}`}>
            <div className="onboarding-studio__metric-label">{item.label}</div>
            <div className="onboarding-studio__metric-value">{item.value}</div>
            <div className="onboarding-studio__small-muted">{item.note}</div>
          </div>
        ))}
      </div>

      <div className="onboarding-studio__step-grid">
        {searchParams.get("onboardingPlanFocus") ? (
          <div className="onboarding-studio__full-width">
            {renderAdminFocusBanner({
              eyebrow: "Admin Focus",
              title: `Onboarding odagi: ${String(searchParams.get("onboardingPlanFocus") || "").toUpperCase()} plani`,
              detail: "Secilen onboarding planina ait kartlar oncelikli olarak vurgulaniyor.",
              tone: "blue",
              sourceLabel: "Onboarding deep-link",
              actions: [{ label: "Odagi Temizle", onClick: () => navigateAdminTab("onboarding_studio") }],
              testId: "admin-focus-banner-onboarding",
            })}
          </div>
        ) : null}
        {[
          { title: "1. Plan Secimi", note: "Starter, Growth veya Enterprise paketi ile ticari cerceveyi sabitle.", status: "Hazir", tone: "sky", action: "starter" },
          { title: "2. Stratejik Partner Kaydi", note: "Stratejik Partner slug, branding ve sahip kullanici adayi ile workspace kaydini ac.", status: "Hazir", tone: "teal", action: "growth" },
          { title: "3. Ilk Admin Aktivasyonu", note: "Owner daveti ve ilk yonetici aktivasyonunu tamamla.", status: "Hazir", tone: "amber", action: "enterprise" },
          { title: "4. Kurulum Sihirbazi", note: "Sirket, departman, roller, proje ve tedarikci tohumlarini adim adim tamamlama akisini kur.", status: "Taslak", tone: "violet", action: null },
        ].filter((card) => {
          const focus = searchParams.get("onboardingPlanFocus");
          if (!focus) return true;
          return card.action === focus || card.action === null;
        }).map((card) => (
          <div key={card.title} className={`onboarding-studio__step-card onboarding-studio__tone--${card.tone} ${searchParams.get("onboardingPlanFocus") === card.action ? "onboarding-studio__step-card--focused" : ""}`}>
            <div className="onboarding-studio__eyebrow">{card.status}</div>
            <div className="onboarding-studio__step-title">{card.title}</div>
            <div className="onboarding-studio__detail-copy">{card.note}</div>
            {card.action ? (
              <div className="onboarding-studio__actions">
                <button
                  type="button"
                  onClick={() => handleStartOnboardingTemplate(card.action)}
                  className="onboarding-studio__action-button onboarding-studio__action-button--blue"
                >
                  Stratejik Partner formuna tasla
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateDraftTenant(card.action)}
                  className="onboarding-studio__action-button onboarding-studio__action-button--indigo"
                >
                  Taslak Stratejik Partner olustur
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="onboarding-studio__panel">
        <div className="onboarding-studio__eyebrow onboarding-studio__tone--blue">Yeni Uyelik Onay Masasi</div>
        <div className="onboarding-studio__title">Odeme kontrolu ve aktivasyon onayi</div>
        <div className="onboarding-studio__copy">Public ana sayfadan gelen stratejik partner ve tedarikci uyelik basvurulari burada takip edilir. Ucretli planlarda EFT dahil tum odemeler dogrulanmadan ve super admin onayi verilmeden aktivasyon tamamlanmaz.</div>
        <div className="onboarding-studio__info-box onboarding-studio__info-box--blue">
          <div className="onboarding-studio__eyebrow onboarding-studio__tone--blue">Kategori ve Eslesme Notu</div>
          <div className="onboarding-studio__body-copy">
            Onboarding sirasinda toplanan kategori bilgisi burada yalnizca bir profil alani olarak durmaz. Super admin ekibi bu veriyi stratejik partner kapsami, supplier uygunlugu ve kategori eksigi olan basvurulari hizlica ayiklamak icin kullanir.
          </div>
          <div className="onboarding-studio__small-body">
            Ozellikle supplier ve stratejik partner basvurularinda kategori uyumu; aktivasyon karari sonrasi hangi havuzun once acilacagini, hangi tenantin ek supplier sourcing ihtiyaci tasidigini ve hangi kayitlarin operasyonel takip gerektirdigini gosterir.
          </div>
        </div>
        {onboardingStudioSummary.recent_memberships.length === 0 ? (
          <div className="onboarding-studio__empty">
            Gosterilecek yeni uyelik kaydi yok.
          </div>
        ) : (
          <div className="onboarding-studio__list">
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
              const decisionTone = canApprove ? "green" : canVerifyPayment ? "orange" : approvalStatus === "needs_info" ? "blue" : approvalStatus === "rejected" ? "red" : "slate";
              return (
                <div key={tenant.id} className="onboarding-studio__membership-card">
                  <div className="onboarding-studio__card-header">
                    <div>
                      <div className="onboarding-studio__membership-title">{tenant.brand_name || tenant.legal_name}</div>
                      <div className="onboarding-studio__membership-meta">{tenant.owner_email || "owner e-postasi yok"} • {tenant.subscription_plan_code || "starter"} • {String(tenant.subscription_plan_code || "").startsWith("supplier") ? "tedarikci uyeligi" : "stratejik partner uyeligi"}</div>
                    </div>
                    <span className={`onboarding-studio__status-chip ${approvalStatus === "approved" ? "onboarding-studio__status-chip--approved" : "onboarding-studio__status-chip--pending"}`}>
                      {formatOnboardingApprovalStatus(tenant.onboarding_approval_status)}
                    </span>
                  </div>
                  <div className="onboarding-studio__detail-grid">
                    <div className="onboarding-studio__detail-card">
                      <div className="onboarding-studio__mini-label">Odeme Durumu</div>
                      <div className="onboarding-studio__mini-value">{formatOnboardingPaymentStatus(tenant.onboarding_payment_status)}</div>
                      <div className="onboarding-studio__mini-note">{tenant.onboarding_payment_method || "yontem yok"}</div>
                    </div>
                    <div className="onboarding-studio__detail-card">
                      <div className="onboarding-studio__mini-label">Kurulum Durumu</div>
                      <div className="onboarding-studio__mini-value">{formatPartnerOnboardingStatus(tenant.onboarding_status)}</div>
                      <div className="onboarding-studio__mini-note">{tenant.onboarding_approved_by_name || "super admin karari bekleniyor"}</div>
                    </div>
                    <div className="onboarding-studio__detail-card">
                      <div className="onboarding-studio__mini-label">Aktivasyon</div>
                      <div className="onboarding-studio__mini-value">{formatActivationDeliveryStatus(tenant.activation_delivery_status)}</div>
                      <div className="onboarding-studio__mini-note">
                        {tenant.initial_admin_invitation_accepted ? "Ilk admin hesabi aktive edildi" : "Aktivasyon bekleniyor"}
                      </div>
                    </div>
                    <div className="onboarding-studio__detail-card">
                      <div className="onboarding-studio__mini-label">Kategori ve Eslesme</div>
                      <div className="onboarding-studio__tag-row">
                        {(categoryTags.length > 0 ? categoryTags : [normalizedTenantCategory || "Kategori eksik"]).map((item) => (
                          <span key={`${tenant.id}-${item}`} className={`onboarding-studio__tag ${item !== "Kategori eksik" ? "onboarding-studio__tag--teal" : "onboarding-studio__tag--slate"}`}>
                            {item}
                          </span>
                        ))}
                        {targetCategoryTags.map((item) => (
                          <span key={`${tenant.id}-target-${item}`} className="onboarding-studio__tag onboarding-studio__tag--indigo">
                            hedef: {item}
                          </span>
                        ))}
                        <span className={`onboarding-studio__tag ${matchingSupplierCount > 0 ? "onboarding-studio__tag--green" : "onboarding-studio__tag--orange"}`}>
                          {matchingSupplierCount > 0 ? `${matchingSupplierCount} supplier eslesiyor` : "Eslesen supplier yok"}
                        </span>
                      </div>
                      <div className="onboarding-studio__mini-note onboarding-studio__mini-note--spaced">
                        {matchingCategoryPool.length > 0 ? "Aktivasyon sonrasi sourcing havuzu secilen ve hedef kategorilere gore acilabilir." : "Kategori netlesmeden aktivasyon verilirse supplier havuzu zayif acilir."}
                      </div>
                    </div>
                  </div>
                  {categoryRequests.length > 0 ? (
                    <div className="onboarding-studio__subpanel">
                      <div className="onboarding-studio__mini-label">Kategori Talep Onayi</div>
                      {categoryRequests.map((item) => {
                        const requestStatus = String(item.status || "pending_support").toLowerCase();
                        const statusTone = requestStatus === "final_approved" ? "green" : requestStatus === "rejected" ? "red" : requestStatus === "support_approved" ? "blue" : "orange";
                        const isBusy = onboardingMembershipActionTenantId === tenant.id;
                        return (
                          <div key={`${tenant.id}-request-${item.name}-${item.applies_to}`} className="onboarding-studio__request-card">
                            <div className="onboarding-studio__card-header">
                              <div className="onboarding-studio__strong-text">{item.name}</div>
                              <span className={`onboarding-studio__tag onboarding-studio__tag--${statusTone}`}>
                                {formatCategoryRequestStatus(item.status)}
                              </span>
                            </div>
                            <div className="onboarding-studio__small-muted">
                              {item.applies_to === "target" ? "Hedef kategori talebi" : "Faaliyet kategorisi talebi"}
                              {item.note ? ` • ${item.note}` : ""}
                            </div>
                            <div className="onboarding-studio__actions">
                              {requestStatus === "pending_support" ? (
                                <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "support_approved")} className="onboarding-studio__action-button onboarding-studio__action-button--orange">
                                  Destek Onayi Ver
                                </button>
                              ) : null}
                              {["pending_support", "support_approved"].includes(requestStatus) ? (
                                <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "final_approved")} className="onboarding-studio__action-button onboarding-studio__action-button--blue">
                                  Final Onayla
                                </button>
                              ) : null}
                              {!['final_approved', 'rejected'].includes(requestStatus) ? (
                                <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "rejected")} className="onboarding-studio__action-button onboarding-studio__action-button--red">
                                  Reddet
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className={`onboarding-studio__decision-guide onboarding-studio__decision-guide--${decisionTone}`}>
                    <strong className="onboarding-studio__block-label">Karar Rehberi</strong>
                    {decisionGuidance}
                  </div>
                  {tenant.onboarding_payment_receipt_url || tenant.onboarding_payment_note || tenant.onboarding_activation_notes ? (
                    <div className="onboarding-studio__subpanel onboarding-studio__subpanel--compact">
                      <div className="onboarding-studio__mini-label">Operasyon Notlari</div>
                      {tenant.onboarding_payment_receipt_url ? (
                        <a href={tenant.onboarding_payment_receipt_url} target="_blank" rel="noreferrer" className="onboarding-studio__link">
                          {tenant.onboarding_payment_receipt_name || "Dekontu ac"}
                        </a>
                      ) : null}
                      {tenant.onboarding_payment_note ? <div className="onboarding-studio__small-body">{tenant.onboarding_payment_note}</div> : null}
                      {tenant.onboarding_activation_notes ? <div className="onboarding-studio__small-body onboarding-studio__small-body--brown">{tenant.onboarding_activation_notes}</div> : null}
                    </div>
                  ) : null}
                  {tenant.onboarding_decision_timeline && tenant.onboarding_decision_timeline.length > 0 ? (
                    <div className="onboarding-studio__subpanel">
                      <div className="onboarding-studio__mini-label">Karar Zaman Cizelgesi</div>
                      {tenant.onboarding_decision_timeline.slice().reverse().map((item, index) => (
                        <div key={`${item.at}-${index}`} className="onboarding-studio__timeline-item">
                          <div className="onboarding-studio__timeline-title">{item.actor_name} • {item.action}</div>
                          <div className="onboarding-studio__small-muted">{new Date(item.at).toLocaleString("tr-TR")} • {item.actor_type}</div>
                          {item.note ? <div className="onboarding-studio__small-dark">{item.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="onboarding-studio__actions">
                    <button
                      type="button"
                      disabled={!canVerifyPayment || onboardingMembershipActionTenantId === tenant.id}
                      onClick={() => void handleVerifyOnboardingPayment(tenant.id)}
                      className="onboarding-studio__action-button onboarding-studio__action-button--orange"
                    >
                      Odemeyi Dogrula
                    </button>
                    <button
                      type="button"
                      disabled={!canApprove || onboardingMembershipActionTenantId === tenant.id}
                      onClick={() => void handleApproveOnboardingMembership(tenant.id)}
                      className="onboarding-studio__action-button onboarding-studio__action-button--primary"
                    >
                      Uyelik Aktivasyonunu Onayla
                    </button>
                    <button
                      type="button"
                      disabled={!canRequestInfo || onboardingMembershipActionTenantId === tenant.id}
                      onClick={() => void handleRequestOnboardingInfo(tenant.id)}
                      className="onboarding-studio__action-button onboarding-studio__action-button--blue"
                    >
                      Ek Bilgi / Yeni Dekont Iste
                    </button>
                    <button
                      type="button"
                      disabled={!canReject || onboardingMembershipActionTenantId === tenant.id}
                      onClick={() => void handleRejectOnboardingMembership(tenant.id)}
                      className="onboarding-studio__action-button onboarding-studio__action-button--red"
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

      <div className="onboarding-studio__two-column-grid">
        <div className="onboarding-studio__panel">
          <div className="onboarding-studio__eyebrow onboarding-studio__tone--teal">Operasyon Akisi</div>
          {[
            "Stratejik Partner Yonetimi sekmesinden plan ve kurulum durumunu sec.",
            "Ilk admin e-postasini initial_admin alanlari ile ac ve owner atamasini tamamla.",
            "Kurulum durumunu taslak > onboarding > aktif seklinde ilerlet.",
            "Branding, destek kanali ve paket limitleri aktif olmadan canliya gecme.",
          ].map((item) => (
            <div key={item} className="onboarding-studio__flow-item">{item}</div>
          ))}
        </div>

        <div className="onboarding-studio__panel">
          <div className="onboarding-studio__eyebrow onboarding-studio__tone--violet">RFQ Gecis Hazirligi</div>
          <div className={`onboarding-studio__readiness-banner ${onboardingStudioSummary.rfq_readiness.transition_ready ? "onboarding-studio__readiness-banner--ready" : "onboarding-studio__readiness-banner--blocked"}`}>
            {onboardingStudioSummary.rfq_readiness.transition_ready ? "Stratejik Partner RFQ gecisi icin kritik blokaj gorunmuyor" : "Stratejik Partner RFQ gecisi oncesi veri duzeltme gerekli"}
          </div>
          {[
            "Quotes, quote_approvals ve supplier_quotes Stratejik Partner tutarliligi audit ile izlenir.",
            "Platform network supplier senaryosu Stratejik Partner-private supplier ayrimiyla birlikte korunur.",
            "Stratejik Partner RFQ modeline gecmeden once quote domaini readiness skoru uretir.",
          ].map((item) => (
            <div key={item} className="onboarding-studio__rfq-note">{item}</div>
          ))}
          <div className="onboarding-studio__readiness-grid">
            {[
              { label: "Stratejik Partner Eksik Quote", value: onboardingStudioSummary.rfq_readiness.quotes_missing_tenant, tone: "red" },
              { label: "Stratejik Partner Eksik Approval", value: onboardingStudioSummary.rfq_readiness.approvals_missing_tenant, tone: "orange" },
              { label: "Approval-Quote Uyumsuz", value: onboardingStudioSummary.rfq_readiness.approvals_quote_tenant_mismatch, tone: "brown" },
              { label: "Quote-Proje Uyumsuz", value: onboardingStudioSummary.rfq_readiness.quotes_project_tenant_mismatch, tone: "dark-brown" },
              { label: "Supplier-Quote Uyumsuz", value: onboardingStudioSummary.rfq_readiness.supplier_quote_scope_mismatch, tone: "violet" },
              { label: "Platform Agi TedarikciTeklifi", value: onboardingStudioSummary.rfq_readiness.supplier_quotes_platform_network_count, tone: "teal" },
            ].map((item) => (
              <div key={item.label} className={`onboarding-studio__readiness-card onboarding-studio__tone--${item.tone}`}>
                <div className="onboarding-studio__readiness-label">{item.label}</div>
                <div className="onboarding-studio__readiness-value">{item.value}</div>
              </div>
            ))}
          </div>
          <div className="onboarding-studio__supplier-mix">
            <div className="onboarding-studio__eyebrow onboarding-studio__tone--teal">Tedarikci Kaynak Dengesi</div>
            <div className="onboarding-studio__supplier-grid">
              <div className="onboarding-studio__supplier-card onboarding-studio__tone--blue">
                <div className="onboarding-studio__supplier-label">Ozel Tedarikci</div>
                <div className="onboarding-studio__supplier-value">{onboardingStudioSummary.supplier_mix.private_count}</div>
              </div>
              <div className="onboarding-studio__supplier-card onboarding-studio__tone--violet">
                <div className="onboarding-studio__supplier-label">Platform Agi</div>
                <div className="onboarding-studio__supplier-value">{onboardingStudioSummary.supplier_mix.platform_network_count}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


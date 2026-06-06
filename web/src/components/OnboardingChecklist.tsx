/**
 * OnboardingChecklist — Aktivasyon sonrası platform tipine göre adım adım yönlendirme.
 * Dashboard'da görünür; localStorage'da ilerleme kaydedilir.
 * Tüm adımlar tamamlandığında veya kullanıcı ertelediğinde gizlenir.
 */
import { useState, useMemo, useEffect } from "react";
import type { CSSProperties } from "react";
import type { AuthUser } from "../context/auth-types";
import { getCompanies, getTenantUsers, getAdminSuppliers, type Company, type TenantUser } from "../services/admin.service";
import { getQuotes } from "../services/quote.service";
import "./OnboardingChecklist.css";

const DOCS_BASE = "https://buyerasistans.info/docs";
const SNOOZE_DAYS = 7;

// ---------------------------------------------------------------------------
// Adım tanımları — platform tipine göre
// ---------------------------------------------------------------------------

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  docSlug: string;
  /** Hangi sayfa veya aksiyon → uygulama içi bağlantı */
  actionPath?: string;
  actionLabel?: string;
}

const STEPS_STRATEGIC_PARTNER: ChecklistStep[] = [
  {
    id: "company_info",
    title: "Şirket bilgilerini tamamlayın",
    description: "Vergi numarası, adres ve telefon bilgilerinizi ekleyin.",
    docSlug: "stratejik-ortak/sirket-bilgileri",
    actionPath: "/admin?tab=companies",
    actionLabel: "Şirket Ayarları",
  },
  {
    id: "logo_upload",
    title: "Logo yükleyin",
    description: "Platformda şirketinizin markasını temsil edecek logoyu ekleyin.",
    docSlug: "stratejik-ortak/logo",
    actionPath: "/admin?tab=companies",
    actionLabel: "Logo Yükle",
  },
  {
    id: "invite_users",
    title: "Ekip üyelerini davet edin",
    description: "Departman yöneticilerini ve satın alma uzmanlarını platforma ekleyin.",
    docSlug: "stratejik-ortak/kullanici-daveti",
    actionPath: "/admin?tab=personnel",
    actionLabel: "Kullanıcı Ekle",
  },
  {
    id: "first_supplier",
    title: "İlk tedarikçinizi ekleyin",
    description: "Tedarikçi kaydı oluşturarak teklif süreci için hazır olun.",
    docSlug: "stratejik-ortak/tedarikci-ekleme",
    actionPath: "/admin?tab=suppliers",
    actionLabel: "Tedarikçi Ekle",
  },
  {
    id: "first_quote",
    title: "İlk satın alma talebini oluşturun",
    description: "Teklif talebi (RFQ) oluşturarak platformu deneyimleyin.",
    docSlug: "stratejik-ortak/ilk-teklif",
    actionPath: "/quotes/create",
    actionLabel: "Teklif Oluştur",
  },
];

const STEPS_SUPPLIER: ChecklistStep[] = [
  {
    id: "profile_complete",
    title: "Profil bilgilerinizi tamamlayın",
    description: "İletişim bilgileri, banka hesabı ve yetkili bilgilerini girin.",
    docSlug: "tedarikci/profil",
    actionPath: "/supplier/profile",
    actionLabel: "Profilime Git",
  },
  {
    id: "categories",
    title: "Hizmet / ürün kategorilerinizi seçin",
    description: "Hangi kategorilerde teklif vermek istediğinizi belirtin.",
    docSlug: "tedarikci/kategoriler",
    actionPath: "/supplier/profile",
    actionLabel: "Kategorileri Düzenle",
  },
  {
    id: "documents",
    title: "Belgelerinizi yükleyin",
    description: "Vergi levhası ve imza sirküleri gibi zorunlu belgeleri ekleyin.",
    docSlug: "tedarikci/belgeler",
    actionPath: "/supplier/profile",
    actionLabel: "Belge Yükle",
  },
  {
    id: "first_offer",
    title: "İlk teklif talebini kabul edin",
    description: "Size yönlendirilen RFQ'lara teklif vererek süreci keşfedin.",
    docSlug: "tedarikci/teklif-verme",
    actionPath: "/supplier",
    actionLabel: "Tekliflere Bak",
  },
];

const STEPS_CHANNEL: ChecklistStep[] = [
  {
    id: "profile_complete",
    title: "Profil bilgilerinizi tamamlayın",
    description: "İletişim bilgilerini ve şirket detaylarını ekleyin.",
    docSlug: "is-ortagi/profil",
    actionPath: "/profile",
    actionLabel: "Profile Git",
  },
  {
    id: "program_terms",
    title: "Program koşullarını onaylayın",
    description: "İş Ortağı Program koşullarını okuyun ve onaylayın.",
    docSlug: "is-ortagi/program-kosullari",
    actionPath: "/dashboard",
    actionLabel: "Koşulları Gör",
  },
  {
    id: "reference_client",
    title: "Referans müşteri bilgisini ekleyin",
    description: "Platformdan faydalanacak ilk müşteri adayınızı bildirin.",
    docSlug: "is-ortagi/referans",
    actionPath: "/dashboard",
    actionLabel: "Referans Ekle",
  },
];

const STEPS_GENERIC: ChecklistStep[] = [
  {
    id: "profile_complete",
    title: "Profil bilgilerinizi tamamlayın",
    description: "Ad, soyad ve iletişim bilgilerini güncel tutun.",
    docSlug: "aktivasyon",
    actionPath: "/profile",
    actionLabel: "Profile Git",
  },
  {
    id: "first_action",
    title: "Platformu keşfedin",
    description: "Ana menüden işlemlerinize başlayabilirsiniz.",
    docSlug: "aktivasyon/baslangic",
    actionPath: "/dashboard",
    actionLabel: "Başla",
  },
];

function resolveSteps(user: AuthUser): ChecklistStep[] {
  const sysRole = user.system_role || "";
  const workspaceLabel = (user.workspace_label || "").toLowerCase();
  const platformName = (user.platform_name || "").toLowerCase();

  if (sysRole === "supplier_user") return STEPS_SUPPLIER;
  if (workspaceLabel.includes("kanal") || workspaceLabel.includes("channel") || platformName.includes("channel")) return STEPS_CHANNEL;
  if (
    sysRole === "tenant_admin" ||
    sysRole === "tenant_owner" ||
    workspaceLabel.includes("stratejik") ||
    workspaceLabel.includes("strategic")
  ) {
    return STEPS_STRATEGIC_PARTNER;
  }
  return STEPS_GENERIC;
}

function isMeaningfulText(value: string | null | undefined): boolean {
  return Boolean(String(value || "").trim());
}

function isCompanyProfileComplete(company: Company): boolean {
  return [
    company.name,
    company.tax_office,
    company.tax_number,
    company.address,
    company.city,
    company.address_district,
    company.postal_code,
    company.phone,
  ].every(isMeaningfulText);
}

function isInvitedCollaborator(user: TenantUser, currentUserId: number): boolean {
  if (!user || user.id === currentUserId) return false;
  const systemRole = String(user.system_role || "").toLowerCase();
  const businessRole = String(user.role || "").toLowerCase();

  // İlk açılış sahibi ve platform hesaplarını onboarding davet metriğine dahil etmiyoruz.
  if (systemRole === "tenant_owner") return false;
  if (["super_admin", "platform_support", "platform_operator", "supplier_user"].includes(systemRole)) return false;
  if (businessRole === "super_admin") return false;
  if (user.is_active === false) return false;
  return true;
}

// ---------------------------------------------------------------------------
// localStorage yardımcıları
// ---------------------------------------------------------------------------

function getStorageKey(userId: number): string {
  return `onboarding_checklist_${userId}`;
}

function loadCompletedSteps(userId: number): Set<string> {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveCompletedSteps(userId: number, steps: Set<string>): void {
  localStorage.setItem(getStorageKey(userId), JSON.stringify([...steps]));
}

function getSnoozeKey(userId: number): string {
  return `onboarding_checklist_snoozed_${userId}`;
}

function isSnoozed(userId: number): boolean {
  try {
    const raw = localStorage.getItem(getSnoozeKey(userId));
    if (!raw) return false;
    const snoozeUntil = parseInt(raw, 10);
    return Date.now() < snoozeUntil;
  } catch {
    return false;
  }
}

function snooze(userId: number): void {
  const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(getSnoozeKey(userId), String(until));
}

// ---------------------------------------------------------------------------
// Bileşen
// ---------------------------------------------------------------------------

interface OnboardingChecklistProps {
  user: AuthUser;
}

export default function OnboardingChecklist({ user }: OnboardingChecklistProps) {
  const steps = useMemo(() => resolveSteps(user), [user]);

  const [completed, setCompleted] = useState<Set<string>>(() => loadCompletedSteps(user.id));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any>({ total: 0, items: [] });
  const [visible, setVisible] = useState(() => !isSnoozed(user.id));
  const [collapsed, setCollapsed] = useState(false);

  const verifiedCompleted = useMemo(() => {
    const nextVerified = new Set<string>();

    const primary = companies[0];
    if (primary && isCompanyProfileComplete(primary)) {
      nextVerified.add("company_info");
    }
    if (primary && isMeaningfulText(primary.logo_url)) {
      nextVerified.add("logo_upload");
    }

    const invitedCount = users.filter((person) => isInvitedCollaborator(person, user.id)).length;
    if (invitedCount >= 2) {
      nextVerified.add("invite_users");
    }

    const hasAnySupplier = suppliers.some((supplier) => supplier.is_active !== false);
    if (hasAnySupplier) {
      nextVerified.add("first_supplier");
    }

    const total = Number(quotes.total || 0);
    const hasAnyQuote = total > 0 || (quotes.items || []).length > 0;
    if (hasAnyQuote) {
      nextVerified.add("first_quote");
    }

    return nextVerified;
  }, [companies, users, suppliers, quotes, user.id]);

  const effectiveCompleted = useMemo(() => {
    const merged = new Set(completed);
    verifiedCompleted.forEach((stepId) => merged.add(stepId));
    return merged;
  }, [completed, verifiedCompleted]);

  const allDone = steps.every((s) => effectiveCompleted.has(s.id));

  useEffect(() => {
    saveCompletedSteps(user.id, completed);
  }, [user.id, completed]);

  useEffect(() => {
    const hasStrategicPartnerChecks = steps.some((step) => [
      "company_info",
      "logo_upload",
      "invite_users",
      "first_supplier",
      "first_quote",
    ].includes(step.id));

    if (!hasStrategicPartnerChecks) {
      setCompanies([]);
      setUsers([]);
      setSuppliers([]);
      setQuotes({ total: 0, items: [] });
      return;
    }

    const fetchData = async () => {
      const [companiesResult, usersResult, suppliersResult, quotesResult] = await Promise.allSettled([
        getCompanies(),
        getTenantUsers(),
        getAdminSuppliers({ filter_active: true }),
        getQuotes(1, 1),
      ]);

      if (companiesResult.status === "fulfilled") {
        setCompanies(companiesResult.value);
      }
      if (usersResult.status === "fulfilled") {
        setUsers(usersResult.value);
      }
      if (suppliersResult.status === "fulfilled") {
        setSuppliers(suppliersResult.value);
      }
      if (quotesResult.status === "fulfilled") {
        setQuotes(quotesResult.value);
      }
    };

    void fetchData();
  }, [steps, user.id]);

  if (!visible || allDone) return null;

  const doneCount = steps.filter((s) => effectiveCompleted.has(s.id)).length;
  const progressPct = Math.round((doneCount / steps.length) * 100);

  const handleToggle = (stepId: string) => {
    if (verifiedCompleted.has(stepId)) return;
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const handleSnooze = () => {
    snooze(user.id);
    setVisible(false);
  };

  return (
    <div className="oc-card">
      <div className="oc-header">
        <div>
          <div className="oc-header__eyebrow">Başlangıç Rehberi</div>
          <div className="oc-header__title">🎉 Hesabınız aktive edildi! Birkaç adımı tamamlayın.</div>
        </div>
        <div className="oc-header__actions">
          <button type="button" onClick={() => setCollapsed((v) => !v)} className="oc-btn">
            {collapsed ? "Göster ▼" : "Gizle ▲"}
          </button>
          <button
            type="button"
            onClick={handleSnooze}
            className="oc-btn"
            title={`${SNOOZE_DAYS} gün boyunca gizle`}
          >
            Sonraya Bırak
          </button>
        </div>
      </div>

      <div className="oc-progress">
        <div className="oc-progress__track">
          <div
            className="oc-progress__fill"
            style={{ "--oc-fill-w": `${progressPct}%` } as CSSProperties}
          />
        </div>
        <div className="oc-progress__label">{doneCount}/{steps.length} tamamlandı</div>
      </div>

      {!collapsed && (
        <div className="oc-steps">
          {steps.map((step) => {
            const isDone = effectiveCompleted.has(step.id);
            const isVerifiedDone = verifiedCompleted.has(step.id);
            return (
              <div
                key={step.id}
                className={`oc-step${isDone ? " oc-step--done" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(step.id)}
                  aria-label={isDone ? "Tamamlandı olarak işaretle (geri al)" : "Tamamlandı olarak işaretle"}
                  disabled={isVerifiedDone}
                  className={`oc-step__check${isDone ? " oc-step__check--done" : ""}${isVerifiedDone ? " oc-step__check--locked" : ""}`}
                >
                  {isDone ? "✓" : ""}
                </button>

                <div className="oc-step__body">
                  <div className={`oc-step__title${isDone ? " oc-step__title--done" : ""}`}>
                    {step.title}
                  </div>
                  {isVerifiedDone && (
                    <div className="oc-step__verified">Sistem tarafından doğrulandı</div>
                  )}
                  {!isDone && (
                    <div className="oc-step__desc">{step.description}</div>
                  )}
                </div>

                {!isDone && (
                  <div className="oc-step__actions">
                    {step.actionPath && step.actionLabel && (
                      <a href={step.actionPath} className="oc-step__action-btn">
                        {step.actionLabel}
                      </a>
                    )}
                    <a
                      href={`${DOCS_BASE}/${step.docSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="oc-step__doc-link"
                      title="Nasıl yapılır kılavuzunu aç"
                    >
                      Nasıl?
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!collapsed && (
        <div className="oc-footer">
          <div className="oc-footer__hint">
            Tüm adımları tamamladıktan sonra bu panel otomatik kapanır.
          </div>
          <a
            href={`${DOCS_BASE}/aktivasyon`}
            target="_blank"
            rel="noopener noreferrer"
            className="oc-footer__link"
          >
            Tam Başlangıç Kılavuzu →
          </a>
        </div>
      )}
    </div>
  );
}

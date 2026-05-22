import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRoleLabel } from "../auth/permissions";
import { sendAdminUserEmail, type CompanyAssignment, type TenantUser } from "../services/admin.service";
import { getEmailSettings, type EmailSettingsData } from "../services/advanced-settings.service";
import { getMailCenterAccounts, type MailCenterAccount } from "../services/mail-center.service";
import { getSystemEmails, type SystemEmail } from "../services/system-email.service";
import "./PersonnelDetailModal.css";

interface PersonnelDetailModalProps {
  personnel: TenantUser;
  onClose: () => void;
  onResetPassword?: (id: number) => void;
}

export default function PersonnelDetailModal({
  personnel,
  onClose,
  onResetPassword,
}: PersonnelDetailModalProps) {
  const navigate = useNavigate();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState(personnel.email || "");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState(`${personnel.full_name} - Bilgilendirme`);
  const [emailBody, setEmailBody] = useState("Merhaba,\n\n");
  const [emailFiles, setEmailFiles] = useState<File[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSettings, setEmailSettings] = useState<EmailSettingsData | null>(null);
  const [systemEmails, setSystemEmails] = useState<SystemEmail[]>([]);
  const [mailAccounts, setMailAccounts] = useState<MailCenterAccount[]>([]);
  const [selectedSystemEmailId, setSelectedSystemEmailId] = useState<number | "default">("default");

  const selectedSystemEmail =
    selectedSystemEmailId === "default"
      ? null
      : systemEmails.find((item) => item.id === selectedSystemEmailId) ?? null;

  const senderName = (
    selectedSystemEmail?.signature_name ||
    emailSettings?.signature_name ||
    emailSettings?.from_name ||
    "ProcureFlow"
  ).trim();
  const senderEmail = (
    selectedSystemEmail?.email ||
    emailSettings?.from_email ||
    emailSettings?.smtp_username ||
    ""
  ).trim();
  const replyToEmail = (selectedSystemEmail?.email || emailSettings?.reply_to_email || senderEmail).trim();

  const photoUrl =
    personnel.photo ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(personnel.full_name)}&background=0D8ABC&color=fff&size=128`;

  const phones: { label: string; value?: string | null }[] = [
    { label: "Şahsi", value: personnel.personal_phone },
    { label: "Firma", value: personnel.company_phone },
    { label: "Kısa Kod", value: personnel.company_phone_short },
  ];

  const address = personnel.address || "-";
  let city = "";
  let district = "";
  let addressDetail = "";
  if (address && address !== "-") {
    const parts = address.split(",").map((entry: string) => entry.trim());
    city = parts[0] || "";
    district = parts[1] || "";
    addressDetail = parts.slice(2).join(", ");
  }

  const mapQuery = encodeURIComponent(address);
  const mapUrl = address && address !== "-" ? `https://maps.google.com/?q=${mapQuery}` : undefined;
  const assignments: CompanyAssignment[] = Array.isArray(personnel.company_assignments)
    ? personnel.company_assignments
    : [];

  useEffect(() => {
    let mounted = true;

    void getEmailSettings()
      .then((data) => {
        if (mounted) setEmailSettings(data);
      })
      .catch(() => {
        if (mounted) setEmailSettings(null);
      });

    void getSystemEmails()
      .then((data) => {
        if (mounted) setSystemEmails(data.filter((item) => item.is_active !== false));
      })
      .catch(() => {
        if (mounted) setSystemEmails([]);
      });

    void getMailCenterAccounts()
      .then((data) => {
        if (mounted) setMailAccounts(data);
      })
      .catch(() => {
        if (mounted) setMailAccounts([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const linkedMailUnreadCount =
    mailAccounts.find(
      (account) =>
        String(account.email || "").trim().toLowerCase() ===
        String(personnel.email || "").trim().toLowerCase(),
    )?.unread_count || 0;

  useEffect(() => {
    if (systemEmails.length === 0) {
      setSelectedSystemEmailId("default");
      return;
    }

    setSelectedSystemEmailId((current) => {
      if (current === "default") return systemEmails[0]?.id ?? "default";
      return systemEmails.some((item) => item.id === current) ? current : systemEmails[0]?.id ?? "default";
    });
  }, [systemEmails]);

  function normalizePhone(phone?: string | null) {
    const digits = (phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("90") && digits.length >= 12) return digits.slice(2);
    if (digits.startsWith("0") && digits.length === 11) return digits.slice(1);
    return digits;
  }

  function getWhatsAppHref(phone?: string | null) {
    const digits = normalizePhone(phone);
    if (!digits) return undefined;
    return `https://wa.me/90${digits}`;
  }

  function openWhatsApp(phone?: string | null) {
    const href = getWhatsAppHref(phone);
    if (!href) return;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function openEmailComposer(targetEmail?: string | null) {
    if (!targetEmail) return;
    setEmailTo(targetEmail);
    setEmailCc("");
    setEmailSubject(`${personnel.full_name} - Bilgilendirme`);
    setEmailBody("Merhaba,\n\n");
    setEmailFiles([]);
    setEmailError("");
    setSelectedSystemEmailId(systemEmails[0]?.id ?? "default");
    setShowEmailModal(true);
  }

  async function handleSendEmail() {
    if (!emailTo || !emailSubject) {
      setEmailError("E-posta alıcısı ve konu zorunludur");
      return;
    }

    try {
      setEmailSending(true);
      setEmailError("");
      await sendAdminUserEmail(personnel.id, {
        to_email: emailTo,
        subject: emailSubject,
        body: emailBody,
        cc: emailCc || undefined,
        system_email_id: selectedSystemEmail?.id,
        attachments: emailFiles,
      });
      setShowEmailModal(false);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setEmailError(detail || "E-posta gönderilemedi");
    } finally {
      setEmailSending(false);
    }
  }

  async function shareContact(phone?: string | null) {
    const shareText = [
      `Ad Soyad: ${personnel.full_name}`,
      `E-posta: ${personnel.email}`,
      phone ? `Telefon: ${phone}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${personnel.full_name} iletişim kartı`,
          text: shareText,
        });
        return;
      } catch {
        // Kullanıcı paylaşımı iptal edebilir, clipboard fallback'e düş.
      }
    }

    await navigator.clipboard.writeText(shareText);
    window.alert("İletişim bilgileri panoya kopyalandı.");
  }

  function openMailCenter() {
    const params = new URLSearchParams({ tab: "mail" });
    const linkedAccount = mailAccounts.find(
      (account) =>
        String(account.email || "").trim().toLowerCase() ===
        String(personnel.email || "").trim().toLowerCase(),
    );

    if (linkedAccount?.id) {
      params.set("mailAccountId", String(linkedAccount.id));
    }
    if (personnel.email) {
      params.set("mailComposeTo", personnel.email);
    }
    navigate(`/admin?${params.toString()}`);
  }

  return (
    <div className="personnel-detail-modal__overlay">
      <div className="personnel-detail-modal__dialog">
        <div className="personnel-detail-modal__header">
          <div>
            <div className="personnel-detail-modal__eyebrow">İletişim Kartı</div>
            <h2 className="personnel-detail-modal__title">Ekip Uyesi Detaylari</h2>
          </div>
          <button type="button" onClick={onClose} className="personnel-detail-modal__close-button">
            ×
          </button>
        </div>

        <div className="personnel-detail-modal__content">
          <aside className="personnel-detail-modal__sidebar">
            <div className="personnel-detail-modal__profile">
              <img src={photoUrl} alt="Personel" className="personnel-detail-modal__photo" />
              <div className="personnel-detail-modal__name">{personnel.full_name}</div>
              <div className="personnel-detail-modal__role">{getRoleLabel(personnel.role) || "-"}</div>
              <div className="personnel-detail-modal__meta">
                Operasyonel rol{personnel.system_role ? ` • Sistem rolü: ${getRoleLabel(personnel.system_role)}` : ""}
              </div>
              <div className="personnel-detail-modal__email">{personnel.email}</div>

              <div className="personnel-detail-modal__actions">
                <button
                  type="button"
                  onClick={() => openEmailComposer(personnel.email)}
                  className="personnel-detail-modal__action-button personnel-detail-modal__action-button--mail"
                >
                  Mail Yolla
                </button>
                <button
                  type="button"
                  onClick={openMailCenter}
                  className="personnel-detail-modal__action-button personnel-detail-modal__action-button--center"
                >
                  Mail Merkezi
                  {linkedMailUnreadCount > 0 && (
                    <span className="personnel-detail-modal__badge personnel-detail-modal__badge--active">
                      {linkedMailUnreadCount}
                    </span>
                  )}
                </button>
              </div>

              <div
                className={`personnel-detail-modal__badge ${
                  personnel.is_active
                    ? "personnel-detail-modal__badge--active"
                    : "personnel-detail-modal__badge--inactive"
                }`}
              >
                <span>{personnel.is_active ? "Aktif Ekip Uyesi" : "Pasif Ekip Uyesi"}</span>
              </div>
            </div>

            <div className="personnel-detail-modal__phones">
              {phones
                .filter((phone) => phone.value)
                .map((phone) => (
                  <div key={phone.label} className="personnel-detail-modal__phone-card">
                    <div className="personnel-detail-modal__phone-label">{phone.label}</div>
                    <div className="personnel-detail-modal__phone-value">{phone.value}</div>
                    <div className="personnel-detail-modal__phone-actions">
                      <a
                        href={`tel:${(phone.value || "").replace(/\s+/g, "")}`}
                        className="personnel-detail-modal__phone-action personnel-detail-modal__phone-action--call"
                      >
                        Ara
                      </a>
                      <button
                        type="button"
                        onClick={() => openWhatsApp(phone.value)}
                        className={`personnel-detail-modal__phone-action personnel-detail-modal__phone-action--whatsapp ${
                          personnel.share_on_whatsapp === false
                            ? "personnel-detail-modal__phone-action--whatsapp-disabled"
                            : ""
                        }`}
                      >
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => shareContact(phone.value)}
                        className="personnel-detail-modal__phone-action personnel-detail-modal__phone-action--share"
                      >
                        Paylaş
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </aside>

          <main className="personnel-detail-modal__main">
            <section className="personnel-detail-modal__panel">
              <div className="personnel-detail-modal__panel-title">Firma ve Departman Atamaları</div>
              {assignments.length === 0 ? (
                <div className="personnel-detail-modal__empty">
                  Bu ekip uyesi icin kayitli firma atamasi bulunmuyor.
                </div>
              ) : (
                <div className="personnel-detail-modal__assignment-list">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="personnel-detail-modal__assignment-card">
                      <div className="personnel-detail-modal__assignment-row">
                        <div>
                          <div className="personnel-detail-modal__assignment-company">
                            {assignment.company?.name || "Firma seçilmemiş"}
                          </div>
                          <div className="personnel-detail-modal__assignment-department">
                            {assignment.department?.name || "Departman seçilmemiş"}
                          </div>
                        </div>
                        <div className="personnel-detail-modal__assignment-role">
                          {assignment.role?.name || "-"}
                        </div>
                      </div>
                      {assignment.sub_items && assignment.sub_items.length > 0 && (
                        <div className="personnel-detail-modal__tags">
                          {assignment.sub_items.map((item) => (
                            <span key={item} className="personnel-detail-modal__tag">
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="personnel-detail-modal__panel personnel-detail-modal__panel--secondary">
              <div className="personnel-detail-modal__location-title">Konum</div>
              <div className="personnel-detail-modal__location-value">
                {address !== "-" ? [city, district, addressDetail].filter(Boolean).join(", ") : "Adres girilmemiş"}
              </div>
              <div className="personnel-detail-modal__location-status">
                Harita görünürlüğü: {personnel.hide_location ? "Gizli" : "Açık"}
              </div>

              {!personnel.hide_location && mapUrl && (
                <div className="personnel-detail-modal__map">
                  <iframe
                    title="personnel-location-map"
                    className="personnel-detail-modal__map-iframe"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                  />
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="personnel-detail-modal__map-link"
                  >
                    Haritada Aç
                  </a>
                </div>
              )}
            </section>
          </main>
        </div>

        <div className="personnel-detail-modal__footer">
          {onResetPassword && (
            <button
              type="button"
              onClick={() => onResetPassword(personnel.id)}
              className="personnel-detail-modal__footer-button personnel-detail-modal__footer-button--reset"
            >
              Şifre Sıfırla
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="personnel-detail-modal__footer-button personnel-detail-modal__footer-button--close"
          >
            Kapat
          </button>
        </div>

        {showEmailModal && (
          <div
            className="personnel-detail-modal__email-overlay"
            onClick={() => setShowEmailModal(false)}
          >
            <div
              className="personnel-detail-modal__email-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="personnel-detail-modal__email-title">E-posta Gönder</h3>

              {emailError && <div className="personnel-detail-modal__error">{emailError}</div>}

              <div className="personnel-detail-modal__sender-box">
                <div className="personnel-detail-modal__sender-label">Gönderen Bilgisi</div>
                <div className="personnel-detail-modal__sender-name">{senderName || "ProcureFlow"}</div>
                <div className="personnel-detail-modal__sender-address">
                  {senderEmail || "Gönderen adresi ayarlanmamış"}
                </div>

                {systemEmails.length > 0 && (
                  <label className="personnel-detail-modal__field">
                    Gönderen Hesap
                    <select
                      value={selectedSystemEmailId === "default" ? "default" : String(selectedSystemEmailId)}
                      onChange={(event) =>
                        setSelectedSystemEmailId(
                          event.target.value === "default" ? "default" : Number(event.target.value),
                        )
                      }
                      className="personnel-detail-modal__select"
                    >
                      <option value="default">Profil varsayılanı</option>
                      {systemEmails.map((account) => (
                        <option key={account.id} value={String(account.id)}>
                          {account.description?.trim()
                            ? `${account.description} - ${account.email}`
                            : account.email}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {replyToEmail && replyToEmail !== senderEmail && (
                  <div className="personnel-detail-modal__sender-address">
                    Yanıt Adresi: {replyToEmail}
                  </div>
                )}

                <div className="personnel-detail-modal__sender-note">
                  Bu e-posta oturum açan kullanıcı adına değil, gelişmiş ayarlarda tanımlı sistem posta
                  hesabı üzerinden gönderilir.
                </div>
              </div>

              <div className="personnel-detail-modal__email-grid">
                <label className="personnel-detail-modal__field">
                  Alıcı (To)
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(event) => setEmailTo(event.target.value)}
                    className="personnel-detail-modal__input"
                  />
                </label>

                <label className="personnel-detail-modal__field">
                  CC (virgülle ayırın)
                  <input
                    value={emailCc}
                    onChange={(event) => setEmailCc(event.target.value)}
                    className="personnel-detail-modal__input"
                  />
                </label>

                <label className="personnel-detail-modal__field personnel-detail-modal__field--full">
                  Konu
                  <input
                    value={emailSubject}
                    onChange={(event) => setEmailSubject(event.target.value)}
                    className="personnel-detail-modal__input"
                  />
                </label>

                <label className="personnel-detail-modal__field personnel-detail-modal__field--full">
                  Mesaj
                  <textarea
                    rows={7}
                    value={emailBody}
                    onChange={(event) => setEmailBody(event.target.value)}
                    className="personnel-detail-modal__textarea"
                  />
                </label>

                <label className="personnel-detail-modal__field personnel-detail-modal__field--full personnel-detail-modal__attachments">
                  Ek Dosyalar
                  <input
                    type="file"
                    multiple
                    onChange={(event) => setEmailFiles(Array.from(event.target.files || []))}
                    className="personnel-detail-modal__input"
                  />
                  {emailFiles.length > 0 && (
                    <div className="personnel-detail-modal__attachment-list">
                      {emailFiles.map((file) => file.name).join(", ")}
                    </div>
                  )}
                </label>

                {(senderName ||
                  selectedSystemEmail?.signature_title ||
                  emailSettings?.signature_title ||
                  selectedSystemEmail?.signature_note ||
                  emailSettings?.signature_note ||
                  selectedSystemEmail?.signature_image_url ||
                  emailSettings?.signature_image_url) && (
                  <div className="personnel-detail-modal__signature-box">
                    <div className="personnel-detail-modal__signature-title">İmza Önizleme</div>
                    <div className="personnel-detail-modal__signature-grid">
                      {senderName && (
                        <div className="personnel-detail-modal__signature-name">{senderName}</div>
                      )}
                      {(selectedSystemEmail?.signature_title || emailSettings?.signature_title) && (
                        <div className="personnel-detail-modal__signature-text">
                          {selectedSystemEmail?.signature_title || emailSettings?.signature_title}
                        </div>
                      )}
                      {(selectedSystemEmail?.signature_note || emailSettings?.signature_note) && (
                        <div className="personnel-detail-modal__signature-text">
                          {selectedSystemEmail?.signature_note || emailSettings?.signature_note}
                        </div>
                      )}
                      {(selectedSystemEmail?.signature_image_url || emailSettings?.signature_image_url) && (
                        <img
                          src={selectedSystemEmail?.signature_image_url || emailSettings?.signature_image_url || ""}
                          alt="imza-onizleme"
                          className="personnel-detail-modal__signature-image"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="personnel-detail-modal__email-actions">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="personnel-detail-modal__email-button personnel-detail-modal__email-button--cancel"
                >
                  İptal
                </button>
                <button
                  type="button"
                  disabled={emailSending}
                  onClick={() => void handleSendEmail()}
                  className="personnel-detail-modal__email-button personnel-detail-modal__email-button--send"
                >
                  {emailSending ? "Gönderiliyor..." : "Gönder"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

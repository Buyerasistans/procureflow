import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRoleLabel } from "../auth/permissions";
import { sendAdminUserEmail, type TenantUser, type CompanyAssignment } from "../services/admin.service";
import { getEmailSettings, type EmailSettingsData } from "../services/advanced-settings.service";
import { getMailCenterAccounts, type MailCenterAccount } from "../services/mail-center.service";
import { getSystemEmails, type SystemEmail } from "../services/system-email.service";

interface PersonnelDetailModalProps {
  personnel: TenantUser;
  onClose: () => void;
  onResetPassword?: (id: number) => void;
}

const PersonnelDetailModal: React.FC<PersonnelDetailModalProps> = ({ personnel, onClose, onResetPassword }) => {
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

  const selectedSystemEmail = selectedSystemEmailId === "default"
    ? null
    : systemEmails.find((item) => item.id === selectedSystemEmailId) ?? null;

  const senderName = (selectedSystemEmail?.signature_name || emailSettings?.signature_name || emailSettings?.from_name || "ProcureFlow").trim();
  const senderEmail = (selectedSystemEmail?.email || emailSettings?.from_email || emailSettings?.smtp_username || "").trim();
  const replyToEmail = (selectedSystemEmail?.email || emailSettings?.reply_to_email || senderEmail).trim();

  const photoUrl = personnel.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(personnel.full_name)}&background=0D8ABC&color=fff&size=128`;
  const phones: { label: string; value?: string | null }[] = [
    { label: "Şahsi", value: personnel.personal_phone },
    { label: "Firma", value: personnel.company_phone },
    { label: "Kısa Kod", value: personnel.company_phone_short },
  ];

  const address = personnel.address || "-";
  let city = "", district = "", addressDetail = "";
  if (address && address !== "-") {
    const parts = address.split(",").map((s: string) => s.trim());
    city = parts[0] || "";
    district = parts[1] || "";
    addressDetail = parts.slice(2).join(", ");
  }

  const mapQuery = encodeURIComponent(address);
  const mapUrl = address && address !== "-" ? `https://maps.google.com/?q=${mapQuery}` : undefined;
  const assignments: CompanyAssignment[] = Array.isArray(personnel.company_assignments) ? personnel.company_assignments : [];

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

  const linkedMailUnreadCount = mailAccounts.find((account) => String(account.email || "").trim().toLowerCase() === String(personnel.email || "").trim().toLowerCase())?.unread_count || 0;

  useEffect(() => {
    if (systemEmails.length === 0) {
      setSelectedSystemEmailId("default");
      return;
    }
    setSelectedSystemEmailId((current) => {
      if (current === "default") return systemEmails[0]?.id ?? "default";
      return systemEmails.some((item) => item.id === current) ? current : (systemEmails[0]?.id ?? "default");
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
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
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
    ].filter(Boolean).join("\n");

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
    window.alert('İletişim bilgileri panoya kopyalandı.');
  }

  function openMailCenter() {
    const params = new URLSearchParams({ tab: "mail" });
    const linkedAccount = mailAccounts.find((account) => String(account.email || "").trim().toLowerCase() === String(personnel.email || "").trim().toLowerCase());
    if (linkedAccount?.id) {
      params.set("mailAccountId", String(linkedAccount.id));
    }
    if (personnel.email) {
      params.set("mailComposeTo", personnel.email);
    }
    navigate(`/admin?${params.toString()}`);
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 32, minWidth: 420, width: 'min(1040px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', boxShadow: '0 24px 80px rgba(15,23,42,0.24)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#0f766e' }}>İletişim Kartı</div>
            <h2 style={{ margin: '8px 0 0', fontSize: 32, color: '#111827' }}>Ekip Uyesi Detaylari</h2>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', width: 40, height: 40, borderRadius: 999, cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
          <div style={{ borderRadius: 24, padding: 24, background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)', border: '1px solid #dbeafe', position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <img src={photoUrl} alt="Personel" style={{ width: 112, height: 112, borderRadius: '50%', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 12px 24px rgba(37, 99, 235, 0.18)' }} />
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 18, color: '#0f172a', wordBreak: 'break-word', lineHeight: 1.15 }}>{personnel.full_name}</div>
            <div style={{ color: '#475569', marginTop: 6, fontWeight: 700 }}>{getRoleLabel(personnel.role) || '-'}</div>
            <div style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
              Operasyonel rol{personnel.system_role ? ` • Sistem rolü: ${getRoleLabel(personnel.system_role)}` : ''}
            </div>
            <div style={{ color: '#475569', marginTop: 6, wordBreak: 'break-word' }}>{personnel.email}</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" onClick={() => openEmailComposer(personnel.email)} style={{ padding: '8px 12px', borderRadius: 10, background: '#dbeafe', color: '#1d4ed8', textDecoration: 'none', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Mail Yolla</button>
              <button type="button" onClick={openMailCenter} style={{ padding: '8px 12px', borderRadius: 10, background: '#ecfccb', color: '#3f6212', textDecoration: 'none', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>Mail Merkezi{linkedMailUnreadCount > 0 && <span style={{ padding: '2px 8px', borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 800 }}>{linkedMailUnreadCount}</span>}</button>
            </div>
            <div style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: personnel.is_active ? '#dcfce7' : '#fee2e2', color: personnel.is_active ? '#166534' : '#991b1b', fontWeight: 700 }}>
              <span>{personnel.is_active ? 'Aktif Ekip Uyesi' : 'Pasif Ekip Uyesi'}</span>
            </div>
            </div>
            <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
              {phones.filter((phone) => phone.value).map((phone) => (
                <div key={phone.label} style={{ padding: 12, borderRadius: 16, background: '#fff', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{phone.label}</div>
                  <div style={{ fontWeight: 700, color: '#111827', marginTop: 4 }}>{phone.value}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <a href={`tel:${(phone.value || '').replace(/\s+/g, '')}`} style={{ padding: '8px 10px', borderRadius: 10, background: '#dcfce7', color: '#166534', textDecoration: 'none', fontWeight: 700 }}>Ara</a>
                    <button type="button" onClick={() => openWhatsApp(phone.value)} style={{ padding: '8px 10px', borderRadius: 10, background: '#d1fae5', color: '#065f46', textDecoration: 'none', fontWeight: 700, border: 'none', cursor: 'pointer', pointerEvents: personnel.share_on_whatsapp === false ? 'none' : 'auto', opacity: personnel.share_on_whatsapp === false ? 0.5 : 1 }}>WhatsApp</button>
                    <button type="button" onClick={() => shareContact(phone.value)} style={{ padding: '8px 10px', borderRadius: 10, background: '#ecfeff', color: '#155e75', textDecoration: 'none', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Paylaş</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ padding: 20, borderRadius: 20, background: '#ffffff', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>Firma ve Departman Atamaları</div>
              {assignments.length === 0 ? (
                <div style={{ color: '#64748b' }}>Bu ekip uyesi icin kayitli firma atamasi bulunmuyor.</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {assignments.map((assignment) => (
                    <div key={assignment.id} style={{ padding: 16, borderRadius: 16, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#111827' }}>{assignment.company?.name || 'Firma seçilmemiş'}</div>
                          <div style={{ marginTop: 4, color: '#475569' }}>{assignment.department?.name || 'Departman seçilmemiş'}</div>
                        </div>
                        <div style={{ color: '#2563eb', fontWeight: 700 }}>{assignment.role?.name || '-'}</div>
                      </div>
                      {assignment.sub_items && assignment.sub_items.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                          {assignment.sub_items.map((item) => (
                            <span key={item} style={{ padding: '6px 10px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: 12 }}>{item}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: 20, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Konum</div>
              <div style={{ marginTop: 10, color: '#111827', fontWeight: 600 }}>
                {address !== '-' ? [city, district, addressDetail].filter(Boolean).join(', ') : 'Adres girilmemiş'}
              </div>
              <div style={{ marginTop: 10, color: '#64748b' }}>
                Harita görünürlüğü: {personnel.hide_location ? 'Gizli' : 'Açık'}
              </div>
              {!personnel.hide_location && mapUrl && (
                <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                  <iframe
                    title="personnel-location-map"
                    width="100%"
                    height="260"
                    style={{ border: 0, borderRadius: 18 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                  />
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>Haritada Aç</a>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          {onResetPassword && (
            <button
              style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => onResetPassword(personnel.id)}
            >Şifre Sıfırla</button>
          )}
          <button
            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 500, cursor: 'pointer' }}
            onClick={onClose}
          >Kapat</button>
        </div>
      </div>
      {showEmailModal && (
        <div onClick={() => setShowEmailModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(700px, 94vw)', background: '#fff', borderRadius: 10, border: '1px solid #dbe3ee', padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>E-posta Gönder</h3>
            {emailError && <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>{emailError}</div>}
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #dbe3ee' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Gönderen Bilgisi</div>
              <div style={{ color: '#0f172a', fontWeight: 700 }}>{senderName || 'ProcureFlow'}</div>
              <div style={{ marginTop: 4, color: '#475569' }}>{senderEmail || 'Gönderen adresi ayarlanmamış'}</div>
              {systemEmails.length > 0 && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12, fontSize: 13, color: '#111827' }}>
                  Gönderen Hesap
                  <select
                    value={selectedSystemEmailId === 'default' ? 'default' : String(selectedSystemEmailId)}
                    onChange={(e) => setSelectedSystemEmailId(e.target.value === 'default' ? 'default' : Number(e.target.value))}
                    style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 14, background: '#fff' }}
                  >
                    <option value="default">Profil varsayılanı</option>
                    {systemEmails.map((account) => (
                      <option key={account.id} value={String(account.id)}>
                        {account.description?.trim() ? `${account.description} - ${account.email}` : account.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {replyToEmail && replyToEmail !== senderEmail && (
                <div style={{ marginTop: 4, color: '#64748b' }}>Yanıt Adresi: {replyToEmail}</div>
              )}
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                Bu e-posta oturum açan kullanıcı adına değil, gelişmiş ayarlarda tanımlı sistem posta hesabı üzerinden gönderilir.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#111827' }}>Alıcı (To)<input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#111827' }}>CC (virgülle ayırın)<input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} /></label>
              <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#111827' }}>Konu<input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} /></label>
              <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#111827' }}>Mesaj<textarea rows={7} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 14, resize: 'vertical' }} /></label>
              <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#111827' }}>Ek Dosyalar<input type="file" multiple onChange={(e) => setEmailFiles(Array.from(e.target.files || []))} style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />{emailFiles.length > 0 && <div style={{ marginTop: 6, fontSize: 12, color: '#334155' }}>{emailFiles.map((f) => f.name).join(', ')}</div>}</label>
              {(senderName || selectedSystemEmail?.signature_title || emailSettings?.signature_title || selectedSystemEmail?.signature_note || emailSettings?.signature_note || selectedSystemEmail?.signature_image_url || emailSettings?.signature_image_url) && (
                <div style={{ gridColumn: '1 / -1', padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #dbe3ee' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>İmza Önizleme</div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {senderName && <div style={{ fontWeight: 800, color: '#0f172a' }}>{senderName}</div>}
                    {(selectedSystemEmail?.signature_title || emailSettings?.signature_title) && <div style={{ color: '#475569' }}>{selectedSystemEmail?.signature_title || emailSettings?.signature_title}</div>}
                    {(selectedSystemEmail?.signature_note || emailSettings?.signature_note) && <div style={{ color: '#475569', whiteSpace: 'pre-wrap' }}>{selectedSystemEmail?.signature_note || emailSettings?.signature_note}</div>}
                    {(selectedSystemEmail?.signature_image_url || emailSettings?.signature_image_url) && (
                      <img src={selectedSystemEmail?.signature_image_url || emailSettings?.signature_image_url || ''} alt="imza-onizleme" style={{ marginTop: 10, maxWidth: 240, maxHeight: 120, objectFit: 'contain', borderRadius: 8, border: '1px solid #dbe3ee', background: '#fff' }} />
                    )}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowEmailModal(false)} style={{ border: 0, borderRadius: 8, padding: '9px 12px', fontWeight: 600, background: '#4b5563', color: '#fff', cursor: 'pointer' }}>İptal</button>
              <button type="button" disabled={emailSending} onClick={() => void handleSendEmail()} style={{ border: 0, borderRadius: 8, padding: '9px 12px', fontWeight: 600, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>{emailSending ? 'Gönderiliyor...' : 'Gönder'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelDetailModal;

import os
import smtplib
import re
import html
from typing import Union
from email.message import EmailMessage
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from datetime import datetime
import logging

from api.services.email_runtime_config import get_effective_email_config

logger = logging.getLogger(__name__)


def _is_valid_email_address(value: str) -> bool:
    candidate = (value or "").strip()
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", candidate))


class EmailService:
    """Email servisi - Magic link ve bildirimler için kullanılır"""

    def __init__(self):
        self.smtp_server = ""
        self.smtp_port = 587
        self.smtp_username = ""
        self.sender_email = "noreply@procureflow.local"
        self.sender_password = ""
        self.use_tls = True
        self.use_ssl = False
        self.sender_name = "ProcureFlow"
        self.reply_to_email = ""
        self.app_url = os.getenv("APP_URL", "http://localhost:5177")
        self._refresh_runtime_config()

    def _refresh_runtime_config(
        self,
        owner_user_id: int | None = None,
        system_email_id: int | None = None,
    ) -> None:
        config = get_effective_email_config(
            owner_user_id=owner_user_id,
            system_email_id=system_email_id,
        )
        self.smtp_server = (config.smtp_host or "localhost").strip().rstrip(".")
        self.smtp_port = int(config.smtp_port or 587)
        self.smtp_username = (
            config.smtp_username or config.from_email or "noreply@procureflow.local"
        ).strip()
        self.sender_email = (
            config.from_email or config.smtp_username or "noreply@procureflow.local"
        ).strip()
        self.sender_password = config.smtp_password or ""
        self.use_tls = bool(config.use_tls)
        self.use_ssl = bool(config.use_ssl)
        self.sender_name = config.from_name or "ProcureFlow"
        self.reply_to_email = (config.reply_to_email or self.sender_email).strip()
        self.app_url = (config.app_url or self.app_url).rstrip("/")
        self.signature_name = config.signature_name or ""
        self.signature_title = config.signature_title or ""
        self.signature_note = config.signature_note or ""
        self.signature_image_url = config.signature_image_url or ""

    def _with_signature(self, html_content: str, plain_text: str) -> tuple[str, str]:
        signature_lines = [
            line for line in [self.signature_name, self.signature_title] if line
        ]
        if self.signature_note:
            signature_lines.append(self.signature_note)

        if not signature_lines and not self.signature_image_url:
            return html_content, plain_text

        signature_html_parts = []
        if signature_lines:
            signature_html_parts.append(
                '<div style="font-weight:700;color:#0f172a;">'
                + html.escape(signature_lines[0])
                + "</div>"
            )
            for line in signature_lines[1:]:
                signature_html_parts.append(
                    '<div style="color:#475569;">' + html.escape(line) + "</div>"
                )
        if self.signature_image_url:
            signature_html_parts.append(
                f'<div style="margin-top:12px;"><img src="{html.escape(self.signature_image_url)}" alt="mail-imza" style="max-width:240px;max-height:120px;border-radius:8px;object-fit:contain;" /></div>'
            )

        signature_html = (
            '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">'
            + "".join(signature_html_parts)
            + "</div>"
        )
        signature_plain = "\n\n--\n" + "\n".join(signature_lines)
        if self.signature_image_url:
            signature_plain += f"\nGorsel: {self.signature_image_url}"
        return html_content + signature_html, (plain_text or "") + signature_plain

    def _get_magic_link(self, token: str) -> str:
        """Magic link URL'ini oluştur"""
        return f"{self.app_url}/supplier/register?token={token}"

    def _get_internal_user_magic_link(self, token: str) -> str:
        return f"{self.app_url}/activate-account?token={token}"

    def _html_to_plain_text(self, html_content: str) -> str:
        """HTML içeriği temel seviyede düz metne dönüştür."""
        if not html_content:
            return ""
        text = re.sub(r"<br\s*/?>", "\n", html_content, flags=re.IGNORECASE)
        text = re.sub(r"</p>|</div>|</li>|</h[1-6]>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", "", text)
        text = html.unescape(text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _apply_transactional_headers(
        self,
        msg: EmailMessage | MIMEMultipart,
        *,
        from_email: str,
        to_email: str,
        subject: str,
    ) -> None:
        normalized_reply_to = self.reply_to_email or from_email
        if not _is_valid_email_address(normalized_reply_to):
            normalized_reply_to = from_email

        msg["Subject"] = self._normalize_subject(subject)
        msg["From"] = f"{self.sender_name} <{from_email}>"
        msg["Sender"] = from_email
        msg["To"] = to_email
        msg["Reply-To"] = normalized_reply_to
        msg["Return-Path"] = from_email
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain=from_email.split("@")[-1])
        msg["Content-Language"] = "tr-TR"
        msg["X-Mailer"] = "ProcureFlow"
        msg["X-Auto-Response-Suppress"] = "All"
        msg["Auto-Submitted"] = "auto-generated"
        msg["MIME-Version"] = "1.0"

    def _normalize_subject(self, subject: str) -> str:
        """Konu satırını güvenli ve tutarlı bir formata getir."""
        clean = " ".join((subject or "").split())
        if not clean:
            clean = "Bilgilendirme"
        if not clean.startswith("[ProcureFlow]"):
            clean = f"[ProcureFlow] {clean}"
        return clean

    def _send_smtp(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_text: str = "",
        owner_user_id: int | None = None,
        system_email_id: int | None = None,
    ) -> bool:
        """SMTP üzerinden email gönder (plain_text + HTML multipart)"""
        self._refresh_runtime_config(
            owner_user_id=owner_user_id,
            system_email_id=system_email_id,
        )
        html_content, plain_text = self._with_signature(html_content, plain_text)

        # Email credentials kontrol et
        if not self.sender_email or not self.sender_password:
            logger.error(
                f"[EMAIL] SMTP credentials eksik! SENDER_EMAIL={self.sender_email}, PASSWORD={'*' * 5 if self.sender_password else 'EMPTY'}"
            )
            return False

        from_email = self.sender_email.strip()
        if not _is_valid_email_address(from_email):
            fallback_email = (self.smtp_username or "").strip()
            if _is_valid_email_address(fallback_email):
                from_email = fallback_email
            else:
                logger.error("[EMAIL] Geçerli bir gönderen e-posta adresi yok")
                return False

        try:
            msg = MIMEMultipart("alternative")
            self._apply_transactional_headers(
                msg,
                from_email=from_email,
                to_email=to_email,
                subject=subject,
            )

            final_plain_text = (plain_text or "").strip() or self._html_to_plain_text(
                html_content
            )
            if final_plain_text:
                msg.attach(MIMEText(final_plain_text, "plain", "utf-8"))
            msg.attach(MIMEText(html_content, "html", "utf-8"))

            logger.info(f"[EMAIL] Bağlanılıyor: {self.smtp_server}:{self.smtp_port}")

            server: Union[smtplib.SMTP, smtplib.SMTP_SSL]
            if self.use_ssl or self.smtp_port == 465:
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=10)
                if self.use_tls:
                    server.starttls()

            login_identity = self.smtp_username or from_email
            logger.info(f"[EMAIL] Login: {login_identity}")
            server.login(login_identity, self.sender_password)
            send_result = server.send_message(
                msg, from_addr=from_email, to_addrs=[to_email]
            )
            server.quit()
            if send_result:
                logger.error(f"[EMAIL] ❌ Recipient refusal details: {send_result}")
                return False
            logger.info(
                f"[EMAIL] ✅ Email SMTP sunucusu tarafından kabul edildi: {to_email}"
            )
            return True
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"[EMAIL] ❌ Kimlik doğrulama hatası: {str(e)}")
            logger.error(
                f"[EMAIL] SMTP_USERNAME={self.smtp_username or from_email}, FROM_EMAIL={from_email}, PASSWORD_SET={'yes' if self.sender_password else 'no'}"
            )
            return False
        except smtplib.SMTPException as e:
            logger.error(f"[EMAIL] ❌ SMTP hatası: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"[EMAIL] ❌ Email gönderme hatası ({to_email}): {str(e)}")
            logger.error(f"[EMAIL] Traceback:", exc_info=True)
            return False

    def send_custom_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        cc: str | None = None,
        attachments: list[tuple[str, str, bytes]] | None = None,
        owner_user_id: int | None = None,
        system_email_id: int | None = None,
    ) -> bool:
        self._refresh_runtime_config(
            owner_user_id=owner_user_id,
            system_email_id=system_email_id,
        )
        if not self.sender_email or not self.sender_password:
            logger.error("[EMAIL] SMTP credentials eksik")
            return False

        from_email = self.sender_email.strip()
        if not _is_valid_email_address(from_email):
            fallback_email = (self.smtp_username or "").strip()
            if _is_valid_email_address(fallback_email):
                from_email = fallback_email
            else:
                logger.error("[EMAIL] Geçerli bir gönderen e-posta adresi yok")
                return False

        plain_body = (body or "").strip() or (
            "Merhaba,\n\nBu ileti ProcureFlow sisteminden gönderilmiştir.\n\nİyi çalışmalar."
        )
        html_body = (
            '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">'
            + "<p>"
            + html.escape(plain_body).replace("\n", "<br>")
            + "</p>"
            + "</body></html>"
        )
        html_body, plain_body = self._with_signature(html_body, plain_body)

        msg = EmailMessage()
        self._apply_transactional_headers(
            msg,
            from_email=from_email,
            to_email=to_email,
            subject=subject,
        )
        if cc:
            msg["Cc"] = cc
        msg.set_content(plain_body, subtype="plain", charset="utf-8")
        msg.add_alternative(html_body, subtype="html", charset="utf-8")

        for filename, content_type, content in attachments or []:
            maintype, subtype = (content_type.split("/", 1) + ["octet-stream"])[:2]
            msg.add_attachment(
                content, maintype=maintype, subtype=subtype, filename=filename
            )

        recipients = [to_email]
        if cc:
            recipients.extend([r.strip() for r in cc.split(",") if r.strip()])

        try:
            server: Union[smtplib.SMTP, smtplib.SMTP_SSL]
            if self.use_ssl or self.smtp_port == 465:
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, timeout=12)
            else:
                server = smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=12)
                if self.use_tls:
                    server.starttls()
            server.login(self.smtp_username or from_email, self.sender_password)
            server.send_message(msg, from_addr=from_email, to_addrs=recipients)
            server.quit()
            return True
        except Exception:
            logger.exception("[EMAIL] Custom email send failed")
            return False

    def send_magic_link(
        self,
        to_email: str,
        supplier_name: str,
        supplier_user_name: str,
        magic_token: str,
        company_name: str = "ProcureFlow",
        owner_user_id: int | None = None,
    ) -> bool:
        """Tedarikçi kayıt için magic link gönder"""

        magic_link = self._get_magic_link(magic_token)
        login_url = f"{self.app_url}/supplier/login"

        # HTML template
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50;">Stratejik Partner Daveti</h2>
                    
                    <p>Merhaba <strong>{supplier_user_name}</strong>,</p>
                    
                    <p><strong>{supplier_name}</strong> firmanız ProcureFlow üzerinde stratejik partner portföyüne hızlı davet akışı ile eklendi.</p>
                    <p>Bu ilk adımda sadece hesabınızı aktive edip şifrenizi belirlemeniz yeterlidir. Firma profilinizin kalan detaylarını giriş yaptıktan sonra supplier panelinden siz tamamlayabilirsiniz.</p>
                    
                    <p>Davetinizi tamamlamak için aşağıdaki bağlantıya tıklayın:</p>
                    
                    <p style="margin: 30px 0;">
                        <a href="{magic_link}" 
                           style="display: inline-block; padding: 12px 30px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Daveti Tamamla
                        </a>
                    </p>
                    
                    <p style="color: #7f8c8d; font-size: 12px;">
                        Veya bu bağlantıyı tarayıcınıza kopyalayın:<br>
                        <code>{magic_link}</code>
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 20px 0;">
                    
                    <div style="background-color: #f0f7ff; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #2c3e50;">ℹ️ Sonraki Adımlar</h3>
                        <ol style="margin: 10px 0; padding-left: 20px;">
                            <li>Yukarıdaki link ile supplier davet ekranını açın</li>
                            <li>Bir şifre belirleyin ve hesabınızı aktive edin</li>
                            <li>Giriş yaptıktan sonra firma adresi, vergi, finans ve belge alanlarını doldurun</li>
                            <li>Bu bilgiler tamamlandığında teklif ve hızlı listeleme akışlarında daha görünür olursunuz</li>
                        </ol>
                    </div>
                    
                    <p style="margin: 20px 0;">
                        <strong>Giriş Sayfası:</strong> <a href="{login_url}" style="color: #3498db; text-decoration: none;">{login_url}</a>
                    </p>
                    
                    <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">
                        Bu bağlantı 24 saat boyunca geçerlidir.<br>
                        Eğer bu daveti almadıysanız, bu emaili görmezden gelebilirsiniz.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
                    
                    <p style="color: #95a5a6; font-size: 12px; text-align: center;">
                        {company_name} - Tedarik Zinciri Yönetim Sistemi<br>
                        {datetime.now().strftime('%d.%m.%Y %H:%M')}
                    </p>
                </div>
            </body>
        </html>
        """

        # Plain text version
        plain_text = f"""ProcureFlow Tedarikçi Daveti

    Merhaba {supplier_user_name},

    {supplier_name} firmanız ProcureFlow üzerinde stratejik partner portföyüne hızlı davet akışı ile eklendi.
    Bu ilk adımda sadece hesabınızı aktive edip şifrenizi belirlemeniz yeterlidir.
    Firma profilinizin kalan detaylarını giriş yaptıktan sonra supplier panelinden tamamlayabilirsiniz.

    Davetinizi tamamlamak için aşağıdaki bağlantıya tıklayın:
{magic_link}

Veya bu bağlantıyı tarayıcınıza kopyalayın:
{magic_link}

Sonraki Adımlar:
    1. Supplier davet ekranını açın
    2. Şifrenizi belirleyip hesabınızı aktive edin
    3. Giriş yaptıktan sonra firma detaylarını tamamlayın
    4. Teklif ve hızlı listeleme akışlarında görünür olun

Giriş Sayfası: {login_url}

Bu bağlantı 24 saat boyunca geçerlidir.
Eğer bu daveti almadıysanız, bu emaili görmezden gelebilirsiniz.

{company_name} - Tedarik Zinciri Yönetim Sistemi
{datetime.now().strftime('%d.%m.%Y %H:%M')}
"""

        subject = f"{supplier_name} - ProcureFlow Tedarikçi Davetinizi Tamamlayın"
        return self._send_smtp(
            to_email,
            subject,
            html_content,
            plain_text,
            owner_user_id=owner_user_id,
        )

    def send_internal_user_invitation(
        self,
        to_email: str,
        full_name: str,
        activation_token: str,
        company_name: str = "ProcureFlow",
        owner_user_id: int | None = None,
    ) -> bool:
        """İç kullanıcı/personel magic-link davet maili gönder."""
        activation_url = self._get_internal_user_magic_link(activation_token)
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f8fafc; margin: 0; padding: 24px 12px;">
                <div style="max-width: 620px; margin: 0 auto; padding: 28px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px;">
                    <div style="font-size: 12px; letter-spacing: 1.8px; text-transform: uppercase; color: #64748b; font-weight: 700;">ProcureFlow</div>
                    <h2 style="color: #0f172a; margin: 12px 0 0;">Hesabınızı oluşturun</h2>
                    <p>Merhaba <strong>{full_name}</strong>,</p>
                    <p>{company_name} için super admin onaylı hesabınız hazırlandı. Aşağıdaki butonla şifrenizi belirleyip doğrudan giriş yapabilirsiniz.</p>
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin:20px 0;">
                        <p style="margin:4px 0 10px;"><strong>E-posta:</strong> {to_email}</p>
                        <p style="margin:0;"><a href="{activation_url}" style="display:inline-block; padding:12px 18px; background:#2563eb; color:white; text-decoration:none; border-radius:10px; font-weight:700;">Sifre belirle ve hesabi aktifleştir</a></p>
                    </div>
                    <p style="margin:0 0 8px;"><strong>Bağlantı 24 saat boyunca geçerlidir.</strong></p>
                    <p style="font-size:12px;color:#64748b; margin: 0;">Bu kayıt size ait değilse bu e-postayı dikkate almayın veya yöneticinizle iletişime geçin.</p>
                </div>
            </body>
        </html>
        """
        plain_text = (
            f"ProcureFlow Hesap Aktivasyonu\n\n"
            f"Merhaba {full_name},\n\n"
            f"{company_name} için super admin onaylı hesabınız hazırlandı.\n"
            f"E-posta: {to_email}\n"
            f"Şifre belirleme bağlantısı: {activation_url}\n\n"
            "Bağlantıyı açıp şifrenizi belirleyerek hesabınızı aktifleştirebilirsiniz. Bağlantı 24 saat geçerlidir."
        )
        return self._send_smtp(
            to_email,
            "ProcureFlow hesabınızı oluşturun",
            html_content,
            plain_text,
            owner_user_id=owner_user_id,
        )

    def send_onboarding_status_update(
        self,
        to_email: str,
        full_name: str,
        company_name: str,
        decision: str,
        note: str | None = None,
        action_url: str | None = None,
        owner_user_id: int | None = None,
    ) -> bool:
        decision_value = (decision or "").strip().lower()
        is_rejected = decision_value == "rejected"
        is_needs_info = decision_value == "needs_info"
        title = "Üyelik başvurunuz güncellendi"
        headline = "Üyelik başvurunuzla ilgili güncelleme"
        body_intro = f"<strong>{company_name}</strong> için yaptığınız ProcureFlow başvurusu super admin ekibi tarafından güncellendi."
        action_box = ""
        plain_note = ""

        if is_rejected:
            title = "Üyelik başvurunuz için ek işlem gerekli"
            headline = "Başvurunuz şu an için onaylanmadı"
            body_intro = f"<strong>{company_name}</strong> için yaptığınız ProcureFlow başvurusu incelendi ancak aktivasyon bu aşamada tamamlanmadı."
            action_box = (
                '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin:18px 0;">'
                '<div style="font-weight:700;color:#9a3412;margin-bottom:8px;">Neden / Operasyon Notu</div>'
                f'<div style="color:#7c2d12;">{html.escape((note or "Operasyon ekibi sizinle iletişime geçecektir.").strip())}</div>'
                '</div>'
            )
            plain_note = f"\n\nNeden / not: {(note or 'Operasyon ekibi sizinle iletişime geçecektir.').strip()}"
        elif is_needs_info:
            title = "Üyelik başvurunuz için ek bilgi gerekiyor"
            headline = "Başvurunuz için ek bilgi veya yeni dekont gerekiyor"
            body_intro = f"<strong>{company_name}</strong> için yaptığınız ProcureFlow başvurusu incelendi. Aktivasyon öncesi sizden ek bilgi veya güncel ödeme kanıtı talep ediliyor."
            action_box = (
                '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:18px 0;">'
                '<div style="font-weight:700;color:#1d4ed8;margin-bottom:8px;">Talep Detayı</div>'
                f'<div style="color:#1e3a8a;">{html.escape((note or "Lütfen ödeme kanıtını ve açıklama bilgisini güncelleyin.").strip())}</div>'
                '</div>'
            )
            if action_url:
                action_box += (
                    '<div style="margin:18px 0;">'
                    f'<a href="{html.escape(action_url)}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;">Başvurumu Güncelle</a>'
                    "</div>"
                )
            plain_note = f"\n\nTalep detayı: {(note or 'Lütfen ödeme kanıtını ve açıklama bilgisini güncelleyin.').strip()}"
            if action_url:
                plain_note += f"\nBaşvuru güncelleme linki: {action_url}"
        else:
            action_box = (
                '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:18px 0;color:#1e3a8a;">'
                "Başvurunuz onaylandığında aktivasyon bağlantısı ayrıca e-posta ile iletilir."
                "</div>"
            )
            if note:
                plain_note = f"\n\nNot: {note.strip()}"

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
                <div style="max-width: 620px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #0f172a;">{headline}</h2>
                    <p>Merhaba <strong>{html.escape(full_name)}</strong>,</p>
                    <p>{body_intro}</p>
                    {action_box}
                    <p style="color:#475569;">Sorularınız varsa bu e-postayı yanıtlayabilir veya platform ekibiyle iletişime geçebilirsiniz.</p>
                </div>
            </body>
        </html>
        """
        plain_text = (
            f"{title}\n\n"
            f"Merhaba {full_name},\n\n"
            f"{company_name} için yaptığınız ProcureFlow başvurusu güncellendi."
            f"{plain_note}\n\n"
            "Sorularınız varsa bu e-postayı yanıtlayabilirsiniz."
        )
        return self._send_smtp(
            to_email,
            title,
            html_content,
            plain_text,
            owner_user_id=owner_user_id,
        )

    def send_quote_notification(
        self,
        to_email: str,
        supplier_name: str,
        quote_title: str,
        deadline: str,
        quote_url: str,
        company_name: str = "ProcureFlow",
        owner_user_id: int | None = None,
    ) -> bool:
        """Yeni teklif bildirimi gönder"""

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50;">Yeni Teklif Bulunmaktadır</h2>
                    
                    <p>Merhaba,</p>
                    
                    <p><strong>{supplier_name}</strong> şirketimiz için yeni bir teklif alındığını bildirmek istiyoruz.</p>
                    
                    <div style="background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Teklif Başlığı:</strong> {quote_title}</p>
                        <p><strong>Son Tarih:</strong> {deadline}</p>
                    </div>
                    
                    <p style="margin: 30px 0;">
                        <a href="{quote_url}" 
                           style="display: inline-block; padding: 12px 30px; background-color: #27ae60; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Teklifi Görüntüle
                        </a>
                    </p>
                    
                    <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">
                        Lütfen son tarihinden önce teklif yöneticimize yanıt verin.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
                    
                    <p style="color: #95a5a6; font-size: 12px; text-align: center;">
                        {company_name} - Tedarik Zinciri Yönetim Sistemi<br>
                        {datetime.now().strftime('%d.%m.%Y %H:%M')}
                    </p>
                </div>
            </body>
        </html>
        """

        # Plain text version
        plain_text = f"""ProcureFlow - Yeni Teklif

Yeni Teklif Bulunmaktadır

Merhaba,

{supplier_name} şirketimiz için yeni bir teklif alındığını bildirmek istiyoruz.

Teklif Başlığı: {quote_title}
Son Tarih: {deadline}

Teklifi Görüntüle: {quote_url}

Lütfen son tarihinden önce teklif yöneticimize yanıt verin.

{company_name} - Tedarik Zinciri Yönetim Sistemi
{datetime.now().strftime('%d.%m.%Y %H:%M')}
"""

        subject = f"Yeni Teklif - {quote_title}"
        return self._send_smtp(
            to_email,
            subject,
            html_content,
            plain_text,
            owner_user_id=owner_user_id,
        )

    def send_supplier_email_change_magic_link(
        self,
        to_email: str,
        supplier_name: str,
        supplier_user_name: str,
        token: str,
    ) -> bool:
        """Tedarikçi kullanıcı e-posta değişim doğrulama maili gönder."""
        confirm_url = f"{self.app_url}/supplier/email-change/confirm?token={token}"
        html_content = f"""
        <html>
            <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;\">
                <div style=\"max-width: 620px; margin: 0 auto; padding: 22px;\">
                    <h2 style=\"color: #0f172a;\">E-posta Değişiklik Onayı</h2>
                    <p>Merhaba {supplier_user_name},</p>
                    <p><strong>{supplier_name}</strong> hesabınız için e-posta değişiklik talebi alındı.</p>
                    <p>Yeni e-posta adresinizi onaylamak için aşağıdaki butona tıklayın:</p>
                    <p style=\"margin: 26px 0;\">
                        <a href=\"{confirm_url}\" style=\"display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;\">E-posta Adresimi Onayla</a>
                    </p>
                    <p style=\"font-size:12px;color:#64748b;\">Bağlantı 24 saat geçerlidir. Eğer talep size ait değilse bu e-postayı dikkate almayın.</p>
                </div>
            </body>
        </html>
        """
        plain_text = (
            f"Merhaba {supplier_user_name},\n\n"
            f"{supplier_name} hesabı için e-posta değişiklik onayı gerekiyor.\n"
            f"Onay bağlantısı: {confirm_url}\n\n"
            "Bağlantı 24 saat geçerlidir."
        )
        subject = "ProcureFlow - Güvenli E-posta Onayı"
        return self._send_smtp(to_email, subject, html_content, plain_text)

    def send_supplier_email_change_verification(
        self,
        to_email: str,
        supplier_name: str,
        supplier_user_name: str,
        token: str,
    ) -> bool:
        """Geriye dönük uyumluluk için eski metot adı."""
        return self.send_supplier_email_change_magic_link(
            to_email=to_email,
            supplier_name=supplier_name,
            supplier_user_name=supplier_user_name,
            token=token,
        )

    def send_approval_request(
        self,
        to_email: str,
        approver_name: str,
        quote_title: str,
        total_amount: float,
        approval_level: str,
        approval_url: str,
        company_name: str = "ProcureFlow",
        owner_user_id: int | None = None,
    ) -> bool:
        """Onay isteği gönder (Manager/Director için)"""

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50;">Onay İsteği</h2>
                    
                    <p>Merhaba {approver_name},</p>
                    
                    <p>Sizden aşağıdaki teklif için onay istenmektedir:</p>
                    
                    <div style="background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Teklif Başlığı:</strong> {quote_title}</p>
                        <p><strong>Toplam Tutar:</strong> ₺{total_amount:,.2f}</p>
                        <p><strong>Onay Seviyesi:</strong> {approval_level}</p>
                    </div>
                    
                    <p style="margin: 30px 0;">
                        <a href="{approval_url}" 
                           style="display: inline-block; padding: 12px 30px; background-color: #e74c3c; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Onay Sayfasına Git
                        </a>
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
                    
                    <p style="color: #95a5a6; font-size: 12px; text-align: center;">
                        {company_name} - Tedarik Zinciri Yönetim Sistemi<br>
                        {datetime.now().strftime('%d.%m.%Y %H:%M')}
                    </p>
                </div>
            </body>
        </html>
        """

        # Plain text version
        plain_text = f"""ProcureFlow - Onay İsteği

Onay İsteği

Merhaba {approver_name},

Sizden aşağıdaki teklif için onay istenmektedir:

Teklif Başlığı: {quote_title}
Toplam Tutar: ₺{total_amount:,.2f}
Onay Seviyesi: {approval_level}

Onay Sayfasına Git: {approval_url}

{company_name} - Tedarik Zinciri Yönetim Sistemi
{datetime.now().strftime('%d.%m.%Y %H:%M')}
"""

        subject = f"Onay İsteği - {quote_title}"
        return self._send_smtp(
            to_email,
            subject,
            html_content,
            plain_text,
            owner_user_id=owner_user_id,
        )

    def send_project_invitation(
        self,
        to_email: str,
        supplier_name: str,
        project_name: str,
        company_name: str = "ProcureFlow",
    ) -> bool:
        """Projeye tedarikçi davet mailini gönder"""

        html_content = f"""<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yeni Proje Teklifi</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .content {{ background: #f9f9f9; padding: 20px; border-radius: 5px; }}
        .button {{ display: inline-block; padding: 12px 30px; background-color: #27ae60; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }}
        .footer {{ text-align: center; color: #95a5a6; font-size: 12px; margin-top: 30px; border-top: 1px solid #ecf0f1; padding-top: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="color: #2c3e50;">📧 Yeni Proje Teklifi Bekleniyor</h2>
        </div>
        
        <div class="content">
            <p>Merhaba <strong>{supplier_name}</strong>,</p>
            
            <p>{company_name} tarafından yeni bir proje için teklif istenmektedir.</p>
            
            <div style="background-color: #ecf0f1; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0; border-radius: 3px;">
                <p style="margin: 5px 0;"><strong>📌 Proje Adı:</strong> {project_name}</p>
                <p style="margin: 5px 0;"><strong>🏢 Firma:</strong> {company_name}</p>
            </div>
            
            <p>Lütfen sisteme giriş yaparak ilgili projenin ayrıntılarını görüntüleyin ve teklifinizi gönderiniz.</p>
            
            <div style="text-align: center;">
                <a href="{self.app_url}/supplier/dashboard" class="button">
                    Paneli Aç
                </a>
            </div>
            
            <p style="color: #7f8c8d; font-size: 12px;">
                <strong>Bağlantı:</strong> {self.app_url}/supplier/dashboard
            </p>
        </div>
        
        <div class="footer">
            <p>{company_name} - Tedarik Zinciri Yönetim Sistemi<br>
            {datetime.now().strftime('%d.%m.%Y %H:%M')}</p>
            <p style="margin-top: 10px; font-size: 11px;">
                <a href="{self.app_url}/unsubscribe?email={to_email}" style="color: #95a5a6; text-decoration: none;">Abonelikten Çık</a> | 
                <a href="mailto:{self.sender_email}" style="color: #95a5a6; text-decoration: none;">Destek</a>
            </p>
        </div>
    </div>
</body>
</html>"""

        # Plain text version (spam filtering için)
        text_content = f"""
Yeni Proje Teklifi Bekleniyor

Merhaba {supplier_name},

{company_name} tarafından yeni bir proje için teklif istenmektedir.

Proje Adı: {project_name}
Firma: {company_name}

Lütfen sisteme giriş yaparak ilgili projenin ayrıntılarını görüntüleyin ve teklifinizi gönderiniz.

Paneli açmak için: {self.app_url}/supplier/dashboard

{company_name} - Tedarik Zinciri Yönetim Sistemi
{datetime.now().strftime('%d.%m.%Y %H:%M')}
        """

        subject = f"📧 Yeni Proje: {project_name}"
        return self._send_smtp(to_email, subject, html_content, text_content)

    def send_new_quote_to_supplier(
        self,
        to_email: str,
        supplier_name: str,
        quote_title: str,
        deadline_days: int,
        workspace_url: str,
        company_name: str = "ProcureFlow",
    ) -> bool:
        """Tedarikçiye yeni teklif isteği gönderildi bildirimi"""
        deadline_str = f"{deadline_days} gün içinde"
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
                    <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 20px; border-radius: 8px 8px 0 0;">
                        <h2 style="color: white; margin: 0; font-size: 20px;">📋 Yeni Teklif Talebi</h2>
                    </div>
                    <div style="background: #f8faff; border: 1px solid #dbeafe; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
                        <p>Merhaba <strong>{supplier_name}</strong>,</p>
                        <p><strong>{company_name}</strong> tarafından size yeni bir teklif talebi iletilmiştir.</p>
                        <div style="background: white; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 4px; margin: 20px 0;">
                            <p style="margin: 4px 0;"><strong>📌 Teklif:</strong> {quote_title}</p>
                            <p style="margin: 4px 0;"><strong>⏰ Son Tarih:</strong> {deadline_str}</p>
                        </div>
                        <p>Teklifinizi hazırlamak ve göndermek için aşağıdaki butona tıklayın:</p>
                        <div style="text-align: center; margin: 28px 0;">
                            <a href="{workspace_url}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">
                                Teklifimi Hazırla
                            </a>
                        </div>
                        <p style="font-size: 12px; color: #6b7280;">Butona tıklanamıyorsa şu adresi kullanın: <a href="{workspace_url}" style="color: #3b82f6;">{workspace_url}</a></p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <p style="font-size: 12px; color: #9ca3af; text-align: center;">{company_name} - Tedarik Zinciri Yönetim Sistemi · {datetime.now().strftime('%d.%m.%Y %H:%M')}</p>
                    </div>
                </div>
            </body>
        </html>
        """
        plain_text = (
            f"Yeni Teklif Talebi\n\n"
            f"Merhaba {supplier_name},\n\n"
            f"{company_name} tarafından size yeni bir teklif talebi iletilmiştir.\n\n"
            f"Teklif: {quote_title}\n"
            f"Son Tarih: {deadline_str}\n\n"
            f"Teklifinizi hazırlamak için: {workspace_url}\n\n"
            f"{company_name} - {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        )
        subject = f"[ProcureFlow] Yeni Teklif Talebi: {quote_title}"
        return self._send_smtp(to_email, subject, html_content, plain_text)

    def send_revision_request_to_supplier(
        self,
        to_email: str,
        supplier_name: str,
        quote_title: str,
        reason: str,
        revision_number: int,
        workspace_url: str,
        company_name: str = "ProcureFlow",
    ) -> bool:
        """Tedarikçiye revize talebi gönderildi bildirimi"""
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
                    <div style="background: linear-gradient(135deg, #b45309 0%, #f59e0b 100%); padding: 20px; border-radius: 8px 8px 0 0;">
                        <h2 style="color: white; margin: 0; font-size: 20px;">🔄 Revize Talebi — {revision_number}. Revize</h2>
                    </div>
                    <div style="background: #fffbeb; border: 1px solid #fde68a; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
                        <p>Merhaba <strong>{supplier_name}</strong>,</p>
                        <p><strong>{company_name}</strong>, aşağıdaki teklifiniz için revize talep etmektedir.</p>
                        <div style="background: white; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 20px 0;">
                            <p style="margin: 4px 0;"><strong>📌 Teklif:</strong> {quote_title}</p>
                            <p style="margin: 4px 0;"><strong>🔁 Revize No:</strong> {revision_number}. Revize</p>
                            <p style="margin: 8px 0 4px 0;"><strong>💬 Revize Nedeni:</strong></p>
                            <p style="margin: 4px 0; background: #fef3c7; padding: 10px; border-radius: 4px; font-style: italic;">"{reason}"</p>
                        </div>
                        <p>Yeni fiyatlarınızı girmek için lütfen sisteme giriş yapın:</p>
                        <div style="text-align: center; margin: 28px 0;">
                            <a href="{workspace_url}" style="display: inline-block; padding: 14px 32px; background-color: #d97706; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">
                                Revize Teklifimi Gönder
                            </a>
                        </div>
                        <p style="font-size: 12px; color: #6b7280;">Butona tıklanamıyorsa: <a href="{workspace_url}" style="color: #d97706;">{workspace_url}</a></p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <p style="font-size: 12px; color: #9ca3af; text-align: center;">{company_name} - Tedarik Zinciri Yönetim Sistemi · {datetime.now().strftime('%d.%m.%Y %H:%M')}</p>
                    </div>
                </div>
            </body>
        </html>
        """
        plain_text = (
            f"{revision_number}. Revize Talebi\n\n"
            f"Merhaba {supplier_name},\n\n"
            f"{company_name}, teklifiniz için revize talep etmektedir.\n\n"
            f"Teklif: {quote_title}\n"
            f"Revize No: {revision_number}\n"
            f"Revize Nedeni: {reason}\n\n"
            f"Revize teklifinizi göndermek için: {workspace_url}\n\n"
            f"{company_name} - {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        )
        subject = (
            f"[ProcureFlow] Revize Talebi ({revision_number}. Revize): {quote_title}"
        )
        return self._send_smtp(to_email, subject, html_content, plain_text)

    def send_supplier_response_to_admin(
        self,
        to_email: str,
        admin_name: str,
        supplier_company: str,
        quote_title: str,
        final_amount: float,
        revision_number: int,
        discount_percent: float = 0,
        discount_amount: float = 0,
        delivery_time: int | None = None,
        payment_terms: str | None = None,
        warranty: str | None = None,
        workspace_url: str = "",
        company_name: str = "ProcureFlow",
        owner_user_id: int | None = None,
    ) -> bool:
        """Satın alma sorumlusuna tedarikçi yanıtı bildirimi (ilk teklif veya revize)"""
        is_revision = revision_number > 0
        revision_label = (
            f"{revision_number}. Revize Teklif" if is_revision else "İlk Teklif"
        )
        icon = "🔄" if is_revision else "📬"
        header_color = "#b45309" if is_revision else "#065f46"
        header_color2 = "#f59e0b" if is_revision else "#10b981"
        border_color = "#f59e0b" if is_revision else "#10b981"
        bg_color = "#fffbeb" if is_revision else "#f0fdf4"

        discount_html = ""
        if discount_percent > 0:
            discount_html = f"<p style='margin:4px 0;'><strong>🏷️ İndirim:</strong> %{discount_percent:.1f} (₺{discount_amount:,.2f})</p>"

        delivery_html = (
            f"<p style='margin:4px 0;'><strong>🚚 Teslimat:</strong> {delivery_time} gün</p>"
            if delivery_time
            else ""
        )
        payment_html = (
            f"<p style='margin:4px 0;'><strong>💳 Ödeme:</strong> {payment_terms}</p>"
            if payment_terms
            else ""
        )
        warranty_html = (
            f"<p style='margin:4px 0;'><strong>🛡️ Garanti:</strong> {warranty}</p>"
            if warranty
            else ""
        )

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
                    <div style="background: linear-gradient(135deg, {header_color} 0%, {header_color2} 100%); padding: 20px; border-radius: 8px 8px 0 0;">
                        <h2 style="color: white; margin: 0; font-size: 20px;">{icon} Teklif Yanıtı Alındı — {revision_label}</h2>
                    </div>
                    <div style="background: {bg_color}; border: 1px solid {border_color}; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
                        <p>Merhaba <strong>{admin_name}</strong>,</p>
                        <p><strong>{supplier_company}</strong> şirketi, <em>{quote_title}</em> için <strong>{revision_label}</strong> göndermiştir.</p>
                        <div style="background: white; border-left: 4px solid {border_color}; padding: 16px; border-radius: 4px; margin: 20px 0;">
                            <p style="margin: 4px 0;"><strong>🏢 Tedarikçi:</strong> {supplier_company}</p>
                            <p style="margin: 4px 0;"><strong>📌 Teklif:</strong> {quote_title}</p>
                            <p style="margin: 4px 0;"><strong>💰 Toplam Tutar:</strong> <span style="font-size: 16px; font-weight: bold; color: #1f2937;">₺{final_amount:,.2f}</span></p>
                            {discount_html}{delivery_html}{payment_html}{warranty_html}
                        </div>
                        {"<p>Sisteme giriş yaparak teklifleri karşılaştırabilirsiniz.</p>" if workspace_url else ""}
                        {f'<div style="text-align:center;margin:20px 0;"><a href="{workspace_url}" style="display:inline-block;padding:12px 28px;background:{header_color2};color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Teklifi İncele</a></div>' if workspace_url else ""}
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                        <p style="font-size: 12px; color: #9ca3af; text-align: center;">{company_name} · {datetime.now().strftime('%d.%m.%Y %H:%M')}</p>
                    </div>
                </div>
            </body>
        </html>
        """
        plain_text = (
            f"{icon} Teklif Yanıtı — {revision_label}\n\n"
            f"Merhaba {admin_name},\n\n"
            f"{supplier_company} şirketi, {quote_title} için {revision_label} gönderdi.\n\n"
            f"Toplam Tutar: ₺{final_amount:,.2f}\n"
            + (
                f"İndirim: %{discount_percent:.1f} (₺{discount_amount:,.2f})\n"
                if discount_percent > 0
                else ""
            )
            + (f"Teslimat: {delivery_time} gün\n" if delivery_time else "")
            + (f"Ödeme: {payment_terms}\n" if payment_terms else "")
            + f"\n{company_name} · {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        )
        subject = (
            f"[ProcureFlow] {icon} {supplier_company} — {revision_label}: {quote_title}"
        )
        return self._send_smtp(
            to_email,
            subject,
            html_content,
            plain_text,
            owner_user_id=owner_user_id,
        )


# Singleton instance
email_service = EmailService()


def get_email_service() -> EmailService:
    """Email servisi dependency'si"""
    return email_service

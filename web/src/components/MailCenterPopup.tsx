import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Archive, ArrowLeft, BadgeAlert, Bell, Download, ExternalLink, MailOpen, Paperclip, Reply, Search, ShieldAlert, Star, Trash2 } from "lucide-react";
import { diagnoseMailCenterAccount, fetchMailCenterAttachment, getMailCenterAccounts, getMailCenterMessages, sendMailCenterTest, syncMailCenterInbox, updateMailCenterMessage, type MailCenterAccount, type MailCenterAccountDiagnosis, type MailCenterMessage } from "../services/mail-center.service";
import { useAuth } from "../hooks/useAuth";
import type { AxiosError } from "axios";
import "./MailCenterPopup.css";

function formatMailTimestamp(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMailFolderLabel(folder: string) {
  switch (folder) {
    case "inbox":    return "Gelen Kutusu";
    case "outbound": return "Giden Kutusu";
    case "archived": return "Arşiv";
    case "spam":     return "Spam";
    case "trash":    return "Çöp Kutusu";
    default:         return "Tüm Mesajlar";
  }
}

function getMessageStatusTone(message: MailCenterMessage) {
  if (message.status === "spam")     return { background: "#fee2e2", color: "#991b1b" };
  if (message.status === "archived") return { background: "#f1f5f9", color: "#334155" };
  if (message.status === "deleted")  return { background: "#e2e8f0", color: "#475569" };
  if (message.direction === "outbound") return { background: "#dbeafe", color: "#1d4ed8" };
  return { background: message.is_read ? "#f8fafc" : "#dcfce7", color: message.is_read ? "#475569" : "#166534" };
}

function resolveErrorText(error: unknown, fallback: string) {
  const maybeAxios = error as AxiosError<{ detail?: string; message?: string }>;
  const detail = maybeAxios?.response?.data?.detail || maybeAxios?.response?.data?.message;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isAuthFailureText(value?: string | null) {
  const normalized = String(value || "").toLowerCase();
  return normalized.includes("authenticationfailed") || normalized.includes("invalid credentials") || normalized.includes("auth failed");
}

type Props = {
  isOpen: boolean;
  initialAccountId?: number | null;
  onClose: () => void;
};

export default function MailCenterPopup({ isOpen, initialAccountId, onClose }: Props) {
  const { user } = useAuth();
  const mailboxModalRef = useRef<HTMLDivElement | null>(null);
  const mailboxDragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const mailboxDraggingRef = useRef(false);
  const autoSyncedAccountIdsRef = useRef<Set<number>>(new Set());
  const [mailListPaneWidth, setMailListPaneWidth] = useState(340);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<MailCenterAccount[]>([]);
  const [messages, setMessages] = useState<MailCenterMessage[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(initialAccountId ?? null);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [mailDirectionFilter, setMailDirectionFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [selectedMailFolder, setSelectedMailFolder] = useState<"all" | "inbox" | "outbound" | "archived" | "spam" | "trash">("inbox");
  const [mailSearchQuery, setMailSearchQuery] = useState("");
  const [mailDraft, setMailDraft] = useState({ to_email: "", subject: "ProcureFlow test", body: "Merhaba,\n\nBu test e-postası ProcureFlow Mail Merkezi ekranından gönderilmiştir.", cc: "" });
  const [attachmentPreview, setAttachmentPreview] = useState<{ name: string; url: string; contentType: string; textContent?: string | null } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [accountDiagnosis, setAccountDiagnosis] = useState<MailCenterAccountDiagnosis | null>(null);

  const selectedAccount = useMemo(() => accounts.find((item) => item.id === selectedAccountId) || null, [accounts, selectedAccountId]);
  const selectedMessage = useMemo(() => messages.find((item) => item.id === selectedMessageId) || null, [messages, selectedMessageId]);
  const selectedThreadMessages = useMemo(() => selectedMessage?.thread_key ? messages.filter((item) => item.thread_key === selectedMessage.thread_key && item.id !== selectedMessage.id) : [], [messages, selectedMessage]);
  const filteredMessages = useMemo(() => {
    const query = mailSearchQuery.trim().toLowerCase();
    return messages.filter((entry) => {
      const folderMatches = (() => {
        if (selectedMailFolder === "all")      return true;
        if (selectedMailFolder === "inbox")    return entry.direction === "inbound" && !["archived", "spam", "deleted"].includes(String(entry.status || "").toLowerCase());
        if (selectedMailFolder === "outbound") return entry.direction === "outbound" && String(entry.status || "").toLowerCase() !== "deleted";
        if (selectedMailFolder === "archived") return String(entry.status || "").toLowerCase() === "archived";
        if (selectedMailFolder === "spam")     return String(entry.status || "").toLowerCase() === "spam";
        if (selectedMailFolder === "trash")    return String(entry.status || "").toLowerCase() === "deleted";
        return true;
      })();
      if (!folderMatches) return false;
      if (!query) return true;
      return [entry.subject, entry.snippet, entry.body_text, entry.from_email, entry.to_email, entry.cc_email].join(" ").toLowerCase().includes(query);
    });
  }, [mailSearchQuery, messages, selectedMailFolder]);
  const folderStats = useMemo(() => ({
    inbox:    messages.filter((entry) => entry.direction === "inbound" && !["archived", "spam", "deleted"].includes(String(entry.status || "").toLowerCase())).length,
    outbound: messages.filter((entry) => entry.direction === "outbound" && String(entry.status || "").toLowerCase() !== "deleted").length,
    archived: messages.filter((entry) => String(entry.status || "").toLowerCase() === "archived").length,
    spam:     messages.filter((entry) => String(entry.status || "").toLowerCase() === "spam").length,
    trash:    messages.filter((entry) => String(entry.status || "").toLowerCase() === "deleted").length,
  }), [messages]);
  const totalUnread = useMemo(() => accounts.reduce((sum, item) => sum + (item.unread_count || 0), 0), [accounts]);
  const paneStorageKey = useMemo(() => `pf.mailPaneWidth.global.${user?.id || "guest"}`, [user?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const storedWidth = Number(window.localStorage.getItem(paneStorageKey) || 0);
    if (storedWidth >= 300) setMailListPaneWidth(storedWidth);
  }, [isOpen, paneStorageKey]);

  useEffect(() => {
    if (mailListPaneWidth >= 300) {
      window.localStorage.setItem(paneStorageKey, String(Math.round(mailListPaneWidth)));
    }
  }, [mailListPaneWidth, paneStorageKey]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!mailboxDragStateRef.current || !mailboxModalRef.current) return;
      const bounds = mailboxModalRef.current.getBoundingClientRect();
      const nextWidth = mailboxDragStateRef.current.startWidth + (event.clientX - mailboxDragStateRef.current.startX);
      const clampedWidth = Math.min(Math.max(nextWidth, 300), Math.max(300, bounds.width - 520));
      mailboxDraggingRef.current = true;
      setMailListPaneWidth(clampedWidth);
    };
    const handleMouseUp = () => {
      mailboxDragStateRef.current = null;
      window.setTimeout(() => { mailboxDraggingRef.current = false; }, 0);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (attachmentPreview?.url) URL.revokeObjectURL(attachmentPreview.url);
    };
  }, [attachmentPreview]);

  useEffect(() => {
    if (!isOpen) return;
    autoSyncedAccountIdsRef.current.clear();
    let cancelled = false;
    const loadAccounts = async () => {
      try {
        const nextAccounts = await getMailCenterAccounts();
        if (cancelled) return;
        setAccounts(nextAccounts);
        setAccountDiagnosis(null);
        setSelectedAccountId((prev) => {
          if (initialAccountId && nextAccounts.some((account) => account.id === initialAccountId)) return initialAccountId;
          if (prev && nextAccounts.some((account) => account.id === prev)) return prev;
          return nextAccounts[0]?.id ?? null;
        });
      } catch (error) {
        if (!cancelled) setMessage({ type: "error", text: error instanceof Error ? error.message : "Mail hesapları yüklenemedi" });
      }
    };
    void loadAccounts();
    return () => { cancelled = true; };
  }, [initialAccountId, isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedAccountId) return;
    let cancelled = false;
    const loadMessages = async () => {
      try {
        setMessages([]);
        setSelectedMessageId(null);
        setSelectedMessageIds([]);
        setAccountDiagnosis(null);
        let nextMessages = await getMailCenterMessages(selectedAccountId, mailDirectionFilter);
        if (
          !nextMessages.length
          && !autoSyncedAccountIdsRef.current.has(selectedAccountId)
          && !isAuthFailureText(selectedAccount?.last_inbox_error)
        ) {
          autoSyncedAccountIdsRef.current.add(selectedAccountId);
          try {
            await syncMailCenterInbox(selectedAccountId);
            nextMessages = await getMailCenterMessages(selectedAccountId, mailDirectionFilter);
            if (nextMessages.length > 0) setMessage({ type: "success", text: "Mailbox otomatik senkronize edildi." });
          } catch {
            // Auto sync best-effort: manual sync remains available from UI.
          }
        } else if (!nextMessages.length && isAuthFailureText(selectedAccount?.last_inbox_error)) {
          setMessage({ type: "error", text: "Mailbox kimlik doğrulama hatası var. Önce Tanı Çalıştır ile kontrol edip şifre veya app password bilgisini güncelleyin." });
        }
        if (cancelled) return;
        setMessages(nextMessages);
      } catch (error) {
        if (!cancelled) setMessage({ type: "error", text: resolveErrorText(error, "Mesajlar yuklenemedi") });
      }
    };
    void loadMessages();
    return () => { cancelled = true; };
  }, [isOpen, mailDirectionFilter, selectedAccountId, selectedAccount?.last_inbox_error]);

  useEffect(() => {
    if (!filteredMessages.length) { setSelectedMessageId(null); setSelectedMessageIds([]); return; }
    setSelectedMessageId((current) => (current && filteredMessages.some((item) => item.id === current) ? current : filteredMessages[0]?.id ?? null));
  }, [filteredMessages]);

  const toggleMessageSelection = (messageId: number) => {
    setSelectedMessageIds((prev) => (prev.includes(messageId) ? prev.filter((item) => item !== messageId) : [...prev, messageId]));
  };

  const handleMessageAction = async (action: string, targetMessage?: MailCenterMessage | null) => {
    if (!selectedAccountId || !targetMessage) return;
    try {
      const updated = await updateMailCenterMessage(selectedAccountId, targetMessage.id, { action: action as never });
      setMessages((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (error) {
      setMessage({ type: "error", text: resolveErrorText(error, "Mesaj islemi basarisiz") });
    }
  };

  const handleMetaAction = async (action: "star" | "unstar" | "important" | "unimportant", targetMessage?: MailCenterMessage | null) => {
    if (!selectedAccountId || !targetMessage) return;
    try {
      const updated = await updateMailCenterMessage(selectedAccountId, targetMessage.id, { action });
      setMessages((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (error) {
      setMessage({ type: "error", text: resolveErrorText(error, "Mesaj etiketi guncellenemedi") });
    }
  };

  const handleBulkAction = async (action: string) => {
    const targets = messages.filter((entry) => selectedMessageIds.includes(entry.id));
    for (const target of targets) await handleMessageAction(action, target);
    setSelectedMessageIds([]);
  };

  const handleReply = (target?: MailCenterMessage | null) => {
    const source = target || selectedMessage;
    if (!source) return;
    const replyTarget = (source.direction === "inbound" ? source.from_email : source.to_email) || "";
    const nextSubject = source.subject?.toLowerCase().startsWith("re:") ? source.subject || "" : `Re: ${source.subject || "Mesaj"}`;
    const quotedBody = source.body_text ? `\n\n--- Orijinal Mesaj ---\n${source.body_text}` : "";
    setMailDraft({ to_email: replyTarget, subject: nextSubject, body: `Merhaba,\n\n${quotedBody}`, cc: source.cc_email || "" });
    setSelectedMailFolder("outbound");
    setMessage({ type: "success", text: `${replyTarget || "Hedef alıcı"} için cevap taslağı hazırlandı` });
  };

  const handleDiagnose = async (accountId?: number | null) => {
    const targetAccountId = accountId ?? selectedAccountId;
    if (!targetAccountId) return null;
    try {
      setDiagnosing(true);
      const result = await diagnoseMailCenterAccount(targetAccountId);
      setAccountDiagnosis(result);
      setMessage({ type: result.status === "ok" ? "success" : "error", text: result.status === "ok" ? "Mailbox baglanti tani basarili." : "Mailbox baglanti tanisinda sorun tespit edildi." });
      return result;
    } catch (error) {
      setMessage({ type: "error", text: resolveErrorText(error, "Mailbox tani calistirilamadi") });
      return null;
    } finally {
      setDiagnosing(false);
    }
  };

  const handleSync = async () => {
    if (!selectedAccountId) return;
    try {
      setLoading(true);
      const result = await syncMailCenterInbox(selectedAccountId);
      setMessage({ type: "success", text: result.message });
      const [nextAccounts, nextMessages] = await Promise.all([getMailCenterAccounts(), getMailCenterMessages(selectedAccountId, mailDirectionFilter)]);
      setAccounts(nextAccounts);
      setMessages(nextMessages);
      setAccountDiagnosis(null);
    } catch (error) {
      setMessage({ type: "error", text: resolveErrorText(error, "Inbox sync basarisiz") });
      void handleDiagnose(selectedAccountId);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedAccountId || !mailDraft.to_email.trim()) {
      setMessage({ type: "error", text: "Gönderim için hedef e-posta gerekli" });
      return;
    }
    try {
      setLoading(true);
      const result = await sendMailCenterTest(selectedAccountId, { ...mailDraft, cc: mailDraft.cc || undefined });
      setMessage({ type: "success", text: result.message });
      const nextMessages = await getMailCenterMessages(selectedAccountId, mailDirectionFilter);
      setMessages(nextMessages);
      setSelectedMailFolder("outbound");
    } catch (error) {
      setMessage({ type: "error", text: resolveErrorText(error, "Mail gönderilemedi") });
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentAction = async (attachmentIndex: number, mode: "preview" | "download") => {
    if (!selectedAccountId || !selectedMessage) return;
    try {
      const parsedAttachments = JSON.parse(selectedMessage.attachments_json || "[]");
      const attachmentMeta = parsedAttachments[attachmentIndex] || {};
      const blob = await fetchMailCenterAttachment(selectedAccountId, selectedMessage.id, attachmentIndex, mode === "preview" ? "inline" : "attachment");
      const objectUrl = URL.createObjectURL(blob);
      if (mode === "download") {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = attachmentMeta.filename || `attachment-${attachmentIndex + 1}`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        return;
      }
      const contentType = attachmentMeta.content_type || blob.type || "application/octet-stream";
      let textContent = null;
      if (/^(text\/|application\/(json|xml|javascript))/.test(contentType) || /csv|yaml|yml/.test(contentType)) {
        textContent = await blob.text();
      }
      setAttachmentPreview({ name: attachmentMeta.filename || `attachment-${attachmentIndex + 1}`, url: objectUrl, contentType, textContent });
    } catch (error) {
      setMessage({ type: "error", text: resolveErrorText(error, "Attachment acilamadi") });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="mc-overlay"
        onClick={(event) => {
          if (event.target !== event.currentTarget || mailboxDraggingRef.current) return;
          onClose();
        }}
      >
        <div ref={mailboxModalRef} className="mc-panel" onClick={(event) => event.stopPropagation()}>

          {/* ── Header ── */}
          <div className="mc-head">
            <div className="mc-head__left">
              <div className="mc-head__eyebrow"><Bell size={14} />MAIL CENTER</div>
              <h4 className="mc-head__title">{selectedAccount?.email || "Mailbox seçiniz"}</h4>
              <div className="mc-head__desc">
                {selectedAccount
                  ? "Gelen ve giden hareketler bu hesap özelinde görüntülenir. Özel SMTP/IMAP tanımlıysa o hesap varsayılan, değilse platform iş maili kullanılır."
                  : "Açmak için önce bir mailbox hesabı seçin."}
              </div>
            </div>
            <div className="mc-head__actions">
              <button type="button" className="mc-btn" onClick={() => handleMessageAction(selectedMessage?.is_read ? "unread" : "read", selectedMessage)} disabled={loading || !selectedMessage}>
                <MailOpen size={15} />{selectedMessage?.is_read ? "Okunmadı" : "Okundu"}
              </button>
              <button type="button" className="mc-btn" onClick={() => handleReply()} disabled={!selectedMessage}>
                <Reply size={15} />Cevapla
              </button>
              <button type="button" className="mc-btn" onClick={() => handleMessageAction("archive", selectedMessage)} disabled={!selectedMessage}>
                <Archive size={15} />Arşivle
              </button>
              <button type="button" className="mc-btn mc-btn--spam" onClick={() => handleMessageAction("spam", selectedMessage)} disabled={!selectedMessage}>
                <ShieldAlert size={15} />Spam
              </button>
              <button type="button" className="mc-btn mc-btn--trash" onClick={() => handleMessageAction("trash", selectedMessage)} disabled={!selectedMessage}>
                <Trash2 size={15} />Sil
              </button>
              <button type="button" className="mc-btn mc-btn--diagnose" onClick={() => { void handleDiagnose(); }} disabled={loading || diagnosing || !selectedAccountId}>
                <ShieldAlert size={15} />{diagnosing ? "Tanı..." : "Tanı Çalıştır"}
              </button>
              <button type="button" className="mc-btn" onClick={handleSync} disabled={loading || !selectedAccountId}>Yenile / Sync</button>
              <button type="button" className="mc-btn" onClick={onClose}>Kapat</button>
            </div>
          </div>

          {/* ── Alert ── */}
          {message && <div className={`mc-alert mc-alert--${message.type}`}>{message.text}</div>}

          {/* ── Account chips ── */}
          <div className="mc-accounts">
            {accounts.length === 0 && (
              <div className="mc-accounts__empty">
                Açılabilir mailbox bulunamadı. Özel SMTP/IMAP ayarı yoksa profil iş mailinizin oluşturulduğunu, özel ayar varsa mailbox kimlik bilgilerinizin güncel olduğunu kontrol edin.
              </div>
            )}
            {accounts.map((account) => (
              <button
                key={account.id}
                className={`mc-chip${selectedAccountId === account.id ? " mc-chip--active" : ""}`}
                onClick={() => { setSelectedAccountId(account.id); setMessages([]); setSelectedMessageId(null); setSelectedMessageIds([]); }}
              >
                {account.email} {account.unread_count > 0 ? `• ${account.unread_count}` : ""}
              </button>
            ))}
          </div>

          {/* ── Toolbar: folders + search ── */}
          <div className="mc-toolbar">
            <div className="mc-toolbar__folders">
              {(["inbox", "outbound", "archived", "spam", "trash"] as const).map((key) => (
                <button
                  key={key}
                  className={`mc-folder${selectedMailFolder === key ? " mc-folder--active" : ""}`}
                  onClick={() => setSelectedMailFolder(key)}
                >
                  {getMailFolderLabel(key)} • {folderStats[key]}{key === "inbox" && totalUnread > 0 ? ` • ${totalUnread} yeni` : ""}
                </button>
              ))}
            </div>
            <div className="mc-toolbar__right">
              <div className="mc-search">
                <Search size={15} className="mc-search__icon" />
                <input
                  value={mailSearchQuery}
                  onChange={(event) => setMailSearchQuery(event.target.value)}
                  placeholder="Mail ara: konu, gönderen, içerik"
                />
              </div>
              <select className="mc-dir-filter" value={mailDirectionFilter} onChange={(event) => setMailDirectionFilter(event.target.value as never)}>
                <option value="all">Tüm hareketler</option>
                <option value="inbound">Sadece gelen</option>
                <option value="outbound">Sadece giden</option>
              </select>
            </div>
          </div>

          {/* ── Body: list | resizer | detail ── */}
          <div className="mc-body" style={{ gridTemplateColumns: `${mailListPaneWidth}px 14px minmax(540px, 1fr)` }}>

            {/* List pane */}
            <div className="mc-list">
              <div className="mc-acct-info">
                <div className="mc-acct-info__label">Hesap Özeti</div>
                <div className="mc-acct-info__desc">{selectedAccount?.description || "Sistem mailbox"}</div>
                <div className="mc-acct-info__sync">Son sync: {selectedAccount?.last_inbox_sync_at ? formatMailTimestamp(selectedAccount.last_inbox_sync_at) : "Hic yapilmadi"}</div>
                {selectedAccount?.last_inbox_error && <div className="mc-acct-info__error">{selectedAccount.last_inbox_error}</div>}
                {accountDiagnosis && (
                  <div className={`mc-diag mc-diag--${accountDiagnosis.status === "ok" ? "ok" : "err"}`}>
                    <div className="mc-diag__title">Tanı Durumu: {accountDiagnosis.status === "ok" ? "Başarılı" : "Sorun var"}</div>
                    <div className="mc-diag__host">IMAP: {accountDiagnosis.imap_host || "-"}:{accountDiagnosis.imap_port || "-"} {accountDiagnosis.imap_use_ssl ? "(SSL)" : ""}</div>
                    <div className="mc-diag__checks">
                      <span className={`mc-diag__check mc-diag__check--${accountDiagnosis.checks.has_imap_host ? "ok" : "err"}`}>Host {accountDiagnosis.checks.has_imap_host ? "OK" : "Eksik"}</span>
                      <span className={`mc-diag__check mc-diag__check--${accountDiagnosis.checks.has_username ? "ok" : "err"}`}>Username {accountDiagnosis.checks.has_username ? "OK" : "Eksik"}</span>
                      <span className={`mc-diag__check mc-diag__check--${accountDiagnosis.checks.has_password ? "ok" : "err"}`}>Password {accountDiagnosis.checks.has_password ? "OK" : "Eksik"}</span>
                    </div>
                    {accountDiagnosis.connection?.error_message && <div className="mc-diag__conn-err">{accountDiagnosis.connection.error_message}</div>}
                    {Array.isArray(accountDiagnosis.hints) && accountDiagnosis.hints.length > 0 && (
                      <ul className="mc-diag__hints">
                        {accountDiagnosis.hints.map((hint) => <li key={hint}>{hint}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {selectedMessageIds.length > 0 && (
                <div className="mc-bulk">
                  <span className="mc-bulk__count">{selectedMessageIds.length} mesaj seçili</span>
                  <button type="button" className="mc-btn" onClick={() => void handleBulkAction("archive")}><Archive size={14} />Arşivle</button>
                  <button type="button" className="mc-btn mc-btn--spam" onClick={() => void handleBulkAction("spam")}><ShieldAlert size={14} />Spam</button>
                  <button type="button" className="mc-btn mc-btn--trash" onClick={() => void handleBulkAction("trash")}><Trash2 size={14} />Çöp</button>
                  <button type="button" className="mc-btn" onClick={() => setSelectedMessageIds([])}><ArrowLeft size={14} />Temizle</button>
                </div>
              )}

              <div className="mc-rows">
                {filteredMessages.length === 0 && <div className="mc-rows__empty">Bu filtreye uygun mesaj bulunmuyor.</div>}
                {filteredMessages.map((entry) => {
                  const tone = getMessageStatusTone(entry);
                  const active = selectedMessageId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      role="button"
                      tabIndex={0}
                      className={`mc-row${active ? " mc-row--active" : ""}`}
                      onClick={() => { setSelectedMessageId(entry.id); if (!entry.is_read) void handleMessageAction("read", entry); }}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMessageId(entry.id); if (!entry.is_read) void handleMessageAction("read", entry); } }}
                    >
                      <div className="mc-row__top">
                        <div className="mc-row__left">
                          <input type="checkbox" checked={selectedMessageIds.includes(entry.id)} onChange={(event) => { event.stopPropagation(); toggleMessageSelection(entry.id); }} onClick={(event) => event.stopPropagation()} style={{ marginTop: 2 }} />
                          <div className="mc-row__meta">
                            <div className="mc-row__subject-row">
                              <button type="button" aria-label={entry.is_starred ? "Yıldızı kaldır" : "Yıldızla"} className={`mc-row__icon-btn mc-row__icon-btn--star${entry.is_starred ? " on" : ""}`} onClick={(event) => { event.stopPropagation(); void handleMetaAction(entry.is_starred ? "unstar" : "star", entry); }}>
                                <Star size={15} fill={entry.is_starred ? "currentColor" : "none"} />
                              </button>
                              <button type="button" aria-label={entry.is_important ? "Önemli işaretini kaldır" : "Önemli olarak işaretle"} className={`mc-row__icon-btn mc-row__icon-btn--important${entry.is_important ? " on" : ""}`} onClick={(event) => { event.stopPropagation(); void handleMetaAction(entry.is_important ? "unimportant" : "important", entry); }}>
                                <BadgeAlert size={15} />
                              </button>
                              <strong className="mc-row__subject">{entry.subject || "Konu yok"}</strong>
                            </div>
                          </div>
                        </div>
                        <span className="mc-badge" style={{ background: tone.background, color: tone.color }}>
                          {entry.direction === "outbound" ? "Giden" : entry.status === "spam" ? "Spam" : entry.status === "archived" ? "Arşiv" : entry.status === "deleted" ? "Çöp" : entry.is_read ? "Okundu" : "Okunmadı"}
                        </span>
                      </div>
                      <div className="mc-row__from">{entry.direction === "inbound" ? (entry.from_email || "-") : (entry.to_email || "-")}</div>
                      <div className="mc-row__snippet">{entry.snippet || "Önizleme yok"}</div>
                      <div className="mc-row__foot">
                        <span>{formatMailTimestamp(entry.received_at || entry.sent_at || entry.created_at)}</span>
                        {!entry.is_read && <span className="mc-row__new-badge">Yeni</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resizer */}
            <div
              role="separator"
              aria-orientation="vertical"
              className="mc-resizer"
              onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); mailboxDragStateRef.current = { startX: event.clientX, startWidth: mailListPaneWidth }; }}
            >
              <div className="mc-resizer__handle" />
            </div>

            {/* Reading pane */}
            <div className="mc-detail">
              <div className="mc-msg-head">
                <div className="mc-msg-head__top">
                  <div>
                    <div className="mc-msg-head__subject">{selectedMessage?.subject || "Mesaj seçin"}</div>
                    <div className="mc-msg-head__from">
                      {selectedMessage
                        ? `${selectedMessage.direction === "inbound" ? "Kimden" : "Kime"}: ${selectedMessage.direction === "inbound" ? selectedMessage.from_email || "-" : selectedMessage.to_email || "-"}`
                        : "Sol listeden bir mesaj seçin"}
                    </div>
                  </div>
                  {selectedMessage && <div className="mc-msg-head__time">{formatMailTimestamp(selectedMessage.received_at || selectedMessage.sent_at || selectedMessage.created_at)}</div>}
                </div>
                {selectedMessage?.cc_email && <div className="mc-msg-head__cc">CC: {selectedMessage.cc_email}</div>}
              </div>

              <div className="mc-msg-actions">
                <button type="button" className="mc-btn mc-btn--reply" onClick={() => handleReply()} disabled={!selectedMessage}><Reply size={15} />Cevapla</button>
                <button type="button" className="mc-btn" onClick={() => handleMessageAction("archive", selectedMessage)} disabled={!selectedMessage}><Archive size={15} />Arşivle</button>
                <button type="button" className="mc-btn mc-btn--spam" onClick={() => handleMessageAction("spam", selectedMessage)} disabled={!selectedMessage}><ShieldAlert size={15} />Spam</button>
                <button type="button" className="mc-btn mc-btn--trash" onClick={() => handleMessageAction("trash", selectedMessage)} disabled={!selectedMessage}><Trash2 size={15} />Çöp Kutusu</button>
              </div>

              <div className="mc-msg-body">
                {selectedMessage ? (
                  <div className="mc-msg-content">
                    <div className="mc-msg-section">
                      <div className="mc-msg-section__label">Mesaj İçeriği</div>
                      <div className="mc-msg-text">
                        {selectedMessage.body_html
                          ? <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedMessage.body_html, { FORCE_BODY: true }) }} />
                          : <div className="mc-msg-text--pre">{selectedMessage.body_text || selectedMessage.snippet || "Mesaj gövdesi alınmadı."}</div>}
                      </div>
                    </div>

                    <div className="mc-meta-cards">
                      <div className="mc-meta-card"><div className="mc-meta-card__label">Durum</div><div className="mc-meta-card__value">{selectedMessage.status || "received"}</div></div>
                      <div className="mc-meta-card"><div className="mc-meta-card__label">Okunma</div><div className="mc-meta-card__value">{selectedMessage.is_read ? "Okundu" : "Okunmadı"}</div></div>
                      <div className="mc-meta-card"><div className="mc-meta-card__label">Klasör</div><div className="mc-meta-card__value">{getMailFolderLabel(selectedMailFolder)}</div></div>
                      <div className="mc-meta-card"><div className="mc-meta-card__label">CRM İşaretleri</div><div className="mc-meta-card__value">{selectedMessage.is_starred ? "Yıldızlı" : "-"} {selectedMessage.is_important ? "• Önemli" : ""}</div></div>
                    </div>

                    {selectedMessage.attachments_json && JSON.parse(selectedMessage.attachments_json || "[]").length > 0 && (
                      <div className="mc-msg-section">
                        <div className="mc-msg-section__label">Ek Dosyalar</div>
                        <div className="mc-attachments">
                          {(JSON.parse(selectedMessage.attachments_json || "[]") as Array<{ filename?: string; content_type?: string; size?: number }>).map((attachment, index) => (
                            <div key={`${attachment.filename || "attachment"}-${index}`} className="mc-attach-item">
                              <Paperclip size={14} />
                              <div className="mc-attach-info">
                                <strong className="mc-attach-name">{attachment.filename || "attachment"}</strong>
                                <span className="mc-attach-type">{attachment.content_type || "bilinmeyen tip"} • {attachment.size || 0} byte</span>
                              </div>
                              <button type="button" className="mc-btn" onClick={() => void handleAttachmentAction(index, "preview")}><ExternalLink size={13} />Önizle</button>
                              <button type="button" className="mc-btn" onClick={() => void handleAttachmentAction(index, "download")}><Download size={13} />İndir</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedThreadMessages.length > 0 && (
                      <div className="mc-msg-section">
                        <div className="mc-msg-section__label">Konuşma Zinciri</div>
                        <div className="mc-thread">
                          {selectedThreadMessages.map((threadMessage) => (
                            <div
                              key={threadMessage.id}
                              role="button"
                              tabIndex={0}
                              className="mc-thread-item"
                              onClick={() => setSelectedMessageId(threadMessage.id)}
                              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMessageId(threadMessage.id); } }}
                            >
                              <strong className="mc-thread-item__subject">{threadMessage.subject || "Konu yok"}</strong>
                              <span className="mc-thread-item__time">{formatMailTimestamp(threadMessage.received_at || threadMessage.sent_at || threadMessage.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mc-msg-body__empty">Sol listeden bir mesaj seçin.</div>
                )}
              </div>

              <div className="mc-compose">
                <div className="mc-compose__header">
                  <div className="mc-compose__title">Hızlı Cevap / Yeni Mail</div>
                  {mailDraft.to_email && <div className="mc-compose__draft-info">Hazır hedef: {mailDraft.to_email}</div>}
                </div>
                <div className="mc-compose__row">
                  <input className="mc-input" value={mailDraft.to_email} onChange={(event) => setMailDraft({ ...mailDraft, to_email: event.target.value })} placeholder="Alıcı" />
                  <input className="mc-input" value={mailDraft.cc} onChange={(event) => setMailDraft({ ...mailDraft, cc: event.target.value })} placeholder="CC" />
                </div>
                <input className="mc-input" value={mailDraft.subject} onChange={(event) => setMailDraft({ ...mailDraft, subject: event.target.value })} placeholder="Konu" />
                <textarea className="mc-textarea" value={mailDraft.body} onChange={(event) => setMailDraft({ ...mailDraft, body: event.target.value })} rows={4} />
                <div className="mc-compose__footer">
                  <button type="button" className="mc-btn mc-btn--send" onClick={handleSend} disabled={loading || !selectedAccountId}>Gönder</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attachment preview overlay */}
      {attachmentPreview && (
        <div
          className="mc-preview-overlay"
          onClick={() => { URL.revokeObjectURL(attachmentPreview.url); setAttachmentPreview(null); }}
        >
          <div className="mc-preview-panel" onClick={(event) => event.stopPropagation()}>
            <div className="mc-preview-head">
              <strong>{attachmentPreview.name}</strong>
              <button type="button" className="mc-btn" onClick={() => { URL.revokeObjectURL(attachmentPreview.url); setAttachmentPreview(null); }}>Kapat</button>
            </div>
            <div className="mc-preview-body">
              {attachmentPreview.textContent !== undefined && attachmentPreview.textContent !== null ? (
                <pre className="mc-preview-pre">{attachmentPreview.textContent}</pre>
              ) : attachmentPreview.contentType.startsWith("image/") ? (
                <img className="mc-preview-img" src={attachmentPreview.url} alt={attachmentPreview.name} />
              ) : attachmentPreview.contentType.startsWith("audio/") ? (
                <audio className="mc-preview-audio" src={attachmentPreview.url} controls />
              ) : attachmentPreview.contentType.startsWith("video/") ? (
                <video className="mc-preview-video" src={attachmentPreview.url} controls />
              ) : (
                <iframe className="mc-preview-iframe" src={attachmentPreview.url} title={attachmentPreview.name} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

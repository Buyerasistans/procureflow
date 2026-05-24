import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Archive, ArrowLeft, BadgeAlert, Bell, Download, ExternalLink, MailOpen, Paperclip, Reply, Search, ShieldAlert, Star, Trash2 } from "lucide-react";
import { diagnoseMailCenterAccount, fetchMailCenterAttachment, getMailCenterAccounts, getMailCenterMessages, sendMailCenterTest, syncMailCenterInbox, updateMailCenterMessage, type MailCenterAccount, type MailCenterAccountDiagnosis, type MailCenterMessage } from "../services/mail-center.service";
import { useAuth } from "../hooks/useAuth";
import type { AxiosError } from "axios";

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
    case "inbox":
      return "Gelen Kutusu";
    case "outbound":
      return "Giden Kutusu";
    case "archived":
      return "Arşiv";
    case "spam":
      return "Spam";
    case "trash":
      return "Çöp Kutusu";
    default:
      return "Tüm Mesajlar";
  }
}

function getMessageStatusTone(message: MailCenterMessage) {
  if (message.status === "spam") return { background: "#fee2e2", color: "#991b1b" };
  if (message.status === "archived") return { background: "#f1f5f9", color: "#334155" };
  if (message.status === "deleted") return { background: "#e2e8f0", color: "#475569" };
  if (message.direction === "outbound") return { background: "#dbeafe", color: "#1d4ed8" };
  return { background: message.is_read ? "#f8fafc" : "#dcfce7", color: message.is_read ? "#475569" : "#166534" };
}

function resolveErrorText(error: unknown, fallback: string) {
  const maybeAxios = error as AxiosError<{ detail?: string; message?: string }>;
  const detail = maybeAxios?.response?.data?.detail || maybeAxios?.response?.data?.message;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
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
        if (selectedMailFolder === "all") return true;
        if (selectedMailFolder === "inbox") return entry.direction === "inbound" && !["archived", "spam", "deleted"].includes(String(entry.status || "").toLowerCase());
        if (selectedMailFolder === "outbound") return entry.direction === "outbound" && String(entry.status || "").toLowerCase() !== "deleted";
        if (selectedMailFolder === "archived") return String(entry.status || "").toLowerCase() === "archived";
        if (selectedMailFolder === "spam") return String(entry.status || "").toLowerCase() === "spam";
        if (selectedMailFolder === "trash") return String(entry.status || "").toLowerCase() === "deleted";
        return true;
      })();
      if (!folderMatches) return false;
      if (!query) return true;
      return [entry.subject, entry.snippet, entry.body_text, entry.from_email, entry.to_email, entry.cc_email].join(" ").toLowerCase().includes(query);
    });
  }, [mailSearchQuery, messages, selectedMailFolder]);
  const folderStats = useMemo(() => ({
    inbox: messages.filter((entry) => entry.direction === "inbound" && !["archived", "spam", "deleted"].includes(String(entry.status || "").toLowerCase())).length,
    outbound: messages.filter((entry) => entry.direction === "outbound" && String(entry.status || "").toLowerCase() !== "deleted").length,
    archived: messages.filter((entry) => String(entry.status || "").toLowerCase() === "archived").length,
    spam: messages.filter((entry) => String(entry.status || "").toLowerCase() === "spam").length,
    trash: messages.filter((entry) => String(entry.status || "").toLowerCase() === "deleted").length,
  }), [messages]);
  const totalUnread = useMemo(() => accounts.reduce((sum, item) => sum + (item.unread_count || 0), 0), [accounts]);
  const paneStorageKey = useMemo(() => `pf.mailPaneWidth.global.${user?.id || "guest"}`, [user?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const storedWidth = Number(window.localStorage.getItem(paneStorageKey) || 0);
    if (storedWidth >= 300) {
      setMailListPaneWidth(storedWidth);
    }
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
      window.setTimeout(() => {
        mailboxDraggingRef.current = false;
      }, 0);
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
      if (attachmentPreview?.url) {
        URL.revokeObjectURL(attachmentPreview.url);
      }
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
        if (!cancelled) {
          setMessage({ type: "error", text: error instanceof Error ? error.message : "Mail hesapları yüklenemedi" });
        }
      }
    };
    void loadAccounts();
    return () => {
      cancelled = true;
    };
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
            if (nextMessages.length > 0) {
              setMessage({ type: "success", text: "Mailbox otomatik senkronize edildi." });
            }
          } catch {
            // Auto sync best-effort: manual sync remains available from UI.
          }
        } else if (!nextMessages.length && isAuthFailureText(selectedAccount?.last_inbox_error)) {
          setMessage({
            type: "error",
            text: "Mailbox kimlik doğrulama hatası var. Önce Tanı Çalıştır ile kontrol edip şifre veya app password bilgisini güncelleyin.",
          });
        }
        if (cancelled) return;
        setMessages(nextMessages);
      } catch (error) {
        if (!cancelled) {
          setMessage({ type: "error", text: resolveErrorText(error, "Mesajlar yuklenemedi") });
        }
      }
    };
    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [isOpen, mailDirectionFilter, selectedAccountId, selectedAccount?.last_inbox_error]);

  useEffect(() => {
    if (!filteredMessages.length) {
      setSelectedMessageId(null);
      setSelectedMessageIds([]);
      return;
    }
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
    for (const target of targets) {
      await handleMessageAction(action, target);
    }
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
      setMessage({
        type: result.status === "ok" ? "success" : "error",
        text: result.status === "ok" ? "Mailbox baglanti tani basarili." : "Mailbox baglanti tanisinda sorun tespit edildi.",
      });
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
      const [nextAccounts, nextMessages] = await Promise.all([
        getMailCenterAccounts(),
        getMailCenterMessages(selectedAccountId, mailDirectionFilter),
      ]);
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
      <div onClick={(event) => {
        if (event.target !== event.currentTarget || mailboxDraggingRef.current) return;
        onClose();
      }} style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.58)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, backdropFilter: "blur(6px)" }}>
        <div ref={mailboxModalRef} onClick={(event) => event.stopPropagation()} style={{ width: "min(1440px, calc(100vw - 24px))", minWidth: 1120, maxHeight: "calc(100vh - 24px)", minHeight: 800, overflow: "hidden", border: "1px solid rgba(148, 163, 184, 0.32)", borderRadius: 24, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 32px 80px rgba(15, 23, 42, 0.32)", display: "grid", gridTemplateRows: "auto auto auto 1fr" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ padding: 20 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "#e0f2fe", color: "#075985", fontSize: 12, fontWeight: 800 }}><Bell size={14} />MAIL CENTER</div>
              <h4 style={{ margin: "10px 0 0", fontSize: 24, color: "#0f172a" }}>{selectedAccount?.email || "Mailbox seçiniz"}</h4>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
                {selectedAccount
                  ? "Gelen ve giden hareketler bu hesap özelinde görüntülenir. Özel SMTP/IMAP tanımlıysa o hesap varsayılan, değilse platform iş maili kullanılır."
                  : "Açmak için önce bir mailbox hesabı seçin."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, padding: 20 }}>
              <button onClick={() => handleMessageAction(selectedMessage?.is_read ? "unread" : "read", selectedMessage)} disabled={loading || !selectedMessage} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MailOpen size={15} />{selectedMessage?.is_read ? "Okunmadı" : "Okundu"}</button>
              <button onClick={() => handleReply()} disabled={!selectedMessage} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Reply size={15} />Cevapla</button>
              <button onClick={() => handleMessageAction("archive", selectedMessage)} disabled={!selectedMessage} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Archive size={15} />Arşivle</button>
              <button onClick={() => handleMessageAction("spam", selectedMessage)} disabled={!selectedMessage} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74" }}><ShieldAlert size={15} />Spam</button>
              <button onClick={() => handleMessageAction("trash", selectedMessage)} disabled={!selectedMessage} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}><Trash2 size={15} />Sil</button>
              <button onClick={() => { void handleDiagnose(); }} disabled={loading || diagnosing || !selectedAccountId} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ecfeff", color: "#0f766e", border: "1px solid #67e8f9" }}>
                <ShieldAlert size={15} />{diagnosing ? "Tanı..." : "Tanı Çalıştır"}
              </button>
              <button onClick={handleSync} disabled={loading || !selectedAccountId}>Yenile / Sync</button>
              <button onClick={onClose}>Kapat</button>
            </div>
          </div>

          {message && <div style={{ margin: "0 20px 12px", padding: 12, borderRadius: 12, background: message.type === "success" ? "#dcfce7" : "#fee2e2", color: message.type === "success" ? "#166534" : "#991b1b", border: `1px solid ${message.type === "success" ? "#86efac" : "#fecaca"}` }}>{message.text}</div>}

          <div style={{ padding: "0 20px 16px", display: "flex", gap: 10, flexWrap: "wrap" }}>
            {accounts.length === 0 && (
              <div style={{ fontSize: 13, color: "#64748b", padding: "8px 0" }}>
                Açılabilir mailbox bulunamadı. Özel SMTP/IMAP ayarı yoksa profil iş mailinizin oluşturulduğunu, özel ayar varsa mailbox kimlik bilgilerinizin güncel olduğunu kontrol edin.
              </div>
            )}
            {accounts.map((account) => (
              <button key={account.id} onClick={() => {
                setSelectedAccountId(account.id);
                setMessages([]);
                setSelectedMessageId(null);
                setSelectedMessageIds([]);
              }} style={{ padding: "8px 12px", borderRadius: 12, border: selectedAccountId === account.id ? "1px solid #2563eb" : "1px solid #cbd5e1", background: selectedAccountId === account.id ? "#dbeafe" : "#fff", color: selectedAccountId === account.id ? "#1d4ed8" : "#334155", fontWeight: 800 }}>
                {account.email} {account.unread_count > 0 ? `• ${account.unread_count}` : ""}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "0 20px 18px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[{ key: "inbox", value: folderStats.inbox }, { key: "outbound", value: folderStats.outbound }, { key: "archived", value: folderStats.archived }, { key: "spam", value: folderStats.spam }, { key: "trash", value: folderStats.trash }].map((folder) => (
                <button key={folder.key} onClick={() => setSelectedMailFolder(folder.key as never)} style={{ padding: "8px 12px", borderRadius: 12, border: selectedMailFolder === folder.key ? "1px solid #2563eb" : "1px solid #cbd5e1", background: selectedMailFolder === folder.key ? "#dbeafe" : "#fff", color: selectedMailFolder === folder.key ? "#1d4ed8" : "#334155", fontWeight: 800 }}>
                  {getMailFolderLabel(folder.key)} • {folder.value}{folder.key === "inbox" && totalUnread > 0 ? ` • ${totalUnread} yeni` : ""}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                <input value={mailSearchQuery} onChange={(event) => setMailSearchQuery(event.target.value)} placeholder="Mail ara: konu, gönderen, içerik" style={{ width: 300, padding: "10px 12px 10px 34px", border: "1px solid #cbd5e1", borderRadius: 12 }} />
              </div>
              <select value={mailDirectionFilter} onChange={(event) => setMailDirectionFilter(event.target.value as never)} style={{ padding: 10, border: "1px solid #dbe3ee", borderRadius: 12 }}>
                <option value="all">Tüm hareketler</option>
                <option value="inbound">Sadece gelen</option>
                <option value="outbound">Sadece giden</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: `${mailListPaneWidth}px 14px minmax(540px, 1fr)`, minHeight: 0, overflow: "hidden" }}>
            <div style={{ borderRight: "1px solid #e2e8f0", background: "#f8fafc", overflow: "auto", padding: 16, display: "grid", gap: 12, alignContent: "start" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Hesap Özeti</div>
                <div style={{ color: "#0f172a", fontWeight: 700 }}>{selectedAccount?.description || "Sistem mailbox"}</div>
                <div style={{ color: "#475569", fontSize: 13 }}>Son sync: {selectedAccount?.last_inbox_sync_at ? formatMailTimestamp(selectedAccount.last_inbox_sync_at) : "Hic yapilmadi"}</div>
                {selectedAccount?.last_inbox_error && <div style={{ padding: 10, borderRadius: 12, background: "#fee2e2", color: "#991b1b", fontSize: 13 }}>{selectedAccount.last_inbox_error}</div>}
                {accountDiagnosis && (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: `1px solid ${accountDiagnosis.status === "ok" ? "#86efac" : "#fecaca"}`, background: accountDiagnosis.status === "ok" ? "#dcfce7" : "#fee2e2" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: accountDiagnosis.status === "ok" ? "#166534" : "#991b1b" }}>
                      Tani Durumu: {accountDiagnosis.status === "ok" ? "Basarili" : "Sorun var"}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#334155" }}>
                      IMAP: {accountDiagnosis.imap_host || "-"}:{accountDiagnosis.imap_port || "-"} {accountDiagnosis.imap_use_ssl ? "(SSL)" : ""}
                    </div>
                    <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 999, background: accountDiagnosis.checks.has_imap_host ? "#dcfce7" : "#fee2e2", color: accountDiagnosis.checks.has_imap_host ? "#166534" : "#991b1b" }}>
                        Host {accountDiagnosis.checks.has_imap_host ? "OK" : "Eksik"}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 999, background: accountDiagnosis.checks.has_username ? "#dcfce7" : "#fee2e2", color: accountDiagnosis.checks.has_username ? "#166534" : "#991b1b" }}>
                        Username {accountDiagnosis.checks.has_username ? "OK" : "Eksik"}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 999, background: accountDiagnosis.checks.has_password ? "#dcfce7" : "#fee2e2", color: accountDiagnosis.checks.has_password ? "#166534" : "#991b1b" }}>
                        Password {accountDiagnosis.checks.has_password ? "OK" : "Eksik"}
                      </span>
                    </div>
                    {accountDiagnosis.connection?.error_message && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#991b1b" }}>
                        {accountDiagnosis.connection.error_message}
                      </div>
                    )}
                    {Array.isArray(accountDiagnosis.hints) && accountDiagnosis.hints.length > 0 && (
                      <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#7c2d12", fontSize: 12 }}>
                        {accountDiagnosis.hints.map((hint) => (
                          <li key={hint}>{hint}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              {selectedMessageIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12, borderRadius: 14, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                  <span style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 800 }}>{selectedMessageIds.length} mesaj seçili</span>
                  <button onClick={() => void handleBulkAction("archive")} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Archive size={14} />Arşivle</button>
                  <button onClick={() => void handleBulkAction("spam")} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ShieldAlert size={14} />Spam</button>
                  <button onClick={() => void handleBulkAction("trash")} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Trash2 size={14} />Çöp</button>
                  <button onClick={() => setSelectedMessageIds([])} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ArrowLeft size={14} />Temizle</button>
                </div>
              )}
              <div style={{ display: "grid", gap: 8 }}>
                {filteredMessages.length === 0 && <div style={{ color: "#64748b", fontSize: 13 }}>Bu filtreye uygun mesaj bulunmuyor.</div>}
                {filteredMessages.map((entry) => {
                  const tone = getMessageStatusTone(entry);
                  const active = selectedMessageId === entry.id;
                  return (
                    <div key={entry.id} role="button" tabIndex={0} onClick={() => { setSelectedMessageId(entry.id); if (!entry.is_read) void handleMessageAction("read", entry); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMessageId(entry.id); if (!entry.is_read) void handleMessageAction("read", entry); } }} style={{ textAlign: "left", border: active ? "1px solid #2563eb" : "1px solid #e2e8f0", borderRadius: 16, padding: 14, background: active ? "#eff6ff" : "#fff", cursor: "pointer", display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0 }}>
                          <input type="checkbox" checked={selectedMessageIds.includes(entry.id)} onChange={(event) => { event.stopPropagation(); toggleMessageSelection(entry.id); }} onClick={(event) => event.stopPropagation()} style={{ marginTop: 2 }} />
                          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <button onClick={(event) => { event.stopPropagation(); void handleMetaAction(entry.is_starred ? "unstar" : "star", entry); }} style={{ border: "none", background: "transparent", padding: 0, display: "inline-flex", color: entry.is_starred ? "#f59e0b" : "#cbd5e1" }}><Star size={15} fill={entry.is_starred ? "currentColor" : "none"} /></button>
                              <button onClick={(event) => { event.stopPropagation(); void handleMetaAction(entry.is_important ? "unimportant" : "important", entry); }} style={{ border: "none", background: "transparent", padding: 0, display: "inline-flex", color: entry.is_important ? "#dc2626" : "#cbd5e1" }}><BadgeAlert size={15} /></button>
                              <strong style={{ color: "#0f172a", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.subject || "Konu yok"}</strong>
                            </div>
                          </div>
                        </div>
                        <span style={{ padding: "3px 8px", borderRadius: 999, ...tone, fontSize: 11, fontWeight: 800, flexShrink: 0, minWidth: 82, textAlign: "center" }}>{entry.direction === "outbound" ? "Giden" : entry.status === "spam" ? "Spam" : entry.status === "archived" ? "Arşiv" : entry.status === "deleted" ? "Çöp" : entry.is_read ? "Okundu" : "Okunmadı"}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>{entry.direction === "inbound" ? (entry.from_email || "-") : (entry.to_email || "-")}</div>
                      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>{entry.snippet || "Önizleme yok"}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
                        <span>{formatMailTimestamp(entry.received_at || entry.sent_at || entry.created_at)}</span>
                        {!entry.is_read && <span style={{ color: "#16a34a", fontWeight: 800 }}>Yeni</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div role="separator" aria-orientation="vertical" onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); mailboxDragStateRef.current = { startX: event.clientX, startWidth: mailListPaneWidth }; }} style={{ cursor: "col-resize", background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)", borderLeft: "1px solid #bfdbfe", borderRight: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 4, height: 54, borderRadius: 999, background: "#60a5fa" }} />
            </div>
            <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr auto", overflow: "hidden" }}>
              <div style={{ padding: "18px 20px 10px", borderBottom: "1px solid #e2e8f0", display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{selectedMessage?.subject || "Mesaj seçin"}</div>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{selectedMessage ? `${selectedMessage.direction === "inbound" ? "Kimden" : "Kime"}: ${selectedMessage.direction === "inbound" ? selectedMessage.from_email || "-" : selectedMessage.to_email || "-"}` : "Sol listeden bir mesaj seçin"}</div>
                  </div>
                  {selectedMessage && <div style={{ fontSize: 12, color: "#64748b" }}>{formatMailTimestamp(selectedMessage.received_at || selectedMessage.sent_at || selectedMessage.created_at)}</div>}
                </div>
                {selectedMessage?.cc_email && <div style={{ color: "#94a3b8", fontSize: 12 }}>CC: {selectedMessage.cc_email}</div>}
              </div>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => handleReply()} disabled={!selectedMessage} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ecfeff", color: "#0f766e", border: "1px solid #a5f3fc" }}><Reply size={15} />Cevapla</button>
                <button onClick={() => handleMessageAction("archive", selectedMessage)} disabled={!selectedMessage} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Archive size={15} />Arşivle</button>
                <button onClick={() => handleMessageAction("spam", selectedMessage)} disabled={!selectedMessage} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74" }}><ShieldAlert size={15} />Spam</button>
                <button onClick={() => handleMessageAction("trash", selectedMessage)} disabled={!selectedMessage} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}><Trash2 size={15} />Çöp Kutusu</button>
              </div>
              <div style={{ padding: 20, overflow: "auto", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>
                {selectedMessage ? (
                  <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>Mesaj İçeriği</div>
                      <div style={{ lineHeight: 1.6, color: "#0f172a", padding: 16, borderRadius: 18, background: "#fff", border: "1px solid #e2e8f0", minHeight: 96 }}>
                        {selectedMessage.body_html ? <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedMessage.body_html, { FORCE_BODY: true }) }} /> : <div style={{ whiteSpace: "pre-wrap" }}>{selectedMessage.body_text || selectedMessage.snippet || "Mesaj gövdesi alınmadı."}</div>}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                      <div style={{ padding: 14, borderRadius: 16, background: "#fff", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 800 }}>Durum</div><div style={{ marginTop: 6, color: "#0f172a", fontWeight: 800 }}>{selectedMessage.status || "received"}</div></div>
                      <div style={{ padding: 14, borderRadius: 16, background: "#fff", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 800 }}>Okunma</div><div style={{ marginTop: 6, color: "#0f172a", fontWeight: 800 }}>{selectedMessage.is_read ? "Okundu" : "Okunmadı"}</div></div>
                      <div style={{ padding: 14, borderRadius: 16, background: "#fff", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 800 }}>Klasör</div><div style={{ marginTop: 6, color: "#0f172a", fontWeight: 800 }}>{getMailFolderLabel(selectedMailFolder)}</div></div>
                      <div style={{ padding: 14, borderRadius: 16, background: "#fff", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 800 }}>CRM İşaretleri</div><div style={{ marginTop: 6, color: "#0f172a", fontWeight: 800 }}>{selectedMessage.is_starred ? "Yıldızlı" : "-"} {selectedMessage.is_important ? "• Önemli" : ""}</div></div>
                    </div>
                    {selectedMessage.attachments_json && JSON.parse(selectedMessage.attachments_json || "[]").length > 0 && (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>Ek Dosyalar</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          {JSON.parse(selectedMessage.attachments_json || "[]").map((attachment: { filename?: string; content_type?: string; size?: number }, index: number) => (
                            <div key={`${attachment.filename || "attachment"}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 14, border: "1px solid #dbe3ee", background: "#fff" }}>
                              <Paperclip size={14} />
                              <div style={{ display: "grid", gap: 2 }}>
                                <strong style={{ fontSize: 12, color: "#0f172a" }}>{attachment.filename || "attachment"}</strong>
                                <span style={{ fontSize: 11, color: "#64748b" }}>{attachment.content_type || "bilinmeyen tip"} • {attachment.size || 0} byte</span>
                              </div>
                              <button onClick={() => void handleAttachmentAction(index, "preview")} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><ExternalLink size={13} />Önizle</button>
                              <button onClick={() => void handleAttachmentAction(index, "download")} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Download size={13} />İndir</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedThreadMessages.length > 0 && (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>Konuşma Zinciri</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {selectedThreadMessages.map((threadMessage) => (
                            <div key={threadMessage.id} role="button" tabIndex={0} onClick={() => setSelectedMessageId(threadMessage.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMessageId(threadMessage.id); } }} style={{ textAlign: "left", padding: 12, borderRadius: 14, border: "1px solid #e2e8f0", background: "#fff", display: "grid", gap: 4, cursor: "pointer" }}>
                              <strong style={{ fontSize: 13, color: "#0f172a" }}>{threadMessage.subject || "Konu yok"}</strong>
                              <span style={{ fontSize: 12, color: "#64748b" }}>{formatMailTimestamp(threadMessage.received_at || threadMessage.sent_at || threadMessage.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>Sol listeden bir mesaj seçin.</div>
                )}
              </div>
              <div style={{ padding: 20, borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Hızlı Cevap / Yeni Mail</div>
                  {mailDraft.to_email && <div style={{ color: "#475569", fontSize: 12 }}>Hazır hedef: {mailDraft.to_email}</div>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
                  <input value={mailDraft.to_email} onChange={(event) => setMailDraft({ ...mailDraft, to_email: event.target.value })} placeholder="Alıcı" style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 12 }} />
                  <input value={mailDraft.cc} onChange={(event) => setMailDraft({ ...mailDraft, cc: event.target.value })} placeholder="CC" style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 12 }} />
                </div>
                <input value={mailDraft.subject} onChange={(event) => setMailDraft({ ...mailDraft, subject: event.target.value })} placeholder="Konu" style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 12 }} />
                <textarea value={mailDraft.body} onChange={(event) => setMailDraft({ ...mailDraft, body: event.target.value })} rows={4} style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 12, resize: "vertical" }} />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={handleSend} disabled={loading || !selectedAccountId}>Gönder</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {attachmentPreview && (
        <div onClick={() => { URL.revokeObjectURL(attachmentPreview.url); setAttachmentPreview(null); }} style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.52)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(1100px, calc(100vw - 48px))", height: "min(82vh, 900px)", background: "#fff", borderRadius: 20, border: "1px solid #dbe3ee", display: "grid", gridTemplateRows: "auto 1fr" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottom: "1px solid #e2e8f0" }}>
              <strong>{attachmentPreview.name}</strong>
              <button onClick={() => { URL.revokeObjectURL(attachmentPreview.url); setAttachmentPreview(null); }}>Kapat</button>
            </div>
            <div style={{ padding: 12, overflow: "auto", background: "#f8fafc" }}>
              {attachmentPreview.textContent !== undefined && attachmentPreview.textContent !== null ? (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", padding: 16, background: "#fff", border: "1px solid #dbe3ee", borderRadius: 16, color: "#0f172a", fontSize: 13, lineHeight: 1.6 }}>{attachmentPreview.textContent}</pre>
              ) : attachmentPreview.contentType.startsWith("image/") ? (
                <img src={attachmentPreview.url} alt={attachmentPreview.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block", margin: "0 auto" }} />
              ) : attachmentPreview.contentType.startsWith("audio/") ? (
                <audio src={attachmentPreview.url} controls style={{ width: "100%" }} />
              ) : attachmentPreview.contentType.startsWith("video/") ? (
                <video src={attachmentPreview.url} controls style={{ width: "100%", maxHeight: "72vh", background: "#000" }} />
              ) : (
                <iframe src={attachmentPreview.url} title={attachmentPreview.name} style={{ width: "100%", height: "100%", minHeight: 560, border: "none", background: "#fff" }} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

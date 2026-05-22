/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import "./DeploymentPanel.css";
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "../../lib/token";
import { refreshRequest } from "../../services/auth.service";

type LogStatus = "info" | "success" | "error" | "warning";

type DeploymentLog = {
  timestamp: string;
  status: LogStatus;
  message: string;
  step?: string;
};

type SystemSetupResponse = {
  success: boolean;
  logs: DeploymentLog[];
  summary: string;
  errors: string[];
};

type HostingConfig = {
  domain: string;
  host_ip: string;
  username: string;
  password?: string;
  ssh_key_path?: string;
  remote_path: string;
  port: number;
  local_db_host?: string;
  local_db_port?: number;
  local_db_name?: string;
  local_db_user?: string;
  local_db_password?: string;
  remote_db_host?: string;
  remote_db_port?: number;
  remote_db_name?: string;
  remote_db_user?: string;
  remote_db_password?: string;
  domain_mode_enabled?: boolean;
};

type DeploymentTarget = "com_tr" | "com" | "info" | "online";

const DEPLOYMENT_TARGETS: Array<{
  key: DeploymentTarget;
  label: string;
  domain: string;
  remotePath: string;
}> = [
  {
    key: "com_tr",
    label: "buyerasistans.com.tr (TR Ana Domain)",
    domain: "buyerasistans.com.tr",
    remotePath: "/var/www/vhosts/buyerasistans.com.tr/httpdocs",
  },
  {
    key: "com",
    label: "buyerasistans.com (Global Domain)",
    domain: "buyerasistans.com",
    remotePath: "/var/www/vhosts/buyerasistans.com/httpdocs",
  },
  {
    key: "info",
    label: "buyerasistans.info (Knowledge)",
    domain: "buyerasistans.info",
    remotePath: "/var/www/vhosts/buyerasistans.info/httpdocs",
  },
  {
    key: "online",
    label: "buyerasistans.online (Campaign)",
    domain: "buyerasistans.online",
    remotePath: "/var/www/vhosts/buyerasistans.online/httpdocs",
  },
];

type ApiErrorPayload = {
  detail?: string;
  message?: string;
  summary?: string;
};

type OperationType =
  | "setup"
  | "refresh-zip"
  | "deploy"
  | "reload"
  | "smart-reload"
  | "db-sync"
  | "db-migrate"
  | "clear"
  | null;

type OperationAction = Exclude<OperationType, null>;

type OperationCard = {
  op: OperationAction;
  label: string;
  description: string;
  icon: string;
};

const STEP_LABELS: Record<string, string> = {
  system: "🖥️ Sistem",
  packages: "📦 Paketler",
  database: "🗄️ Veritabanı",
  health: "🩺 Sağlık",
  connect: "🔌 Bağlantı",
  backup: "💾 Yedek",
  prepare: "📁 Hazırlık",
  clear: "🗑️ Temizlik",
  upload: "⬆️ Yükleme",
  "host-setup": "⚙️ Sunucu Kurulum",
  frontend: "🌐 Frontend",
  systemd: "🔧 Systemd & Guard",
  services: "🚀 Servisler",
  deploy: "🚢 Deploy",
  reload: "🔄 Yenileme",
  "smart-reload": "⚡ Hızlı Yenileme",
  "db-sync": "🗄️ Local → Hosting",
  "db-migrate": "🗄️ DB Migrasyon",
};

const STATUS_COLORS: Record<LogStatus, string> = {
  info: "text-slate-500",
  success: "text-emerald-500",
  error: "text-rose-500",
  warning: "text-amber-500",
};

const STATUS_BG: Record<LogStatus, string> = {
  info: "bg-slate-100 border border-slate-200",
  success: "bg-emerald-50 border border-emerald-200",
  error: "bg-rose-50 border border-rose-200",
  warning: "bg-amber-50 border border-amber-200",
};

const STATUS_ICONS: Record<LogStatus, string> = {
  info: "·",
  success: "✓",
  error: "✗",
  warning: "⚠",
};

const OPERATION_LABELS: Record<string, string> = {
  setup: "İlk Kurulum",
  "refresh-zip": "ZIP Yenile",
  clear: "Dosyaları Sil",
  deploy: "Hostinge Gönder",
  reload: "Siteyi Yenile",
  "smart-reload": "Siteyi Yenile (Hızlı)",
  "db-sync": "Yerel DB → Hosting",
  "db-migrate": "DB Migrasyonu",
};

function normalizeDeploymentApiBaseUrl(rawValue: string | undefined): string {
  const trimmed = String(rawValue || "").trim().replace(/\/+$/, "");
  if (trimmed) {
    return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  }
  return "/api/v1";
}

const OPERATION_CARDS: OperationCard[] = [
  {
    op: "setup",
    label: "İlk Kurulum",
    description: "Bağımlılıkları kontrol eder.",
    icon: "⚙️",
  },
  {
    op: "refresh-zip",
    label: "ZIP Yenile",
    description: "Deploy paketini günceller.",
    icon: "🗜️",
  },
  {
    op: "clear",
    label: "Dosyaları Sil",
    description: "Temiz başlangıç yapar.",
    icon: "🗑️",
  },
  {
    op: "deploy",
    label: "Hostinge Gönder",
    description: "Projeyi hostinge kopyalar.",
    icon: "📤",
  },
  {
    op: "reload",
    label: "Siteyi Yenile",
    description: "Uzak servisi yeniden başlatır.",
    icon: "🔄",
  },
  {
    op: "smart-reload",
    label: "Hızlı Yenile",
    description: "Sadece hızlı yenileme.",
    icon: "⚡",
  },
  {
    op: "db-sync",
    label: "Yerel DB → Hosting",
    description: "Yerel veritabanını gönderir.",
    icon: "🗄️",
  },
  {
    op: "db-migrate",
    label: "DB Migrasyonu",
    description: "Uzak DB şemasını günceller.",
    icon: "🧩",
  },
];

const SETUP_STEPS = ["system", "packages", "database", "health"];
const REFRESH_ZIP_STEPS = ["prepare"];
const DEPLOY_STEPS = [
  "connect",
  "backup",
  "prepare",
  "upload",
  "host-setup",
  "frontend",
  "systemd",
  "services",
];
const RELOAD_STEPS = ["connect", "reload"];
const SMART_RELOAD_STEPS = ["connect", "reload"];
const DB_SYNC_STEPS = ["connect", "db-sync"];
const DB_MIGRATE_STEPS = ["connect", "db-migrate"];
const CLEAR_STEPS = ["connect", "clear"];

const SUMMARY_ITEMS: Array<{
  label: string;
  key:
    | "setupResult"
    | "refreshZipResult"
    | "clearResult"
    | "deployResult"
    | "reloadResult"
    | "smartReloadResult"
    | "dbSyncResult"
    | "dbMigrResult";
}> = [
  { label: "İlk Kurulum", key: "setupResult" },
  { label: "ZIP Yenile", key: "refreshZipResult" },
  { label: "Dosyaları Sil", key: "clearResult" },
  { label: "Deploy", key: "deployResult" },
  { label: "Site Yenileme", key: "reloadResult" },
  { label: "Hızlı Yenileme", key: "smartReloadResult" },
  { label: "DB Eşitleme", key: "dbSyncResult" },
  { label: "DB Migrasyonu", key: "dbMigrResult" },
];

function getStepList(op: OperationType): string[] {
  if (op === "setup") return SETUP_STEPS;
  if (op === "refresh-zip") return REFRESH_ZIP_STEPS;
  if (op === "deploy") return DEPLOY_STEPS;
  if (op === "reload") return RELOAD_STEPS;
  if (op === "smart-reload") return SMART_RELOAD_STEPS;
  if (op === "db-sync") return DB_SYNC_STEPS;
  if (op === "db-migrate") return DB_MIGRATE_STEPS;
  if (op === "clear") return CLEAR_STEPS;
  return [];
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const payload = data as ApiErrorPayload;
    return payload.detail || payload.message || payload.summary || fallback;
  }
  return fallback;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso.slice(11, 19);
  }
}

async function resolveAdminAccessToken(): Promise<string | null> {
  const current = getAccessToken();
  if (current) return current;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const refreshed = await refreshRequest(refreshToken);
    setAccessToken(refreshed.accessToken);
    setRefreshToken(refreshed.refreshToken);
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

const PROGRESS_WIDTH_CLASSES: Record<number, string> = {
  0: "w-0",
  5: "w-[5%]",
  10: "w-[10%]",
  15: "w-[15%]",
  20: "w-[20%]",
  25: "w-[25%]",
  30: "w-[30%]",
  35: "w-[35%]",
  40: "w-[40%]",
  45: "w-[45%]",
  50: "w-[50%]",
  55: "w-[55%]",
  60: "w-[60%]",
  65: "w-[65%]",
  70: "w-[70%]",
  75: "w-[75%]",
  80: "w-[80%]",
  85: "w-[85%]",
  90: "w-[90%]",
  95: "w-[95%]",
  100: "w-full",
};

function getProgressWidthClass(progress: number) {
  const bucket = Math.max(0, Math.min(100, Math.round(progress / 5) * 5));
  return PROGRESS_WIDTH_CLASSES[bucket] ?? "w-0";
}

// ─── YARDIMCI BİLEŞENLER ──────────────────────────────────────────────────────

function ElapsedTimer({ isRunning }: { isRunning: boolean }) {
  const startRef = useRef<number>(0);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isRunning) return;
    startRef.current = Date.now();

    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      if (labelRef.current) {
        labelRef.current.textContent = `İşlem sürüyor... ${
          m > 0 ? `${m}d ${s}s` : `${s}s`
        }`;
      }
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning]);

  if (!isRunning) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700">
      <span className="inline-block h-2 w-2 animate-ping rounded-full bg-sky-500" />
      <span ref={labelRef}>İşlem sürüyor... 0s</span>
    </div>
  );
}

function ActivityPulse({
  isRunning,
  lastMessage,
}: {
  isRunning: boolean;
  lastMessage: string;
}) {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);
    return () => clearInterval(id);
  }, [isRunning]);

  if (!isRunning) return null;

  const shortMsg =
    lastMessage.length > 70 ? lastMessage.slice(0, 70) + "…" : lastMessage;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500 shrink-0" />
      <div className="flex flex-col">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Aktif İşlem{dots}
        </span>
        <span className="text-sm font-medium text-slate-700">
          {shortMsg || "Sunucu yanıtı bekleniyor..."}
        </span>
      </div>
    </div>
  );
}

function LogLine({ log }: { log: DeploymentLog }) {
  const messageText = typeof log.message === "string" ? log.message : "";
  const isSeparator =
    messageText.startsWith("═") || messageText.startsWith("─");
  
  if (isSeparator) {
    return <div className="my-2 border-t border-slate-200" />;
  }

  return (
    <div
      className={`flex flex-col gap-1 rounded-xl p-3 mb-2 shadow-sm ${
        STATUS_BG[log.status]
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-white ${
            STATUS_COLORS[log.status]
          }`}
        >
          {STATUS_ICONS[log.status]}
        </span>
        <span className="text-xs font-medium text-slate-500">
          {formatTime(log.timestamp)}
        </span>
        {log.step && (
          <span className="rounded-md bg-white/60 px-2 py-0.5 text-xs font-bold text-slate-600 shadow-sm">
            {STEP_LABELS[log.step] || log.step}
          </span>
        )}
      </div>
      <div
        className={`ml-7 whitespace-pre-wrap break-words text-sm font-mono leading-relaxed ${
          STATUS_COLORS[log.status]
        }`}
      >
        {messageText}
      </div>
    </div>
  );
}

function ProgressBar({
  operation,
  completedSteps,
  isRunning,
}: {
  operation: OperationType;
  completedSteps: Set<string>;
  isRunning: boolean;
}) {
  const steps = getStepList(operation);
  if (!steps.length || !operation) return null;

  const doneCount = steps.filter((s) => completedSteps.has(s)).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="space-y-3 w-full bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between text-sm font-bold text-slate-700">
        <span>
          {isRunning ? (
            <span className="flex items-center gap-2 text-sky-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500" />
              {OPERATION_LABELS[operation]} yürütülüyor...
            </span>
          ) : doneCount === steps.length ? (
            <span className="text-emerald-600">✓ İşlem Tamamlandı</span>
          ) : (
            <span>İşlem Bekliyor</span>
          )}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
          {pct}%
        </span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 inset-shadow-sm">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isRunning ? "bg-sky-500" : "bg-emerald-500"
          } ${getProgressWidthClass(
            isRunning && pct === 0 ? 5 : Math.max(pct, isRunning ? 5 : 0),
          )}`}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {steps.map((step) => {
          const done = completedSteps.has(step);
          const active = isRunning && !done;
          return (
            <span
              key={step}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors shadow-sm ${
                done
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : active
                  ? "bg-sky-100 text-sky-700 border border-sky-200 animate-pulse"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {done ? "✓ " : ""}
              {STEP_LABELS[step] || step}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  result,
}: {
  label: string;
  result: SystemSetupResponse | null;
}) {
  if (!result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          {label}
        </div>
        <div className="text-sm font-medium text-slate-400 italic flex items-center gap-2">
          <span>⏳</span> Çalıştırılmadı
        </div>
      </div>
    );
  }

  const isSuccess = result.success;
  const summaryText = typeof result.summary === "string" ? result.summary : "";
  const errors = Array.isArray(result.errors) ? result.errors : [];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 shadow-sm transition-all ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50"
          : "border-rose-200 bg-rose-50"
      }`}
    >
      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div
        className={`text-sm font-bold flex items-center gap-2 ${
          isSuccess ? "text-emerald-700" : "text-rose-700"
        }`}
      >
        <span>{isSuccess ? "✅" : "❌"}</span>
        <span>{summaryText.split("\n")[0] || "Durum bilgisi yok"}</span>
      </div>
      {errors.length > 0 && (
        <ul className="mt-3 space-y-1">
          {errors.slice(0, 3).map((error, i) => (
            <li
              key={i}
              className="rounded-md bg-white/80 px-2 py-1 text-xs font-medium text-rose-600 border border-rose-100"
            >
              • {String(error ?? "").slice(0, 100)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── SÜPER ADMİN STİLİ YENİ BUTON ──
function OperationButton({
  card,
  isRunning,
  activeOp,
  onClick,
}: {
  card: OperationCard;
  isRunning: boolean;
  activeOp: OperationType;
  onClick: (op: OperationAction) => void;
}) {
  const isActive = activeOp === card.op;
  const isDone = !isRunning && activeOp === card.op;
  const isDisabled = isRunning && !isActive;

  return (
    <button
      type="button"
      onClick={() => onClick(card.op)}
      disabled={isDisabled}
      className={`
        flex w-full items-center justify-between gap-4 rounded-full border px-6 py-4 shadow-sm transition-all duration-200
        disabled:cursor-not-allowed disabled:opacity-50
        ${
          isActive
            ? "border-sky-400 bg-sky-50 ring-2 ring-sky-100 shadow-md"
            : isDone
            ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
        }
      `}
    >
      <div className="flex items-center gap-4">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl shadow-inner border ${
            isActive
              ? "bg-white border-sky-200"
              : isDone
              ? "bg-white border-emerald-200"
              : "bg-slate-100 border-slate-200"
          }`}
        >
          {isActive ? <span className="animate-spin block">⚙️</span> : card.icon}
        </span>
        <span
          className={`text-base font-bold tracking-wide ${
            isActive
              ? "text-sky-800"
              : isDone
              ? "text-emerald-800"
              : "text-slate-700"
          }`}
        >
          {card.label}
        </span>
      </div>

      <div className="flex items-center">
        {isActive && (
          <span className="flex h-3 w-3 animate-ping rounded-full bg-sky-500" />
        )}
        {isDone && (
          <span className="text-xl font-black text-emerald-500">✓</span>
        )}
      </div>
    </button>
  );
}

function ConfigField({
  label,
  type,
  placeholder,
  value,
  onChange,
  className = "",
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col space-y-1.5 ${className}`}>
      <label className="text-xs font-bold text-slate-600 pl-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />
    </div>
  );
}

// ─── ANA BİLEŞEN ──────────────────────────────────────────────────────────────

export function DeploymentPanel() {
  const [deploymentTarget, setDeploymentTarget] = useState<DeploymentTarget>("com_tr");
  const [selectedTargets, setSelectedTargets] = useState<DeploymentTarget[]>(["com_tr"]);
  const [hostingConfig, setHostingConfig] = useState<HostingConfig>({
    domain: "buyerasistans.com.tr",
    host_ip: "213.238.191.177",
    username: "root",
    password: "",
    ssh_key_path: "/home/user/.ssh/id_rsa",
    remote_path: "/var/www/vhosts/buyerasistans.com.tr/httpdocs",
    port: 22,
    local_db_host: "",
    local_db_port: undefined,
    local_db_name: "",
    local_db_user: "",
    local_db_password: "",
    remote_db_host: "",
    remote_db_port: undefined,
    remote_db_name: "",
    remote_db_user: "",
    remote_db_password: "",
    domain_mode_enabled: false,
  });

  const [setupResult, setSetupResult] = useState<SystemSetupResponse | null>(null);
  const [refreshZipResult, setRefreshZipResult] = useState<SystemSetupResponse | null>(null);
  const [clearResult, setClearResult] = useState<SystemSetupResponse | null>(null);
  const [deployResult, setDeployResult] = useState<SystemSetupResponse | null>(null);
  const [reloadResult, setReloadResult] = useState<SystemSetupResponse | null>(null);
  const [smartReloadResult, setSmartReloadResult] = useState<SystemSetupResponse | null>(null);
  const [dbSyncResult, setDbSyncResult] = useState<SystemSetupResponse | null>(null);
  const [dbMigrResult, setDbMigrResult] = useState<SystemSetupResponse | null>(null);

  const [activeOp, setActiveOp] = useState<OperationType>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [streamLogs, setStreamLogs] = useState<DeploymentLog[]>([]);

  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  const methodErrorCountRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apiUrl = normalizeDeploymentApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
  );

  // Otomatik scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamLogs]);

  // Config yükle
  const fetchHostingConfig = useCallback(async () => {
    setLoadingConfig(true);
    setConfigError(null);
    try {
      const token = await resolveAdminAccessToken();
      if (!token) {
        setConfigError("Oturum yenilenemedi. Lütfen tekrar giriş yapın.");
        return;
      }

      const res = await fetch(`${apiUrl}/admin/deployment/hosting-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as Partial<HostingConfig>;
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, res.statusText));
      }

      const stripQ = (v: unknown, fallback: string): string => {
        if (typeof v !== "string") return fallback;
        return v.trim().replace(/^['"]|['"]$/g, "");
      };

      setHostingConfig((prev) => ({
        ...prev,
        domain: stripQ(data.domain, prev.domain),
        host_ip: stripQ(data.host_ip, prev.host_ip),
        username: stripQ(data.username, prev.username),
        password: stripQ(data.password, prev.password ?? ""),
        ssh_key_path: stripQ(data.ssh_key_path, prev.ssh_key_path ?? ""),
        remote_path: stripQ(data.remote_path, prev.remote_path),
        port:
          typeof data.port === "number" && Number.isFinite(data.port)
            ? data.port
            : prev.port,

        local_db_host: stripQ(
          (data as any).local_db_host,
          prev.local_db_host ?? ""
        ),
        local_db_name: stripQ(
          (data as any).local_db_name,
          prev.local_db_name ?? ""
        ),
        local_db_user: stripQ(
          (data as any).local_db_user,
          prev.local_db_user ?? ""
        ),
        local_db_password: stripQ(
          (data as any).local_db_password,
          prev.local_db_password ?? ""
        ),
        local_db_port:
          typeof (data as any).local_db_port === "number" &&
          Number.isFinite((data as any).local_db_port)
            ? (data as any).local_db_port
            : prev.local_db_port,

        remote_db_host: stripQ(
          (data as any).remote_db_host,
          prev.remote_db_host ?? ""
        ),
        remote_db_name: stripQ(
          (data as any).remote_db_name,
          prev.remote_db_name ?? ""
        ),
        remote_db_user: stripQ(
          (data as any).remote_db_user,
          prev.remote_db_user ?? ""
        ),
        remote_db_password: stripQ(
          (data as any).remote_db_password,
          prev.remote_db_password ?? ""
        ),
        remote_db_port:
          typeof (data as any).remote_db_port === "number" &&
          Number.isFinite((data as any).remote_db_port)
            ? (data as any).remote_db_port
            : prev.remote_db_port,
        domain_mode_enabled:
          typeof (data as any).domain_mode_enabled === "boolean"
            ? Boolean((data as any).domain_mode_enabled)
            : prev.domain_mode_enabled ?? false,
      }));
    } catch (err) {
      setConfigError(
        err instanceof Error ? err.message : "Config yükleme hatası."
      );
    } finally {
      setLoadingConfig(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchHostingConfig();
  }, [fetchHostingConfig]);

  // State temizle
  const handleClearDeploymentState = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    setStreamLogs([]);
    setCompletedSteps(new Set());
    setActiveOp(null);
    setConfigError(null);
    setSaveResult(null);
    methodErrorCountRef.current = 0;
  }, []);

  // ── Ana operasyon çalıştırıcı ─────────────────────────────────────────────
  const runOperation = useCallback(
    async (op: OperationType) => {
      if (!op || isRunning) return;
      const needsHostingConfig = op !== "setup" && op !== "refresh-zip";
      if (needsHostingConfig && selectedTargets.length === 0) {
        setStreamLogs((prev) => [...prev, { timestamp: new Date().toISOString(), status: "error", message: "En az bir hedef domain secin.", step: "prepare" }]);
        return;
      }
      if (op === "db-sync") {
        const ok = window.confirm("Yerel veritabanı hostinge gönderilecek. Bu işlem local veriyi silmez; hosting verisini üzerine yazar. Devam edilsin mi?");
        if (!ok) return;
      }
      const token = await resolveAdminAccessToken();
      if (!token) {
        setStreamLogs((prev) => [...prev, { timestamp: new Date().toISOString(), status: "error", message: "Oturum yenilenemedi. Lütfen tekrar giriş yapın.", step: "connect" }]);
        return;
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setActiveOp(op);
      setIsRunning(true);
      setStreamLogs([]);
      setCompletedSteps(new Set());

      const endpointMap: Record<string, string> = {
        setup: `${apiUrl}/admin/deployment/setup`,
        "refresh-zip": `${apiUrl}/admin/deployment/refresh-zip`,
        clear: `${apiUrl}/admin/deployment/clear-remote-files`,
        deploy: `${apiUrl}/admin/deployment/deploy`,
        reload: `${apiUrl}/admin/deployment/reload`,
        "smart-reload": `${apiUrl}/admin/deployment/smart-reload`,
        "db-sync": `${apiUrl}/admin/deployment/push-local-db`,
        "db-migrate": `${apiUrl}/admin/deployment/db-migration`,
      };
      const url = endpointMap[op];
      const isSSE = needsHostingConfig;
      const targetsToRun = needsHostingConfig ? selectedTargets : [deploymentTarget];
      let allSuccess = true;

      try {
        for (const targetKey of targetsToRun) {
          const targetDef = DEPLOYMENT_TARGETS.find((item) => item.key === targetKey);
          if ((op === "db-sync" || op === "db-migrate") && targetKey !== "com_tr") {
            setStreamLogs((prev) => [
              ...prev,
              {
                timestamp: new Date().toISOString(),
                status: "warning",
                message: `${targetDef?.domain || targetKey}: DB islemleri yalnizca .com.tr ana omurgada calistirilir, bu hedef atlandi.`,
                step: "database",
              },
            ]);
            continue;
          }
          const targetConfig = needsHostingConfig && targetDef
            ? { ...hostingConfig, domain: targetDef.domain, remote_path: targetDef.remotePath, domain_mode_enabled: op === "deploy" ? true : Boolean(hostingConfig.domain_mode_enabled) }
            : hostingConfig;
          setStreamLogs((prev) => [...prev, { timestamp: new Date().toISOString(), status: "info", message: `Hedef: ${targetDef?.domain || "genel"} | ${OPERATION_LABELS[op] || op} başlatılıyor...`, step: "prepare" }]);
          const res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(needsHostingConfig ? targetConfig : {}),
            signal: abortRef.current.signal,
          });
          if (!res.ok) {
            allSuccess = false;
            const errText = await res.text();
            setStreamLogs((prev) => [...prev, { timestamp: new Date().toISOString(), status: "error", message: `${targetDef?.domain || "genel"}: ${errText || res.statusText}`, step: "system" }]);
            continue;
          }

          if (isSSE) {
            const reader = res.body?.getReader();
            if (!reader) continue;
            const decoder = new TextDecoder();
            let buffer = "";
            let targetSuccess = true;
            let done = false;
            while (!done) {
              const { done: streamDone, value } = await reader.read();
              if (streamDone) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const raw = line.slice(6).trim();
                if (!raw) continue;
                let parsed: Record<string, unknown>;
                try { parsed = JSON.parse(raw); } catch { continue; }
                if (parsed.type === "log") {
                  const log = parsed as unknown as DeploymentLog;
                  setStreamLogs((prev) => [...prev, log]);
                  if (log.status === "success" && log.step) setCompletedSteps((prev) => new Set([...prev, log.step as string]));
                } else if (parsed.type === "done") {
                  targetSuccess = Boolean(parsed.success);
                  if (!targetSuccess) allSuccess = false;
                  done = true;
                  break;
                } else if (parsed.type === "error") {
                  targetSuccess = false;
                  allSuccess = false;
                  setStreamLogs((prev) => [...prev, { timestamp: new Date().toISOString(), status: "error", message: String(parsed.message ?? "Bilinmeyen hata"), step: "system" }]);
                  done = true;
                  break;
                }
              }
            }
            setStreamLogs((prev) => [...prev, { timestamp: new Date().toISOString(), status: targetSuccess ? "success" : "error", message: `${targetDef?.domain || "genel"}: ${targetSuccess ? "tamamlandi" : "hata ile tamamlandi"}`, step: "system" }]);
          } else {
            const result = (await res.json()) as SystemSetupResponse;
            if (!result.success) allSuccess = false;
            for (const log of result.logs ?? []) {
              setStreamLogs((prev) => [...prev, log]);
              if (log.status === "success" && log.step) setCompletedSteps((prev) => new Set([...prev, log.step as string]));
            }
            if (op === "setup") setSetupResult(result);
            if (op === "refresh-zip") setRefreshZipResult(result);
          }
        }

        const summary: SystemSetupResponse = { success: allSuccess, logs: [], errors: allSuccess ? [] : ["Bir veya daha fazla hedefte hata var."], summary: allSuccess ? "Tüm seçili hedeflerde işlem tamamlandı." : "Bazı hedeflerde hata oluştu." };
        if (op === "clear") setClearResult(summary);
        if (op === "deploy") setDeployResult(summary);
        if (op === "reload") setReloadResult(summary);
        if (op === "smart-reload") setSmartReloadResult(summary);
        if (op === "db-sync") setDbSyncResult(summary);
        if (op === "db-migrate") setDbMigrResult(summary);
        if (allSuccess) setCompletedSteps(new Set(getStepList(op)));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
          setStreamLogs((prev) => [...prev, { timestamp: new Date().toISOString(), status: "error", message: `Bağlantı hatası: ${msg}`, step: "system" }]);
        }
      } finally {
        setIsRunning(false);
      }
    },
    [apiUrl, deploymentTarget, hostingConfig, isRunning, selectedTargets]
  );

  const handleApplyDeploymentTarget = (targetKey: DeploymentTarget) => {
    setDeploymentTarget(targetKey);
    const target = DEPLOYMENT_TARGETS.find((item) => item.key === targetKey);
    if (!target) return;
    setHostingConfig((prev) => ({
      ...prev,
      domain: target.domain,
      remote_path: target.remotePath,
    }));
    setStreamLogs((prev) => [
      ...prev,
      {
        timestamp: new Date().toISOString(),
        status: "info",
        message: `Deployment hedefi secildi: ${target.domain}`,
        step: "prepare",
      },
    ]);
  };

  const handleToggleDeploymentTarget = (targetKey: DeploymentTarget) => {
    setSelectedTargets((prev) => {
      const hasTarget = prev.includes(targetKey);
      return hasTarget ? prev.filter((item) => item !== targetKey) : [...prev, targetKey];
    });
  };

  useEffect(() => {
    if (selectedTargets.length > 0 && selectedTargets[0] !== deploymentTarget) {
      handleApplyDeploymentTarget(selectedTargets[0]);
    }
  }, [deploymentTarget, selectedTargets]);

  // Config kaydet
  const handleSaveConfig = async () => {
    setSaveResult(null);
    setConfigError(null);
    try {
      const token = await resolveAdminAccessToken();
      if (!token) {
        throw new Error("Oturum yenilenemedi. Lütfen tekrar giriş yapın.");
      }

      const res = await fetch(`${apiUrl}/admin/deployment/hosting-config`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(hostingConfig),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, res.statusText));
      }
      setHostingConfig((prev) => ({ ...prev, ...data }));
      setSaveResult("Ayarlar .env dosyasına başarıyla kaydedildi.");
    } catch (err) {
      setConfigError(
        err instanceof Error ? err.message : "Kaydetme sırasında bir hata oluştu"
      );
    }
  };

  // Bağlantı testi
  const handleValidateConfig = async () => {
    setStreamLogs((prev) => [
      ...prev,
      {
        timestamp: new Date().toISOString(),
        status: "info",
        message: "Hosting konfigürasyonu doğrulanıyor...",
        step: "connect",
      },
    ]);
    try {
      const token = await resolveAdminAccessToken();
      if (!token) {
        throw new Error("Oturum yenilenemedi. Lütfen tekrar giriş yapın.");
      }

      const res = await fetch(
        `${apiUrl}/admin/deployment/validate-hosting-config`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(hostingConfig),
        }
      );
      const rawText = await res.text();
      let payload: unknown = {};
      try {
        payload = rawText ? JSON.parse(rawText) : {};
      } catch {
        payload = { detail: rawText || res.statusText };
      }

      const isValid =
        res.ok &&
        typeof payload === "object" &&
        payload !== null &&
        "valid" in payload
          ? Boolean((payload as { valid?: boolean }).valid)
          : res.ok;

      const msg = isValid
        ? `✅ Konfigürasyon geçerli. Domain: ${hostingConfig.domain} | IP: ${hostingConfig.host_ip} | Port: ${hostingConfig.port}`
        : extractErrorMessage(payload, res.statusText);

      setStreamLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          status: isValid ? "success" : "error",
          message: msg,
          step: "connect",
        },
      ]);
    } catch (err) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? extractErrorMessage(
              (err as { response?: { data?: unknown } }).response?.data,
              "Doğrulama hatası"
            )
          : err instanceof Error
          ? err.message
          : "Bilinmeyen hata";
      setStreamLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          status: "error",
          message: `Doğrulama hatası: ${msg}`,
          step: "connect",
        },
      ]);
    }
  };

  const summaryState = {
    setupResult,
    refreshZipResult,
    clearResult,
    deployResult,
    reloadResult,
    smartReloadResult,
    dbSyncResult,
    dbMigrResult,
  } as const;

  const lastLogMessage =
    streamLogs.length > 0 ? streamLogs[streamLogs.length - 1].message : "";

  return (
    <div className="w-full min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-left">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Üst Başlık (Hero) */}
        <div className="bg-slate-900 rounded-[32px] p-8 md:p-10 text-white shadow-xl bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
            </span>
            <span className="text-sky-400 font-bold uppercase tracking-widest text-xs">
              Sistem Yönetimi
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black mb-4">
            🚀 Deployment Control Center
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
            Projenin yerel geliştirme ortamından sunucuya aktarılması, veri tabanı eşitlemeleri ve siber operasyonları bu ekrandan yönetilir.
          </p>
        </div>

        {/* ── İKİLİ IZGARA DÜZENİ ── */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* SOL KOLON: Operasyon Butonları */}
          <div className="w-full lg:w-1/3 xl:w-1/4 flex-shrink-0">
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-200">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <span className="text-2xl">⚙️</span> Modüller
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Sıralı veya bağımsız çalıştırın.
                </p>
              </div>

              {/* BUTON LİSTESİ */}
              <div className="flex flex-col gap-4">
                {OPERATION_CARDS.map((card) => (
                  <OperationButton
                    key={card.op}
                    card={card}
                    isRunning={isRunning}
                    activeOp={activeOp}
                    onClick={runOperation}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* SAĞ KOLON: Sistem Konfigürasyonu (Form Kutucukları) */}
          <div className="w-full lg:w-2/3 xl:w-3/4">
            <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-200">
              
              <div className="mb-8 flex flex-col gap-2 border-b border-slate-100 pb-5">
                <h2 className="text-2xl font-black text-slate-800">
                  🔧 Sistem Konfigürasyonu
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  Aşağıdaki veriler sunucu bağlantısını sağlar ve <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">api/.env</span> dosyasından okunur.
                </p>
              </div>

              {/* Sunucu Ayarları */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-base font-black text-sky-600 flex items-center gap-3 mb-5">
                    <span className="bg-sky-100 p-2 rounded-xl text-xl">🌐</span>{" "}
                    Sunucu Ayarları
                  </h3>
                  <div className="mb-5">
                    <label className="text-xs font-bold text-slate-600 pl-1">Deployment Hedef Domainleri</label>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {DEPLOYMENT_TARGETS.map((target) => {
                        const checked = selectedTargets.includes(target.key);
                        return (
                          <label key={target.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${checked ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-700"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleDeploymentTarget(target.key)}
                            />
                            <span>{target.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Isaretli domainlerde buton islemleri sira ile calisir. Alanlar birincil secili domaine gore otomatik doldurulur.
                    </div>
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                      Domain Mode: localde pasif tutulur, <span className="font-black">Hostinge Gonder</span> adiminda otomatik aktif edilir.
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ConfigField
                      label="Domain"
                      type="text"
                      placeholder="buyerasistans.com.tr"
                      value={hostingConfig.domain}
                      onChange={(v) =>
                        setHostingConfig((p) => ({ ...p, domain: v }))
                      }
                    />
                    <ConfigField
                      label="IP Adresi"
                      type="text"
                      placeholder="213.238.191.177"
                      value={hostingConfig.host_ip}
                      onChange={(v) =>
                        setHostingConfig((p) => ({ ...p, host_ip: v }))
                      }
                    />
                    <ConfigField
                      label="SSH Kullanıcı"
                      type="text"
                      placeholder="root"
                      value={hostingConfig.username}
                      onChange={(v) =>
                        setHostingConfig((p) => ({ ...p, username: v }))
                      }
                    />
                    <ConfigField
                      label="SSH Şifresi"
                      type="password"
                      placeholder="••••••••"
                      value={hostingConfig.password || ""}
                      onChange={(v) =>
                        setHostingConfig((p) => ({ ...p, password: v }))
                      }
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <ConfigField
                        label="SSH Port"
                        type="number"
                        placeholder="22"
                        value={hostingConfig.port}
                        onChange={(v) =>
                          setHostingConfig((p) => ({
                            ...p,
                            port: Number(v) || 22,
                          }))
                        }
                      />
                      <ConfigField
                        label="SSH Key Yolu"
                        type="text"
                        placeholder="/home/user/.ssh/id_rsa"
                        value={hostingConfig.ssh_key_path || ""}
                        onChange={(v) =>
                          setHostingConfig((p) => ({
                            ...p,
                            ssh_key_path: v,
                          }))
                        }
                      />
                    </div>
                    <ConfigField
                      label="Remote Path (Hedef Klasör)"
                      type="text"
                      placeholder="/var/www/vhosts/.../httpdocs"
                      value={hostingConfig.remote_path}
                      onChange={(v) =>
                        setHostingConfig((p) => ({ ...p, remote_path: v }))
                      }
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 my-8"></div>

                {/* Veritabanı Ayarları (Yan Yana) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Local DB */}
                  <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200 space-y-5">
                    <h3 className="text-base font-black text-emerald-600 flex items-center gap-3">
                      <span className="bg-emerald-100 p-2 rounded-xl text-xl">🗄️</span>{" "}
                      Yerel DB (Opsiyonel)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <ConfigField
                        label="Host"
                        type="text"
                        placeholder="localhost"
                        value={hostingConfig.local_db_host ?? ""}
                        onChange={(v) =>
                          setHostingConfig((p) => ({
                            ...p,
                            local_db_host: v,
                          }))
                        }
                      />
                      <ConfigField
                        label="Port"
                        type="number"
                        placeholder="5432"
                        value={hostingConfig.local_db_port ?? ""}
                        onChange={(v) =>
                          setHostingConfig((p) => ({
                            ...p,
                            local_db_port: v ? Number(v) || undefined : undefined,
                          }))
                        }
                      />
                    </div>
                    <ConfigField
                      label="DB Adı"
                      type="text"
                      placeholder="procureflow"
                      value={hostingConfig.local_db_name ?? ""}
                      onChange={(v) =>
                        setHostingConfig((p) => ({ ...p, local_db_name: v }))
                      }
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <ConfigField
                        label="Kullanıcı"
                        type="text"
                        placeholder="postgres"
                        value={hostingConfig.local_db_user ?? ""}
                        onChange={(v) =>
                          setHostingConfig((p) => ({
                            ...p,
                            local_db_user: v,
                          }))
                        }
                      />
                      <ConfigField
                        label="Şifre"
                        type="password"
                        placeholder="••••••••"
                        value={hostingConfig.local_db_password ?? ""}
                        onChange={(v) =>
                          setHostingConfig((p) => ({
                            ...p,
                            local_db_password: v,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Remote DB */}
                  <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200 space-y-5">
                    <h3 className="text-base font-black text-violet-600 flex items-center gap-3">
                      <span className="bg-violet-100 p-2 rounded-xl text-xl">☁️</span>{" "}
                      Uzak DB (Hosting)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <ConfigField
                        label="Host"
                        type="text"
                        placeholder="localhost"
                        value={hostingConfig.remote_db_host ?? ""}
                        onChange={(v) =>
                          setHostingConfig((p) => ({
                            ...p,
                            remote_db_host: v,
                          }))
                        }
                      />
                      <ConfigField
                        label="Port"
                        type="number"
                        placeholder="5432"
                        value={hostingConfig.remote_db_port ?? ""}
                        onChange={(v) =>
                          setHostingConfig((p) => ({
                            ...p,
                            remote_db_port: v ? Number(v) || undefined : undefined,
                          }))
                        }
                      />
                    </div>
                    <ConfigField
                      label="DB Adı"
                      type="text"
                      placeholder="admin_procureflow"
                      value={hostingConfig.remote_db_name ?? ""}
                      onChange={(v) =>
                        setHostingConfig((p) => ({
                          ...p,
                          remote_db_name: v,
                        }))
                      }
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <ConfigField
                        label="Kullanıcı"
                        type="text"
                        placeholder="buyerasistans"
                        value={hostingConfig.remote_db_user ?? ""}
                        onChange={(v) =>
                          setHostingConfig((p) => ({
                            ...p,
                            remote_db_user: v,
                          }))
                        }
                      />
                      <ConfigField
                        label="Şifre"
                        type="password"
                        placeholder="••••••••"
                        value={hostingConfig.remote_db_password ?? ""}
                        onChange={(v) =>
                          setHostingConfig((p) => ({
                            ...p,
                            remote_db_password: v,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── İstenen Altta Ortalanmış Aksiyon Butonları ── */}
              <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col items-center">
                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    type="button"
                    onClick={handleClearDeploymentState}
                    className="px-8 py-3.5 rounded-full border border-slate-300 bg-white text-sm font-black text-slate-700 hover:bg-slate-50 hover:text-rose-600 shadow-sm transition-all duration-200"
                  >
                    🗑️ Temizle
                  </button>
                  <button
                    type="button"
                    onClick={handleValidateConfig}
                    disabled={!hostingConfig.host_ip || isRunning}
                    className="px-8 py-3.5 rounded-full bg-sky-100 text-sky-800 text-sm font-black hover:bg-sky-200 shadow-sm transition-all duration-200 disabled:opacity-50"
                  >
                    🔌 Bağlantıyı Test Et
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={loadingConfig || !hostingConfig.host_ip}
                    className="px-10 py-3.5 rounded-full bg-slate-900 text-white text-sm font-black hover:bg-slate-800 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                  >
                    💾 Ayarları Kaydet
                  </button>
                </div>

                {/* Bildirimler */}
                {loadingConfig && (
                  <div className="mt-6 text-sm font-bold text-sky-600 bg-sky-50 px-6 py-3 rounded-xl border border-sky-100">
                    Yükleniyor...
                  </div>
                )}
                {configError && (
                  <div className="mt-6 text-sm font-bold text-rose-600 bg-rose-50 px-6 py-3 rounded-xl border border-rose-100">
                    ❌ {configError}
                  </div>
                )}
                {saveResult && (
                  <div className="mt-6 text-sm font-bold text-emerald-600 bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100">
                    ✅ {saveResult}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── AŞAĞI DOĞRU DEVAM EDENLER (Özetler ve Log Terminali) ── */}
        <div className="grid grid-cols-1 gap-8 mt-4">
          
          {/* Geçmiş Akış Özetleri */}
          <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-200">
            <h2 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-4 mb-6 flex items-center gap-2">
              <span className="text-2xl">📊</span> Operasyon Özetleri
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {SUMMARY_ITEMS.map((item) => (
                <SummaryCard
                  key={item.key}
                  label={item.label}
                  result={summaryState[item.key]}
                />
              ))}
            </div>
          </div>

          {/* Canlı Log Paneli */}
          <div className="bg-slate-900 rounded-[32px] p-6 md:p-8 shadow-xl border border-slate-800 flex flex-col min-h-[600px]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-6 mb-6">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <span className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">💻</span> 
                Terminal: Canlı Akış
              </h2>
              {isRunning && (
                <div className="flex items-center gap-4">
                  <ElapsedTimer isRunning={isRunning} />
                  <ActivityPulse
                    isRunning={isRunning}
                    lastMessage={lastLogMessage}
                  />
                </div>
              )}
            </div>

            {activeOp && (
              <div className="mb-8">
                <ProgressBar
                  operation={activeOp}
                  completedSteps={completedSteps}
                  isRunning={isRunning}
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-4 space-y-3 custom-scrollbar">
              {streamLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 font-mono text-sm gap-4">
                  <span className="text-5xl opacity-30">⌨️</span>
                  <span>Sistem şu an beklemede. Herhangi bir operasyon başlatılmadı.</span>
                </div>
              ) : (
                streamLogs.map((log, i) => <LogLine key={i} log={log} />)
              )}
              <div ref={logEndRef} className="h-8" />
            </div>

            {/* Hata Özeti */}
            {!isRunning && streamLogs.some((l) => l.status === "error") && (
              <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-rose-400">
                  <span className="text-xl">⚠️</span> Hata Özeti (
                  {streamLogs.filter((l) => l.status === "error").length} Hata)
                </div>
                <div className="max-h-40 space-y-2 overflow-y-auto custom-scrollbar">
                  {streamLogs
                    .filter((l) => l.status === "error")
                    .map((l, i) => (
                      <div
                        key={i}
                        className="font-mono text-sm text-rose-300 bg-rose-950/40 px-4 py-3 rounded-xl border border-rose-900/50"
                      >
                        • {String(l.message ?? "").slice(0, 200)}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

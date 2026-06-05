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
  seqLabel?: string;
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

const STATUS_ICONS: Record<LogStatus, string> = {
  info: "·",
  success: "✓",
  error: "✗",
  warning: "⚠",
};

const STATUS_CSS: Record<LogStatus, string> = {
  info: "log--info",
  success: "log--ok",
  error: "log--err",
  warning: "log--run",
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
    label: "Servisi Yeniden Başlat",
    description: "Uygulamayı tam yeniden başlatır.",
    icon: "🔄",
  },
  {
    op: "smart-reload",
    label: "Hızlı Güncelle",
    description: "Yeniden başlatmadan kod yeniler.",
    icon: "⚡",
  },
  {
    op: "db-migrate",
    label: "DB Migrasyonu",
    description: "Uzak DB şemasını günceller.",
    icon: "🔀",
    seqLabel: "1 · önce",
  },
  {
    op: "db-sync",
    label: "Yerel DB → Hosting",
    description: "Yerel veritabanını gönderir.",
    icon: "🗄️",
    seqLabel: "2 · sonra",
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
  group: "hazirlik" | "yayin" | "veritabani";
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
  { label: "İlk Kurulum",            group: "hazirlik",    key: "setupResult" },
  { label: "ZIP Yenile",             group: "hazirlik",    key: "refreshZipResult" },
  { label: "Dosyaları Sil",          group: "hazirlik",    key: "clearResult" },
  { label: "Deploy",                 group: "yayin",       key: "deployResult" },
  { label: "Servisi Yeniden Başlat", group: "yayin",       key: "reloadResult" },
  { label: "Hızlı Güncelle",         group: "yayin",       key: "smartReloadResult" },
  { label: "DB Migrasyonu",          group: "veritabani",  key: "dbMigrResult" },
  { label: "Yerel DB → Hosting",     group: "veritabani",  key: "dbSyncResult" },
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
    <div className="elapsed-timer">
      <span className="elapsed-timer__dot" />
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
    <div className="activity-pulse">
      <span className="activity-pulse__dot" />
      <div>
        <span className="activity-pulse__label">Aktif İşlem{dots}</span>
        <span className="activity-pulse__msg">
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
    return <div className="log-sep" />;
  }

  return (
    <div className={`log ${STATUS_CSS[log.status]}`}>
      <div className="log__hd">
        <span className="log__ic">{STATUS_ICONS[log.status]}</span>
        <span className="log__ts">{formatTime(log.timestamp)}</span>
        {log.step && (
          <span className="log__step">
            {STEP_LABELS[log.step] || log.step}
          </span>
        )}
      </div>
      <div className="log__msg">{messageText}</div>
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
  const pctToUse = isRunning && pct === 0 ? 5 : Math.max(pct, isRunning ? 5 : 0);

  return (
    <div className="progress">
      <div className="progress__hd">
        <span
          className={
            isRunning
              ? "progress__label--running"
              : doneCount === steps.length
              ? "progress__label--done"
              : "progress__label--idle"
          }
        >
          {isRunning ? (
            <>
              <span className="progress__pulse" />
              {OPERATION_LABELS[operation]} yürütülüyor...
            </>
          ) : doneCount === steps.length ? (
            "✓ İşlem Tamamlandı"
          ) : (
            "İşlem Bekliyor"
          )}
        </span>
        <span className="progress__pct">{pct}%</span>
      </div>

      <div className="progress__track">
        <div
          className={`progress__bar ${
            isRunning ? "progress__bar--running" : "progress__bar--done"
          }`}
          style={{ ["--bar-fill" as string]: `${pctToUse}%` }}
        />
      </div>

      <div className="progress__chips">
        {steps.map((step) => {
          const done = completedSteps.has(step);
          const active = isRunning && !done;
          return (
            <span
              key={step}
              className={`progress__chip ${
                done
                  ? "progress__chip--done"
                  : active
                  ? "progress__chip--active"
                  : "progress__chip--idle"
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
      <div className="sum">
        <div className="sum__label">{label}</div>
        <div className="sum__state sum__state--idle">
          <span>⏳</span> Çalıştırılmadı
        </div>
      </div>
    );
  }

  const isSuccess = result.success;
  const summaryText = typeof result.summary === "string" ? result.summary : "";
  const errors = Array.isArray(result.errors) ? result.errors : [];

  return (
    <div className={`sum ${isSuccess ? "sum--ok" : "sum--err"}`}>
      <div className="sum__label">{label}</div>
      <div className={`sum__state ${isSuccess ? "sum__state--ok" : "sum__state--err"}`}>
        <span>{isSuccess ? "✅" : "❌"}</span>
        <span>{summaryText.split("\n")[0] || "Durum bilgisi yok"}</span>
      </div>
      {errors.length > 0 && (
        <ul className="sum__errs">
          {errors.slice(0, 3).map((error, i) => (
            <li key={i} className="sum__err-item">
              • {String(error ?? "").slice(0, 100)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
      className={`op${isActive ? " op--active" : isDone ? " op--done" : ""}`}
    >
      <span className="op__ic">
        {isActive ? <span className="dep-spin">⚙️</span> : card.icon}
      </span>
      <div className="op__info">
        <div className="op__txt-row">
          <span className="op__txt">{card.label}</span>
          {card.seqLabel && <span className="op__seq">{card.seqLabel}</span>}
        </div>
        <span className="op__desc">{card.description}</span>
      </div>
      <div className="op__go">
        {isActive && <span className="op__go--ping" />}
        {isDone && <span className="op__go--check">✓</span>}
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
    <div className={`field${className ? " " + className : ""}`}>
      <label>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
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
    ssh_key_path: "",
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
  const [configOpen, setConfigOpen] = useState(false);

  const methodErrorCountRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const termBodyRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const apiUrl = normalizeDeploymentApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
  );

  // Otomatik scroll — kullanıcı yukarı kaydırdıysa durur
  useEffect(() => {
    if (!userScrolledRef.current) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamLogs]);

  const handleTermScroll = useCallback(() => {
    const el = termBodyRef.current;
    if (!el) return;
    userScrolledRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 60;
  }, []);

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
        ssh_key_path: stripQ(data.ssh_key_path, ""),
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
      userScrolledRef.current = false;
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
      const targetsToRun = needsHostingConfig ? selectedTargets : [deploymentTarget];
      let allSuccess = true;
      let lastDoneResult: SystemSetupResponse | null = null;

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
                lastDoneResult = {
                  success: targetSuccess,
                  logs: [],
                  summary: String(parsed.summary ?? ""),
                  errors: Array.isArray(parsed.errors) ? (parsed.errors as unknown[]).map(String) : [],
                };
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
        }

        const genericSummary: SystemSetupResponse = { success: allSuccess, logs: [], errors: allSuccess ? [] : ["Bir veya daha fazla hedefte hata var."], summary: allSuccess ? "Tüm seçili hedeflerde işlem tamamlandı." : "Bazı hedeflerde hata oluştu." };
        const opResult = (targetsToRun.length === 1 && lastDoneResult) ? { ...lastDoneResult, success: allSuccess } : genericSummary;
        if (op === "setup") setSetupResult(opResult);
        if (op === "refresh-zip") setRefreshZipResult(opResult);
        if (op === "clear") setClearResult(opResult);
        if (op === "deploy") setDeployResult(opResult);
        if (op === "reload") setReloadResult(opResult);
        if (op === "smart-reload") setSmartReloadResult(opResult);
        if (op === "db-sync") setDbSyncResult(opResult);
        if (op === "db-migrate") setDbMigrResult(opResult);
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
      setSaveResult("Ayarlar .env dosyasına başarıyla kaydedildi.");
      await fetchHostingConfig();
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
    <div className="dep">
      <div className="dep__inner">

        {/* ── Hero ── */}
        <div className="dep-hero">
          <div className="dep-hero__meta">
            <div className="dep-badge">
              <span className="dep-badge__dot" />
              SİSTEM YÖNETİMİ
            </div>
            <div className="dep-lh-badge">
              <span className="dep-lh-badge__dot" />
              <span className="dep-lh-badge__label">LOCALHOST</span>
            </div>
            <div className="dep-lh-sub">Yalnızca süper admin · yerel ortam</div>
          </div>
          <h1>Deployment Control Center</h1>
        </div>

        {/* ── Modüller ── */}
        <div className="card card--pad">
          <div className="card__hd">
            <h2 className="card__title">⚙️ Modüller</h2>
            <p className="card__sub">Sıralı veya bağımsız çalıştırın.</p>
          </div>

          <div className="dep-modules">
            <div className="dep-mod-group">
              <div className="dep-mod-group__hd">
                <span className="dep-mod-group__num">1</span>
                Hazırlık
              </div>
              <div className="dep-mod-group__btns">
                {OPERATION_CARDS.filter((c) =>
                  ["setup", "refresh-zip", "clear"].includes(c.op)
                ).map((card) => (
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

            <div className="dep-mod-group">
              <div className="dep-mod-group__hd">
                <span className="dep-mod-group__num">2</span>
                Yayın
              </div>
              <div className="dep-mod-group__btns">
                {OPERATION_CARDS.filter((c) =>
                  ["deploy", "reload", "smart-reload"].includes(c.op)
                ).map((card) => (
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

            <div className="dep-mod-group">
              <div className="dep-mod-group__hd">
                <span className="dep-mod-group__num">3</span>
                Veritabanı
              </div>
              <div className="dep-mod-group__btns">
                {OPERATION_CARDS.filter((c) =>
                  ["db-migrate", "db-sync"].includes(c.op)
                ).map((card) => (
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
        </div>

        {/* ── Sistem Konfigürasyonu ── */}
        <div className="card card--pad">

              <button
                type="button"
                className={`cfg-hd cfg-hd--collapsible${configOpen ? " cfg-hd--open" : ""}`}
                onClick={() => setConfigOpen((o) => !o)}
              >
                <div className="cfg-hd__left">
                  <h2>🔧 Sistem Konfigürasyonu</h2>
                  {!configOpen && (
                    <p>
                      Aşağıdaki veriler sunucu bağlantısını sağlar ve{" "}
                      <code>api/.env</code> dosyasından okunur.
                    </p>
                  )}
                </div>
                <div className="cfg-hd__right">
                  {!configOpen && <span className="cfg-hd__hint">Düzenlemek için aç</span>}
                  <svg
                    className={`cfg-hd__chevron${configOpen ? " cfg-hd__chevron--open" : ""}`}
                    width="20" height="20" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {configOpen && (<>
              {/* Sunucu Ayarları */}
              <div className="cfg-section cfg-section--server">
                <h3 className="cfg-section__title">
                  <span className="cfg-section__ic">🌐</span>
                  Sunucu Ayarları
                </h3>

                <div className="cfg-targets">
                  <span className="cfg-targets__label">
                    Deployment Hedef Domainleri
                  </span>
                  <div className="cfg-targets__grid">
                    {DEPLOYMENT_TARGETS.map((target) => {
                      const checked = selectedTargets.includes(target.key);
                      return (
                        <label
                          key={target.key}
                          className={`cfg-target${checked ? " cfg-target--checked" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              handleToggleDeploymentTarget(target.key)
                            }
                          />
                          <span>{target.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="cfg-target__note">
                    Isaretli domainlerde buton islemleri sira ile calisir.
                    Alanlar birincil secili domaine gore otomatik doldurulur.
                  </div>
                  <div className="cfg-target__info">
                    Domain Mode: localde pasif tutulur,{" "}
                    <strong>Hostinge Gönder</strong> adımında otomatik aktif edilir.
                  </div>
                </div>

                <div className="g2">
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
                  <div className="g2--sm">
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
                        setHostingConfig((p) => ({ ...p, ssh_key_path: v }))
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

              <hr className="cfg-divider" />

              {/* Veritabanı Ayarları */}
              <div className="cfg-db-grid">
                <div className="cfg-db-box">
                  <div className="cfg-section cfg-section--local">
                    <h3 className="cfg-section__title">
                      <span className="cfg-section__ic">🗄️</span>
                      Yerel DB (Opsiyonel)
                    </h3>
                    <div className="cfg-db-fields">
                      <div className="g2--sm">
                        <ConfigField
                          label="Host"
                          type="text"
                          placeholder="localhost"
                          value={hostingConfig.local_db_host ?? ""}
                          onChange={(v) =>
                            setHostingConfig((p) => ({ ...p, local_db_host: v }))
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
                              local_db_port: v
                                ? Number(v) || undefined
                                : undefined,
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
                      <div className="g2--sm">
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
                  </div>
                </div>

                <div className="cfg-db-box">
                  <div className="cfg-section cfg-section--remote">
                    <h3 className="cfg-section__title">
                      <span className="cfg-section__ic">☁️</span>
                      Uzak DB (Hosting)
                    </h3>
                    <div className="cfg-db-fields">
                      <div className="g2--sm">
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
                              remote_db_port: v
                                ? Number(v) || undefined
                                : undefined,
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
                      <div className="g2--sm">
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
              </div>

              {/* Aksiyon Butonları */}
              <div className="cfg-actions">
                <div className="cfg-actions__btns">
                  <button
                    type="button"
                    onClick={handleClearDeploymentState}
                    className="btn btn--ghost"
                  >
                    🗑️ Temizle
                  </button>
                  <button
                    type="button"
                    onClick={handleValidateConfig}
                    disabled={!hostingConfig.host_ip || isRunning}
                    className="btn btn--info"
                  >
                    🔌 Bağlantıyı Test Et
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={loadingConfig || !hostingConfig.host_ip}
                    className="btn btn--primary"
                  >
                    💾 Ayarları Kaydet
                  </button>
                </div>

                {loadingConfig && (
                  <div className="cfg-msg cfg-msg--loading">Yükleniyor...</div>
                )}
                {configError && (
                  <div className="cfg-msg cfg-msg--error">❌ {configError}</div>
                )}
                {saveResult && (
                  <div className="cfg-msg cfg-msg--ok">✅ {saveResult}</div>
                )}
              </div>
              </>)}

            </div>

        {/* ── Operasyon Özetleri ── */}
        <div className="card card--pad">
          <h2 className="sum-section-title">📊 Operasyon Özetleri</h2>
          <div className="sum-col-grid">
            {(
              [
                { key: "hazirlik",   label: "Hazırlık",   num: "1" },
                { key: "yayin",      label: "Yayın",      num: "2" },
                { key: "veritabani", label: "Veritabanı", num: "3" },
              ] as const
            ).map((grp) => (
              <div key={grp.key} className="sum-col-group">
                <div className="sum-col-group__hd">
                  <span className="sum-col-group__num">{grp.num}</span>
                  {grp.label}
                </div>
                <div className="sum-col-group__cards">
                  {SUMMARY_ITEMS.filter((item) => item.group === grp.key).map(
                    (item) => (
                      <SummaryCard
                        key={item.key}
                        label={item.label}
                        result={summaryState[item.key]}
                      />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Terminal ── */}
        <div className="term">
          <div className="term__fixed">
            <div className="term__hd">
              <h2 className="term__title">
                <span className="term__title-ic">💻</span>
                Terminal: Canlı Akış
              </h2>
              {isRunning && (
                <div className="term__meta">
                  <ElapsedTimer isRunning={isRunning} />
                  <ActivityPulse
                    isRunning={isRunning}
                    lastMessage={lastLogMessage}
                  />
                </div>
              )}
            </div>

            {streamLogs.some((l) => l.status === "error") && (
              <div className="term__err-banner">
                <span>⚠️</span>
                <span>
                  {streamLogs.filter((l) => l.status === "error").length} hata —{" "}
                  {String(
                    streamLogs.find((l) => l.status === "error")?.message ?? ""
                  ).slice(0, 90)}
                </span>
              </div>
            )}

            {activeOp && (
              <div className="term__progress">
                <ProgressBar
                  operation={activeOp}
                  completedSteps={completedSteps}
                  isRunning={isRunning}
                />
              </div>
            )}
          </div>

          <div
            className="term__body custom-scrollbar"
            ref={termBodyRef}
            onScroll={handleTermScroll}
          >
            {streamLogs.length === 0 ? (
              <div className="term__empty">
                <span className="term__empty-ic">⌨️</span>
                <span>
                  Sistem şu an beklemede. Herhangi bir operasyon başlatılmadı.
                </span>
              </div>
            ) : (
              streamLogs.map((log, i) => <LogLine key={i} log={log} />)
            )}
            <div ref={logEndRef} className="term__spacer" />
          </div>

          {!isRunning && streamLogs.some((l) => l.status === "error") && (
            <div className="term__err-sum">
              <div className="term__err-sum-title">
                <span>⚠️</span> Hata Özeti (
                {streamLogs.filter((l) => l.status === "error").length} Hata)
              </div>
              <div className="term__err-list custom-scrollbar">
                {streamLogs
                  .filter((l) => l.status === "error")
                  .map((l, i) => (
                    <div key={i} className="term__err-item">
                      • {String(l.message ?? "").slice(0, 200)}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

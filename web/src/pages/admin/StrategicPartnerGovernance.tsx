// ============================================================================
// StrategicPartnerGovernance.reference.tsx
// FAZ 2–4 — Yeniden tasarlanmış "Stratejik Partner Yönetimi" ekranının TAM,
// kendine yeten referans bileşeni. Claude Code bunu olduğu gibi yerleştirip
// TenantGovernanceTab içinden çağırır ve props'ları gerçek verilere bağlar.
//
// Hedef konum:  web/src/pages/admin/StrategicPartnerGovernance.tsx
// Stil:         web/src/pages/admin/strategicPartnerGovernance.css  (pakette)
// Bağımlılık:   ./strategicPartner.helpers  (Faz 1)
//
// PROPS SÖZLEŞMESİ (TenantGovernanceTab tarafından sağlanır):
//   rows               PartnerRow[]   ← buildPartnerRows(...) çıktısı
//   loading            boolean        ← ilk veri yüklenirken true
//   planOptions        {code,name,monthlyPrice}[]
//   onCreatePartner    (draft) => void|Promise  ← createTenant'a bağlanır
//   onChangePlan       (ids[], planCode) => void|Promise  ← updateTenant
//   onCrossLink        (key, tenantId?) => void  ← AdminPage sekme değiştirici
//   loadDetail?        (tenantId) => Promise<PartnerDetailData>  ← lazy ekip/fatura/destek
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import type { PartnerRow, PartnerOrigin } from "./strategicPartner.helpers";
import "./strategicPartnerGovernance.css";

export type PartnerDetailData = {
  team: { name: string; role: string; email: string }[];
  billing: { last?: string; lastAmount?: number; next?: string; method?: string; alert?: boolean };
  support: { open: number; resolved: number; last?: string };
};

export type NewPartnerDraft = {
  name: string; code: string; city: string; sector: string; contact: string;
  planCode: string; status: string; origin: PartnerOrigin; channel: string;
};

type Props = {
  rows: PartnerRow[];
  loading?: boolean;
  planOptions: { code: string; name: string; monthlyPrice: number }[];
  onCreatePartner: (draft: NewPartnerDraft) => void | Promise<void>;
  onChangePlan: (ids: number[], planCode: string) => void | Promise<void>;
  onCrossLink: (key: string, tenantId?: number) => void;
  loadDetail?: (tenantId: number) => Promise<PartnerDetailData>;
};

const ORIGIN_META: Record<PartnerOrigin, { short: string; cls: string; label: string }> = {
  direct: { short: "Doğrudan", cls: "spg-o-direct", label: "Doğrudan kayıt" },
  supplier: { short: "Tedarikçi → Partner", cls: "spg-o-supplier", label: "Tedarikçiden geçiş" },
  channel: { short: "İş Ortağı", cls: "spg-o-channel", label: "İş Ortağı yönlendirmesi" },
};
const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif", cls: "spg-st-active" },
  trial: { label: "Deneme", cls: "spg-st-trial" },
  setup: { label: "Kurulumda", cls: "spg-st-setup" },
  "churn-risk": { label: "Risk", cls: "spg-st-risk" },
  "past-due": { label: "Vade Aşımı", cls: "spg-st-pastdue" },
  paused: { label: "Duraklatıldı", cls: "spg-st-paused" },
};

function fmt(n: number) { return "₺" + n.toLocaleString("tr-TR"); }

export default function StrategicPartnerGovernance(props: Props) {
  const { rows, loading, planOptions, onCreatePartner, onChangePlan, onCrossLink, loadDetail } = props;

  const [status, setStatus] = useState<string>("all");
  const [origin, setOrigin] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [modal, setModal] = useState<{ kind: "new" } | { kind: "plan"; ids: number[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const ql = search.trim().toLowerCase();
  const filtered = useMemo(() => rows.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (origin !== "all" && p.origin !== origin) return false;
    if (ql) {
      const hay = (p.name + " " + p.city + " " + p.contact + " " + p.subs.map((s) => s.name).join(" ")).toLowerCase();
      if (!hay.includes(ql)) return false;
    }
    return true;
  }), [rows, status, origin, ql]);

  const totalSubs = rows.reduce((a, p) => a + p.subs.length, 0);
  const dualCount = rows.filter((p) => p.origin === "supplier").length;
  const channelCount = rows.filter((p) => p.origin === "channel").length;
  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const detailRow = detailId != null ? rows.find((p) => p.id === detailId) ?? null : null;

  const toggle = (id: number) => setCollapsed((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSel = (id: number) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));

  function exportCsv(list: PartnerRow[], filename: string) {
    const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const head = ["Firma", "Tip", "Köken", "Plan", "Durum", "Kullanıcı", "Aylık", "Şehir", "Yetkili"];
    const lines = [head.join(";")];
    list.forEach((p) => {
      lines.push([p.name, "Ana firma", ORIGIN_META[p.origin].label, p.plan, STATUS_META[p.status]?.label ?? p.status, p.users, p.mrr, p.city, p.contact].map(cell).join(";"));
      p.subs.forEach((s) => lines.push([s.name, "Alt firma · " + p.name, "—", "ana plana dahil", STATUS_META[s.status]?.label ?? s.status, s.users, "", s.city, ""].map(cell).join(";")));
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename + ".csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="spg-root">
      {/* KPI'lar */}
      <div className="spg-kpis">
        <KpiCard label="Stratejik partner" value={rows.length} sub="ana firma (holding)" accent="blue" />
        <KpiCard label="Alt firma" value={totalSubs} sub="bağlı tüzel kişilik" accent="violet" />
        <KpiCard label="Tedarikçiden geçiş" value={dualCount} sub="çift rol · havuzda da aktif" accent="warn" />
        <KpiCard label="İş Ortağı yönlendirmesi" value={channelCount} sub="kanal getirisi" accent="green" />
      </div>

      {/* Araç çubuğu */}
      <div className="spg-toolbar">
        <div className="spg-tabs">
          {[["all", "Tümü"], ["active", "Aktif"], ["trial", "Deneme"], ["churn-risk", "Risk"]].map(([code, label]) => (
            <button key={code} className={"spg-tab" + (status === code ? " on" : "")} onClick={() => setStatus(code)}>
              {label}<span className="spg-tab__n">{code === "all" ? rows.length : rows.filter((p) => p.status === code).length}</span>
            </button>
          ))}
        </div>
        <div className="spg-actions">
          <input className="spg-search" placeholder="Partner, alt firma veya şehir ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="spg-btn spg-btn--ghost" onClick={() => exportCsv(filtered, "stratejik-partnerler")}>Dışa aktar</button>
          <button className="spg-btn spg-btn--primary" onClick={() => setModal({ kind: "new" })}>+ Yeni Partner</button>
        </div>
      </div>

      {/* Köken filtresi */}
      <div className="spg-originbar">
        <span className="spg-originbar__lbl">Köken</span>
        {(["all", "direct", "supplier", "channel"] as const).map((code) => (
          <button key={code} className={"spg-originbar__btn" + (origin === code ? " on" : "")} onClick={() => setOrigin(code)}>
            {code === "all" ? "Tüm köken" : ORIGIN_META[code].short}
          </button>
        ))}
      </div>

      {/* Toplu işlem barı */}
      {selected.size > 0 && (
        <div className="spg-bulkbar">
          <span>{selected.size} partner seçili</span>
          <div className="spg-bulkbar__acts">
            <button onClick={() => exportCsv(rows.filter((p) => selected.has(p.id)), "secili-partnerler")}>Dışa aktar</button>
            <button onClick={() => setModal({ kind: "plan", ids: [...selected] })}>Plan değiştir</button>
            <button className="spg-bulkbar__clear" onClick={() => setSelected(new Set())}>Seçimi temizle</button>
          </div>
        </div>
      )}

      {/* Tablo */}
      <div className="spg-tablewrap">
        <table className="spg-table">
          <thead>
            <tr>
              <th className="spg-check"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Tümünü seç" /></th>
              <th>Firma</th><th>Köken</th><th>Plan</th><th>Durum</th>
              <th className="spg-right">Kullanıcı</th><th className="spg-right">Aylık</th><th>Sağlık</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={"sk" + i} className="spg-skelrow">
                  <td className="spg-check"><span className="spg-skel spg-skel--check" /></td>
                  <td><div className="spg-cell"><span className="spg-skel spg-skel--avatar" /><div className="spg-grow"><span className={`spg-skel spg-skel--line spg-skel--w${[50,57,64,71,78,55][i]??60}`} /><span className="spg-skel spg-skel--line spg-skel--sm spg-skel--w38" /></div></div></td>
                  <td><span className="spg-skel spg-skel--pill" /></td><td><span className="spg-skel spg-skel--pill" /></td><td><span className="spg-skel spg-skel--pill" /></td>
                  <td className="spg-right"><span className="spg-skel spg-skel--num" /></td><td className="spg-right"><span className="spg-skel spg-skel--num" /></td><td><span className="spg-skel spg-skel--line spg-skel--w80" /></td><td />
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="spg-empty">Eşleşen stratejik partner yok.</td></tr>
            ) : filtered.map((p) => {
              const open = !collapsed.has(p.id);
              const o = ORIGIN_META[p.origin];
              return (
                <PartnerRows
                  key={p.id} p={p} open={open} selected={selected.has(p.id)} originMeta={o}
                  onToggle={() => toggle(p.id)} onSelect={() => toggleSel(p.id)} onOpenDetail={() => setDetailId(p.id)}
                  onCrossLink={onCrossLink}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {detailRow && (
        <PartnerDrawer
          row={detailRow} loadDetail={loadDetail}
          onClose={() => setDetailId(null)}
          onChangePlan={() => setModal({ kind: "plan", ids: [detailRow.id] })}
          onCrossLink={onCrossLink}
        />
      )}

      {modal?.kind === "plan" && (
        <PlanModal
          targets={rows.filter((r) => modal.ids.includes(r.id))} planOptions={planOptions}
          onClose={() => setModal(null)}
          onApply={async (ids, code) => { await onChangePlan(ids, code); setModal(null); setSelected(new Set()); setToast(ids.length + " partner planı güncellendi."); }}
        />
      )}
      {modal?.kind === "new" && (
        <NewPartnerModal planOptions={planOptions} onClose={() => setModal(null)}
          onAdd={async (d) => { await onCreatePartner(d); setModal(null); setToast(d.name + " eklendi."); }} />
      )}
      {toast && <div className="spg-toast">✓ {toast}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
function KpiCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent: string }) {
  return (
    <div className={"spg-kpi spg-kpi--" + accent}>
      <div className="spg-kpi__label">{label}</div>
      <div className="spg-kpi__value">{value.toLocaleString("tr-TR")}</div>
      <div className="spg-kpi__sub">{sub}</div>
    </div>
  );
}

function PartnerRows({ p, open, selected, originMeta, onToggle, onSelect, onOpenDetail, onCrossLink }: {
  p: PartnerRow; open: boolean; selected: boolean; originMeta: { short: string; cls: string; label: string };
  onToggle: () => void; onSelect: () => void; onOpenDetail: () => void; onCrossLink: (k: string, id?: number) => void;
}) {
  const st = STATUS_META[p.status] ?? { label: p.status, cls: "" };
  return (
    <>
      <tr className={"spg-main" + (selected ? " sel" : "")}>
        <td className="spg-check"><input type="checkbox" checked={selected} onChange={onSelect} aria-label={p.name + " seç"} /></td>
        <td>
          <button className="spg-rowbtn" onClick={onOpenDetail}>
            <span className="spg-avatar" style={{ "--spg-color": p.color } as React.CSSProperties}>{p.code}</span>
            <span className="spg-grow">
              <span className="spg-name">{p.name}<span className="spg-tag spg-tag--main">ANA FİRMA</span>{p.dualRole && <span className={"spg-dual spg-dual--" + p.dualRole}>{p.dualRole === "active" ? "Çift rol" : "Çift rol · bekliyor"}</span>}</span>
              <span className="spg-sub">{p.sector} · {p.city}{p.subs.length > 0 && <span className="spg-subcount">{p.subs.length} alt firma</span>}</span>
            </span>
          </button>
        </td>
        <td><span className={"spg-origin " + originMeta.cls}>{originMeta.short}</span></td>
        <td><span className="spg-plan">{p.plan}</span></td>
        <td><span className={"spg-status " + st.cls}>{st.label}</span></td>
        <td className="spg-right"><b>{p.users}</b><div className="spg-usersub">grup toplamı</div></td>
        <td className="spg-right"><b>{p.mrr ? fmt(p.mrr) : "—"}</b></td>
        <td><HealthBar value={p.health} /></td>
        <td>{p.subs.length > 0 ? <button className="spg-toggle" onClick={onToggle} aria-expanded={open} aria-label="Alt firmalar">{open ? "▾" : "▸"}</button> : <button className="spg-toggle" onClick={onOpenDetail} aria-label="Detay">›</button>}</td>
      </tr>

      {open && (p.origin !== "direct" || p.dualRole) && (
        <tr className="spg-noterow"><td colSpan={9}>
          {p.origin !== "direct" && (
            <div className={"spg-note spg-note--" + p.origin}>
              <b>{originMeta.label}.</b>{p.origin === "channel" && p.originChannel ? " " + p.originChannel + " getirdi." : " Havuzdan stratejik partnerliğe geçiş."}
              {p.origin === "supplier" && <button type="button" className="spg-notelink" onClick={() => onCrossLink("platform_suppliers", p.id)}>Tedarikçi profilini gör →</button>}
              {p.origin === "channel" && <button type="button" className="spg-notelink" onClick={() => onCrossLink("channel_partners", p.id)}>İş ortağını gör →</button>}
            </div>
          )}
          {p.dualRole && p.origin !== "supplier" && (
            <div className={"spg-note spg-note--dualrole spg-note--dualrole-" + p.dualRole}>
              {p.dualRole === "active"
                ? <><b>Aktif çift rol.</b> Bu firma aynı zamanda platform tedarikçisi olarak kayıtlı ve aktif.</>
                : <><b>Çift rol başvurusu beklemede.</b> Tedarikçi portal erişimi henüz onaylanmadı.</>}
              <button type="button" className="spg-notelink" onClick={() => onCrossLink("platform_suppliers", p.id)}>
                Tedarikçi profilini gör →
              </button>
            </div>
          )}
        </td></tr>
      )}

      {open && p.subs.map((s) => (
        <tr key={s.id} className="spg-subrow">
          <td className="spg-check" />
          <td><div className="spg-cell"><span className="spg-tree">└</span><span className="spg-avatar spg-avatar--sm" style={{ "--spg-color": s.color } as React.CSSProperties}>{s.code}</span><span className="spg-grow"><span className="spg-name spg-name--sm">{s.name}<span className="spg-tag spg-tag--alt">alt firma</span></span><span className="spg-sub">{s.sector} · {s.city}</span></span></div></td>
          <td><span className="spg-inherit">↑ {p.name.split(" ")[0]}</span></td>
          <td><span className="spg-inherit">ana plana dahil</span></td>
          <td><span className={"spg-status " + (STATUS_META[s.status]?.cls ?? "")}>{STATUS_META[s.status]?.label ?? s.status}</span></td>
          <td className="spg-right"><b>{s.users}</b></td>
          <td className="spg-right"><span className="spg-inherit">—</span></td>
          <td><span className="spg-inherit">—</span></td>
          <td><button className="spg-toggle" onClick={() => onCrossLink("companies", p.id)} aria-label="Firmalar'da aç">⇗</button></td>
        </tr>
      ))}
    </>
  );
}

function HealthBar({ value }: { value: number }) {
  const tier = value >= 75 ? "good" : value >= 50 ? "warn" : "bad";
  return (
    <div className="spg-health">
      <div className="spg-health__track"><div className={"spg-health__fill spg-health__fill--" + tier} style={{ "--spg-fill-w": value + "%" } as React.CSSProperties} /></div>
      <span className={"spg-health__n spg-health__n--" + tier}>{value}</span>
    </div>
  );
}

function PartnerDrawer({ row, loadDetail, onClose, onChangePlan, onCrossLink }: {
  row: PartnerRow;
  loadDetail?: (id: number) => Promise<PartnerDetailData>;
  onClose: () => void; onChangePlan: () => void; onCrossLink: (k: string, id?: number) => void;
}) {
  const [data, setData] = useState<PartnerDetailData | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    if (loadDetail) { setBusy(true); Promise.resolve(loadDetail(row.id)).then((d) => { if (alive) { setData(d); setBusy(false); } }).catch(() => alive && setBusy(false)); }
    return () => { alive = false; };
  }, [row.id, loadDetail]);
  const o = ORIGIN_META[row.origin];
  const ini = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="spg-drawer" onClick={onClose}>
      <aside className="spg-drawer__panel" onClick={(e) => e.stopPropagation()}>
        <div className="spg-drawer__head">
          <span className="spg-avatar spg-avatar--lg" style={{ "--spg-color": row.color } as React.CSSProperties}>{row.code}</span>
          <div className="spg-grow"><div className="spg-name">{row.name}<span className="spg-tag spg-tag--main">ANA FİRMA</span></div><div className="spg-sub">{row.sector} · {row.city}</div></div>
          <button className="spg-x" onClick={onClose} aria-label="Kapat">×</button>
        </div>
        <div className="spg-drawer__chips">
          <span className={"spg-origin " + o.cls}>{o.short}</span>
          <span className="spg-plan">{row.plan}</span>
          <span className={"spg-status " + (STATUS_META[row.status]?.cls ?? "")}>{STATUS_META[row.status]?.label}</span>
          {row.dualRole && <span className={"spg-dual spg-dual--" + row.dualRole}>{row.dualRole === "active" ? "Çift rol" : "Çift rol · bekliyor"}</span>}
        </div>
        <div className="spg-drawer__body">
          <Section title="Künye">
            <div className="spg-facts">
              <Fact k="Sektör" v={row.sector} /><Fact k="Şehir" v={row.city} />
              <Fact k="Yetkili" v={row.contact} /><Fact k="Sağlık" v={row.health + "/100"} />
            </div>
          </Section>

          <Section title="Plan & fatura">
            <div className="spg-facts">
              <Fact k="Plan" v={row.plan} /><Fact k="Aylık" v={row.mrr ? fmt(row.mrr) : "—"} />
              <Fact k="Son ödeme" v={data?.billing.last ? data.billing.last + (data.billing.lastAmount ? " · " + fmt(data.billing.lastAmount) : "") : (busy ? "…" : "—")} />
              <Fact k="Sonraki fatura" v={data?.billing.next ?? (busy ? "…" : "—")} alert={data?.billing.alert} />
              <Fact k="Ödeme yöntemi" v={data?.billing.method ?? (busy ? "…" : "—")} wide />
            </div>
            <div className="spg-dlinkrow">
              <button className="spg-dlink" onClick={onChangePlan}>Plan değiştir</button>
              <button className="spg-dlink" onClick={() => onCrossLink("packages", row.id)}>Paket ve Kullanım'da aç →</button>
            </div>
          </Section>

          <Section title={"Ekip üyeleri (" + row.users + " kullanıcı)"}>
            {busy && !data ? <div className="spg-dempty">Yükleniyor…</div>
              : (data?.team?.length ?? 0) === 0 ? <div className="spg-dempty">Kayıtlı ekip üyesi yok.</div>
              : <div className="spg-teamlist">{data!.team.map((m, i) => (
                  <div key={i} className="spg-teamrow"><span className="spg-teamav" style={{ "--spg-color": row.color } as React.CSSProperties}>{ini(m.name)}</span><div className="spg-grow"><b>{m.name}</b><span>{m.role}</span></div><a className="spg-teammail" href={"mailto:" + m.email} title={m.email}>✉</a></div>
                ))}</div>}
            <button className="spg-dlink" onClick={() => onCrossLink("personnel", row.id)}>Ekip Üyeleri'nde gör →</button>
          </Section>

          <Section title="Destek">
            <div className="spg-supstat">
              <div className={"spg-supstat__n" + (data?.support.open ? " open" : "")}><b>{data?.support.open ?? 0}</b><span>açık</span></div>
              <div className="spg-supstat__n"><b>{data?.support.resolved ?? 0}</b><span>çözüldü</span></div>
              <div className="spg-supstat__last"><span>Son kayıt</span><b>{data?.support.last ?? "—"}</b></div>
            </div>
            <button className="spg-dlink" onClick={() => onCrossLink("support_tickets", row.id)}>Destek geçmişi →</button>
          </Section>

          {row.dualRole && (
            <Section title={"Tedarikçi Portalı · " + (row.dualRole === "active" ? "Aktif Çift Rol" : "Başvuru Beklemede")}>
              <div className="spg-facts">
                <Fact k="Çift rol durumu" v={row.dualRole === "active" ? "Aktif" : "Beklemede"} alert={row.dualRole === "pending"} />
              </div>
              <div className="spg-dlinkrow">
                <button type="button" className="spg-dlink" onClick={() => onCrossLink("platform_suppliers", row.id)}>
                  Tedarikçi profilini gör →
                </button>
              </div>
            </Section>
          )}

          <Section title={"Alt firmalar (" + row.subs.length + ")"}>
            {row.subs.length === 0 ? <div className="spg-dempty">Alt firma yok.</div>
              : <div className="spg-famlist">{row.subs.map((s) => (
                  <button key={s.id} className="spg-famcard" onClick={() => onCrossLink("companies", row.id)}><span className="spg-avatar spg-avatar--sm" style={{ "--spg-color": s.color } as React.CSSProperties}>{s.code}</span><span className="spg-grow"><b>{s.name}</b><span>{s.sector} · {s.city} · {s.users} kullanıcı</span></span><span>›</span></button>
                ))}</div>}
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="spg-dsec"><div className="spg-dsec__hd">{title}</div>{children}</div>;
}
function Fact({ k, v, wide, alert }: { k: string; v: string; wide?: boolean; alert?: boolean }) {
  return <div className={"spg-fact" + (wide ? " wide" : "")}><span>{k}</span><b className={alert ? "alert" : ""}>{v}</b></div>;
}

function PlanModal({ targets, planOptions, onClose, onApply }: {
  targets: PartnerRow[]; planOptions: { code: string; name: string; monthlyPrice: number }[];
  onClose: () => void; onApply: (ids: number[], code: string) => void;
}) {
  const [code, setCode] = useState(targets[0]?.planCode || planOptions[0]?.code || "");
  return (
    <div className="spg-modal" onClick={onClose}>
      <div className="spg-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="spg-modal__hd"><h3>Plan değiştir</h3><button className="spg-x" onClick={onClose}>×</button></div>
        <div className="spg-modal__body">
          <p className="spg-modal__sub">{targets.length} partner için yeni plan seçin.</p>
          <div className="spg-modal__targets">{targets.map((t) => <span key={t.id} className="spg-chip">{t.name}</span>)}</div>
          <div className="spg-planopts">
            {planOptions.map((pl) => (
              <button key={pl.code} className={"spg-planopt" + (code === pl.code ? " on" : "")} onClick={() => setCode(pl.code)}>
                <b>{pl.name}</b><span>{pl.monthlyPrice ? fmt(pl.monthlyPrice) + "/ay" : "Özel fiyat"}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="spg-modal__foot">
          <button className="spg-btn spg-btn--ghost" onClick={onClose}>Vazgeç</button>
          <button className="spg-btn spg-btn--primary" onClick={() => onApply(targets.map((t) => t.id), code)}>Planı uygula</button>
        </div>
      </div>
    </div>
  );
}

function NewPartnerModal({ planOptions, onClose, onAdd }: {
  planOptions: { code: string; name: string; monthlyPrice: number }[];
  onClose: () => void; onAdd: (d: NewPartnerDraft) => void;
}) {
  const [f, setF] = useState<NewPartnerDraft>({ name: "", code: "", city: "", sector: "", contact: "", planCode: planOptions[0]?.code || "", status: "trial", origin: "direct", channel: "" });
  const set = (k: keyof NewPartnerDraft, v: string) => setF((s) => ({ ...s, [k]: v }));
  const codeAuto = (f.code || f.name.split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join("")).toUpperCase().slice(0, 3);
  const valid = f.name.trim().length > 1 && f.city.trim() && f.contact.trim();
  return (
    <div className="spg-modal" onClick={onClose}>
      <div className="spg-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="spg-modal__hd"><h3>Yeni stratejik partner</h3><button className="spg-x" onClick={onClose}>×</button></div>
        <div className="spg-modal__body">
          <div className="spg-form">
            <Field wide label="Firma adı *"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Örn. Demir Çelik A.Ş." /></Field>
            <Field label="Kısa kod"><input value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase().slice(0, 3))} placeholder={codeAuto || "AUTO"} maxLength={3} /></Field>
            <Field label="Şehir *"><input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="İstanbul" /></Field>
            <Field wide label="Sektör"><input value={f.sector} onChange={(e) => set("sector", e.target.value)} placeholder="Endüstriyel üretim" /></Field>
            <Field wide label="Yetkili e-posta *"><input value={f.contact} onChange={(e) => set("contact", e.target.value)} placeholder="yetkili@firma.com" /></Field>
            <Field label="Plan"><select value={f.planCode} onChange={(e) => set("planCode", e.target.value)}>{planOptions.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></Field>
            <Field label="Durum"><select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="trial">Deneme</option><option value="active">Aktif</option><option value="setup">Kurulumda</option></select></Field>
            <Field wide label="Köken"><select value={f.origin} onChange={(e) => set("origin", e.target.value as PartnerOrigin)}><option value="direct">Doğrudan kayıt</option><option value="supplier">Tedarikçiden geçiş (çift rol)</option><option value="channel">İş Ortağı yönlendirmesi</option></select></Field>
            {f.origin === "channel" && <Field wide label="İş ortağı"><input value={f.channel} onChange={(e) => set("channel", e.target.value)} placeholder="Vektör İş Geliştirme" /></Field>}
          </div>
        </div>
        <div className="spg-modal__foot">
          <button className="spg-btn spg-btn--ghost" onClick={onClose}>Vazgeç</button>
          <button className="spg-btn spg-btn--primary" disabled={!valid} onClick={() => valid && onAdd({ ...f, code: codeAuto || "YEN" })}>Partner ekle</button>
        </div>
      </div>
    </div>
  );
}
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={"spg-field" + (wide ? " wide" : "")}><span>{label}</span>{children}</label>;
}

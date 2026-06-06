/**
 * panel-colors.ts — Buyer Asistans PANEL RENK SKALASI (TEK KAYNAK, TS)
 * ─────────────────────────────────────────────────────────────────────
 * Bu dosya VARSAYILANLARI tutar. segment-colors.ts bu dosyadan türer;
 * workspace-panels.ts accent değerlerini buradan okur.
 *
 * ⚠ DÜZENLENEBİLİR: Süper Admin ve "panel_design.edit" yetkili adminler
 *   "Panel Tasarımı" ekranından bu değerleri override eder. Override katmanı
 *   API'den gelir (PanelThemeOverrides) → resolvePanelColors() ile birleşir →
 *   applyPanelTheme() panel köküne CSS değişkeni olarak basar.
 *   Yetki / akış: panel_colors/SKILL.md · "Yönetişim & Düzenleme Yetkisi".
 */

export type SegmentKey =
  | 'platform' | 'strategic' | 'supplier'
  | 'channel'  | 'employer'  | 'seeker' | 'system';

export interface SegmentTheme {
  key: SegmentKey;
  label: string;            // TR etiket
  accent: string;           // ana renk — nav + panel başlık + login + grafik
  accentDark: string;       // gradient / derinlik
  accentTint: string;       // açık panel / kart zemini
  chipBg: string;           // rozet & aktivite-satırı açık zemini (= SEGMENT_META.bg)
  secondary: string | null; // ikincil vurgu — yalnız Stratejik Partner: altın
  onAccent: string;         // accent üstü metin (kontrast ≥ 4.5:1)
}

export const BRAND = {
  forest:   '#112a25',
  gold:     '#D4AF37',
  goldDark: '#a9821f',
  tick:     '#50C878',   // yeşil ✓
  paper:    '#f4f5f2',
} as const;

/** VARSAYILAN skala. accent değerleri = segment-colors.ts SEGMENT_META ile aynı. */
export const PANEL_COLORS: Record<SegmentKey, SegmentTheme> = {
  platform:  { key: 'platform',  label: 'Platform / Süper Admin',    accent: '#3A4F86', accentDark: '#2b3a5e', accentTint: '#eef1f8', chipBg: '#eef1f8', secondary: null,      onAccent: '#ffffff' },
  strategic: { key: 'strategic', label: 'Stratejik Partner',         accent: '#134E37', accentDark: '#0e3a29', accentTint: '#e4efe9', chipBg: '#ecfdf5', secondary: '#D4AF37', onAccent: '#ffffff' },
  supplier:  { key: 'supplier',  label: 'Tedarikçi',                 accent: '#0E7490', accentDark: '#0c5e75', accentTint: '#e0f2f7', chipBg: '#ecfeff', secondary: null,      onAccent: '#ffffff' },
  channel:   { key: 'channel',   label: 'İş Ortağı',                 accent: '#7C2D12', accentDark: '#5e220e', accentTint: '#f4e7e1', chipBg: '#fff7ed', secondary: null,      onAccent: '#ffffff' },
  employer:  { key: 'employer',  label: 'İşveren (Personel Arayan)', accent: '#5B21B6', accentDark: '#4a1a96', accentTint: '#ece6f9', chipBg: '#fdf4ff', secondary: null,      onAccent: '#ffffff' },
  seeker:    { key: 'seeker',    label: 'Aday (İş Arayan)',          accent: '#9F1239', accentDark: '#7a0e2e', accentTint: '#f8e7ec', chipBg: '#fff1f3', secondary: null,      onAccent: '#ffffff' },
  system:    { key: 'system',    label: 'Sistem',                    accent: '#64748b', accentDark: '#475569', accentTint: '#f1f5f9', chipBg: '#f1f5f9', secondary: null,      onAccent: '#ffffff' },
};

/** "Panel Tasarımı"ndan kaydedilen override katmanı (API'den gelir). */
export type PanelThemeOverrides = Partial<Record<SegmentKey, Partial<Omit<SegmentTheme, 'key' | 'label'>>>>;

/** Varsayılan + override birleştir. Override yoksa varsayılan döner. */
export function resolvePanelColors(overrides?: PanelThemeOverrides | null): Record<SegmentKey, SegmentTheme> {
  if (!overrides) return PANEL_COLORS;
  const out = {} as Record<SegmentKey, SegmentTheme>;
  (Object.keys(PANEL_COLORS) as SegmentKey[]).forEach((k) => {
    out[k] = { ...PANEL_COLORS[k], ...(overrides[k] ?? {}) };
  });
  return out;
}

/** Bir segment temasını CSS değişkenlerine çevirir. */
export function panelCssVars(t: SegmentTheme): Record<string, string> {
  return {
    '--panel-accent':      t.accent,
    '--panel-accent-dark': t.accentDark,
    '--panel-accent-tint': t.accentTint,
    '--panel-chip-bg':     t.chipBg,
    '--panel-secondary':   t.secondary ?? t.accent,
    '--panel-on-accent':   t.onAccent,
  };
}

/** Panel kök elemanına temayı inline CSS değişkeni olarak uygular. */
export function applyPanelTheme(el: HTMLElement, t: SegmentTheme): void {
  el.setAttribute('data-panel', t.key);
  for (const [k, v] of Object.entries(panelCssVars(t))) el.style.setProperty(k, v);
}

/** Canlı güncelleme: "Panel Tasarımı" kaydet → tüm açık paneller tazelensin. */
export const PANEL_THEME_EVENT = 'panelthemechange';
export function publishPanelTheme(overrides: PanelThemeOverrides): void {
  window.dispatchEvent(new CustomEvent(PANEL_THEME_EVENT, { detail: overrides }));
}

/** Rol-profili canlı güncelleme — Faz 4. */
export type PanelProfileEventDetail = {
  biz: string;
  sys: string;
  profile: {
    color: string;
    color2: string;
    color2Mix: number;
    syncTopbar: boolean;
    accent: string;
    textColor: string;
  };
};
export const PANEL_PROFILE_EVENT = 'panelprofilechange';
export function publishPanelProfile(detail: PanelProfileEventDetail): void {
  window.dispatchEvent(new CustomEvent(PANEL_PROFILE_EVENT, { detail }));
}

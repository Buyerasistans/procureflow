/**
 * segment-colors.ts — SEGMENT_META tek kaynağı panel-colors.ts'tir.
 * Geriye-uyum alias'ları: color=accent, bg=chipBg.
 * Mevcut tüketiciler bu import'u koruyabilir; yeni kod panel-colors.ts'i doğrudan kullanabilir.
 */
import { PANEL_COLORS as _PC } from './panel-colors';

// Re-export: tüm tüketiciler segment-colors üzerinden erişmeye devam edebilir.
export type { SegmentKey, SegmentTheme, PanelThemeOverrides } from './panel-colors';
export {
  PANEL_COLORS,
  BRAND,
  resolvePanelColors,
  applyPanelTheme,
  panelCssVars,
  publishPanelTheme,
  PANEL_THEME_EVENT,
} from './panel-colors';

export type SegmentMeta = {
  label: string;
  color: string;           // alias: accent (geriye-uyum)
  bg: string;              // alias: chipBg (geriye-uyum)
  accentDark: string;
  accentTint: string;
  secondary: string | null;
  onAccent: string;
};

type _SK = keyof typeof _PC;

export const SEGMENT_META: Record<_SK, SegmentMeta> = Object.fromEntries(
  (Object.entries(_PC) as [_SK, (typeof _PC)[_SK]][]).map(([k, t]) => [
    k,
    {
      label:      t.label,
      color:      t.accent,
      bg:         t.chipBg,
      accentDark: t.accentDark,
      accentTint: t.accentTint,
      secondary:  t.secondary,
      onAccent:   t.onAccent,
    } satisfies SegmentMeta,
  ])
) as Record<_SK, SegmentMeta>;

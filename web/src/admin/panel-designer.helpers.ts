/**
 * panel-designer.helpers.ts — Panel Tasarımı yardımcıları (TEK KAYNAK)
 * İki renkli navbar/üst başlık zemini + renk türevleri.
 * panel-colors.ts (SegmentKey, PANEL_COLORS) ile birlikte kullanılır.
 */

/** hex koyulaştır/aydınlat — pct<0 koyu, pct>0 açık */
export function pdShade(hex: string, pct: number): string {
  let h = (hex || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function pdRgba(hex: string, a: number): string {
  let h = (hex || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * navbar & üst başlık 2-renkli zemin.
 * Bütünlük: 'top' (üst başlık) parıltısı SOL-ALTTAN; 'side' (navbar) parıltısı ALTTAN —
 * ikisi de ekranın sol-alt köşesine akar, tek ışık havuzu gibi okunur.
 */
export function pdChromeBg(
  kind: 'top' | 'side',
  color: string,
  color2: string,
  mix: number,
  dark?: string,
): string {
  const d = dark || pdShade(color, -18);
  const a = Math.min(0.62, mix == null ? 0.18 : mix);
  if (kind === 'side') {
    return `radial-gradient(circle at 30% 112%, ${pdRgba(color2, a)} 0%, transparent 52%), linear-gradient(180deg, ${color} 0%, ${d} 100%)`;
  }
  return `radial-gradient(circle at 4% 150%, ${pdRgba(color2, a)} 0%, transparent 46%), linear-gradient(135deg, ${color} 0%, ${d} 100%)`;
}

/** Profil → CSS değişkenleri (navbar + üst başlık + panel gövdesi okur). */
export function panelProfileCssVars(p: {
  color: string;
  color2: string;
  color2Mix: number;
  accent: string;
  textColor: string;
}): Record<string, string> {
  return {
    '--panel-accent':      p.color,
    '--panel-color2':      p.color2,
    '--panel-color2-mix':  String(p.color2Mix),
    '--panel-accent-2':    p.accent,
    '--panel-on-accent':   p.textColor,
    '--panel-chrome-top':  pdChromeBg('top',  p.color, p.color2, p.color2Mix),
    '--panel-chrome-side': pdChromeBg('side', p.color, p.color2, p.color2Mix),
  };
}

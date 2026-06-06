/**
 * panel-profile.schema.ts — Panel Tasarımı profil yardımcıları.
 * WorkspacePanelProfile üzerinde çalışır; DB'de yalnız override saklanır,
 * renk varsayılanları panel-colors.ts'ten gelir.
 */
import { PANEL_COLORS, type SegmentKey } from './panel-colors';
import type { WorkspacePanelProfile } from '../services/admin.service';

/** Segment → kategori eşlemesi (sol ağaç + yeni profil ekleme). */
export const CATEGORY_SEG: Record<string, SegmentKey> = {
  Platform:          'platform',
  'Stratejik Partner': 'strategic',
  Tedarikçi:         'supplier',
  'Kanal İş Ortağı': 'channel',
  Kariyer:           'employer',
};

/** business_role'dan segment tahmin eder (normalizasyon için). */
function bizRoleToSeg(biz: string): SegmentKey {
  const b = biz.toLowerCase();
  if (b.includes('supplier') || b.startsWith('tedarikci') || b.startsWith('pazarlama')) return 'supplier';
  if (b.includes('channel')  || b.includes('kanal'))                                    return 'channel';
  if (b.includes('employer') || b.startsWith('ik_') || b.startsWith('hr_'))             return 'employer';
  if (b.includes('candidate') || b.includes('talent'))                                  return 'seeker';
  if (b.includes('admin') || b.includes('satinalma') || b.includes('proje') || b.includes('teknik_uzman')) return 'strategic';
  return 'platform';
}

/**
 * Yeni profil için boş WorkspacePanelProfile üretir.
 * Renk varsayılanları segment skalasından gelir.
 */
export function makePanelProfile(
  biz: string,
  sys: string,
  seg: SegmentKey,
  title: string,
): WorkspacePanelProfile {
  const def = PANEL_COLORS[seg];
  return {
    business_role:   biz,
    system_role:     sys,
    title,
    nav_label:       title,
    workspace_label: title + ' Alanı',
    description:     title + ' için ayrı çalışma alanı.',
    hero_title:      title + ' Paneli',
    hero_description: title + ' için ayrı çalışma alanı.',
    accent_color:    def.secondary ?? def.accent,
    color2:          def.secondary ?? def.accent,
    color2Mix:       0.18,
    syncTopbar:      false,
    selfEdit:        false,
    vitrinEdit:      false,
    menu_style:      'pill',
    glow_intensity:  0.45,
    accent_opacity:  0.85,
    primary_accent_stop: 48,
    secondary_accent_start: 72,
    allowed_tabs:    ['panel_home'],
    quick_links:     [{ label: 'Genel Bakış', href: '/dashboard', description: 'Genel alana dön' }],
  };
}

/**
 * Eksik color2/color2Mix/syncTopbar/selfEdit/vitrinEdit alanlarını
 * (eski kayıtlar veya DB'den gelen eksik profiller) segment skalasıyla doldurur.
 */
export function normalizePanelProfiles(list: WorkspacePanelProfile[]): WorkspacePanelProfile[] {
  return (list || []).map((p) => {
    const alreadyNormalized =
      p.color2 != null && p.color2Mix != null &&
      p.syncTopbar != null && p.selfEdit != null && p.vitrinEdit != null;
    if (alreadyNormalized) return p;

    const seg = bizRoleToSeg(p.business_role);
    const def = PANEL_COLORS[seg] ?? PANEL_COLORS.platform;
    return {
      ...p,
      color2:     p.color2     ?? def.secondary ?? def.accent,
      color2Mix:  p.color2Mix  ?? 0.18,
      syncTopbar: p.syncTopbar ?? false,
      selfEdit:   p.selfEdit   ?? false,
      vitrinEdit: p.vitrinEdit ?? false,
    };
  });
}

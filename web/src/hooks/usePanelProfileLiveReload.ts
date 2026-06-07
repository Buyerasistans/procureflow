import { useEffect } from "react";
import { PANEL_PROFILE_EVENT } from "../admin/panel-colors";
import type { PanelProfileEventDetail } from "../admin/panel-colors";
import { panelProfileCssVars, pdChromeBg } from "../admin/panel-designer.helpers";

/**
 * 'panelprofilechange' event'ini dinler; profil kaydedildiğinde
 * aktif panel kökündeki (.as-wrap) CSS değişkenlerini günceller — reload YOK.
 * syncTopbar=true ise .app-topbar da aynı chrome rengiyle boyanır.
 *
 * currentBiz / currentSys: mevcut kullanıcının rolleri. Geçilirse sadece
 * bu kullanıcıyla eşleşen profil event'i uygulanır — başka rollerin
 * canlı önizlemesinin mevcut paneli kirletmesi engellenir.
 */
export function usePanelProfileLiveReload(currentBiz?: string, currentSys?: string): void {
  useEffect(() => {
    function handleProfileChange(e: Event): void {
      const { biz, sys, profile } = (e as CustomEvent<PanelProfileEventDetail>).detail;

      // Mevcut kullanıcının rolüyle eşleşmiyorsa uygulama — başka profil preview'i bu paneli değiştirmesin
      if (currentBiz !== undefined && currentSys !== undefined) {
        if (biz !== currentBiz || sys !== currentSys) return;
      }

      const wrap = document.querySelector(".as-wrap") as HTMLElement | null;
      if (wrap) {
        const vars = panelProfileCssVars(profile);
        for (const [k, v] of Object.entries(vars)) {
          wrap.style.setProperty(k, v);
        }
      }

      const topbar = document.querySelector(".app-topbar") as HTMLElement | null;
      if (topbar) {
        if (profile.syncTopbar) {
          const bg = pdChromeBg("top", profile.color, profile.color2, profile.color2Mix);
          topbar.style.setProperty("background", bg);
        } else {
          topbar.style.removeProperty("background");
        }
      }
    }

    window.addEventListener(PANEL_PROFILE_EVENT, handleProfileChange);
    return () => window.removeEventListener(PANEL_PROFILE_EVENT, handleProfileChange);
  }, [currentBiz, currentSys]);
}

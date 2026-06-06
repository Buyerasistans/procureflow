import { useEffect } from "react";
import { PANEL_PROFILE_EVENT } from "../admin/panel-colors";
import type { PanelProfileEventDetail } from "../admin/panel-colors";
import { panelProfileCssVars, pdChromeBg } from "../admin/panel-designer.helpers";

/**
 * 'panelprofilechange' event'ini dinler; profil kaydedildiğinde
 * aktif panel kökündeki (.as-wrap) CSS değişkenlerini günceller — reload YOK.
 * syncTopbar=true ise .app-topbar da aynı chrome rengiyle boyanır.
 */
export function usePanelProfileLiveReload(): void {
  useEffect(() => {
    function handleProfileChange(e: Event): void {
      const { profile } = (e as CustomEvent<PanelProfileEventDetail>).detail;

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
  }, []);
}

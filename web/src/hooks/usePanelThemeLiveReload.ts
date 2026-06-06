import { useEffect } from "react";
import { PANEL_THEME_EVENT, resolvePanelColors } from "../admin/panel-colors";
import type { PanelThemeOverrides } from "../admin/panel-colors";

/**
 * 'panelthemechange' event'ini dinler; override'lar geldiğinde
 * :root üzerindeki --seg-* CSS değişkenlerini günceller.
 * [data-panel="..."] kapsamlarındaki var(--panel-accent) referansları
 * otomatik olarak yeni değerlere göre yeniden hesaplanır — reload YOK.
 */
export function usePanelThemeLiveReload(): void {
  useEffect(() => {
    function handleThemeChange(e: Event): void {
      const overrides = (e as CustomEvent<PanelThemeOverrides>).detail ?? {};
      const resolved = resolvePanelColors(overrides);
      const root = document.documentElement;
      Object.values(resolved).forEach((theme) => {
        root.style.setProperty(`--seg-${theme.key}`, theme.accent);
        root.style.setProperty(`--seg-${theme.key}-dark`, theme.accentDark);
        root.style.setProperty(`--seg-${theme.key}-tint`, theme.accentTint);
      });
    }

    window.addEventListener(PANEL_THEME_EVENT, handleThemeChange);
    return () => window.removeEventListener(PANEL_THEME_EVENT, handleThemeChange);
  }, []);
}

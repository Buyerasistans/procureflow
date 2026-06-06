import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
}

const SITE_KEY = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TURNSTILE_SITE_KEY;

export default function TurnstileWidget({ onSuccess, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (!SITE_KEY) {
      onSuccess("dev-turnstile-bypass");
      return;
    }
    if (rendered.current) return;

    function doRender() {
      if (!containerRef.current || rendered.current) return;
      rendered.current = true;
      widgetIdRef.current =
        window.turnstile?.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => onSuccess(token),
          "error-callback": () => {
            rendered.current = false;
            widgetIdRef.current = null;
            onError?.();
          },
          "expired-callback": () => {
            rendered.current = false;
            widgetIdRef.current = null;
          },
        }) ?? null;
    }

    if (window.turnstile) {
      doRender();
    } else {
      const id = "cf-turnstile-script";
      if (!document.getElementById(id)) {
        const script = document.createElement("script");
        script.id = id;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.onload = doRender;
        document.head.appendChild(script);
      } else {
        const wait = setInterval(() => {
          if (window.turnstile) { clearInterval(wait); doRender(); }
        }, 100);
      }
    }
  }, []);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} style={{ margin: "4px 0" }} />;
}

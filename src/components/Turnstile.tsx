// Client-only: rendered from client components (AuthForm, BookingWizard), so no "use client" entry here.
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare Turnstile widget. Inside a <form> it adds a hidden "cf-turnstile-response" input;
 * `onToken` also receives the token for forms submitted from JavaScript.
 * Change `resetKey` after a submit: each token can be used only once.
 */
export function Turnstile({
  siteKey,
  action,
  locale,
  onToken,
  resetKey,
}: {
  siteKey: string;
  action: "login" | "register" | "booking";
  locale: "bg" | "en";
  onToken?: (token: string | null) => void;
  resetKey?: unknown;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const tokenCb = useRef(onToken);
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.turnstile);

  useEffect(() => {
    tokenCb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!ready || !box.current || !window.turnstile) return;
    const id = window.turnstile.render(box.current, {
      sitekey: siteKey,
      action,
      language: locale,
      theme: "light",
      size: "flexible",
      callback: (t: string) => tokenCb.current?.(t),
      "expired-callback": () => tokenCb.current?.(null),
      "error-callback": () => tokenCb.current?.(null),
    });
    widget.current = id;
    return () => {
      window.turnstile?.remove(id);
      widget.current = null;
    };
  }, [ready, siteKey, action, locale]);

  useEffect(() => {
    if (resetKey === undefined || !widget.current) return;
    window.turnstile?.reset(widget.current);
    tokenCb.current?.(null);
  }, [resetKey]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div ref={box} className="min-h-[65px]" />
    </>
  );
}

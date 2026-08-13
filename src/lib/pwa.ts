import { useEffect, useState } from "react";

/**
 * PWA-installatie: service worker registreren en het installatiemoment
 * beschikbaar maken.
 *
 * Chrome/Edge geven een `beforeinstallprompt`-event dat je moet bewaren om het
 * later zelf te kunnen tonen. Safari op iOS kent dat event niet — daar moet de
 * gebruiker via Deel → "Zet op beginscherm", dus daar tonen we een uitleg.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registratie mislukt (bv. onbeveiligde context) — de app werkt gewoon door.
    });
  };

  // React hydrateert doorgaans ná het load-event; dan zou een load-listener
  // nooit meer afgaan en registreerde de worker zich dus niet.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

/** Draait de app als geïnstalleerde app (standalone) i.p.v. in een tab? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari gebruikt een eigen vlag.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export interface InstallState {
  /** Kan de installatiebalk nu getoond worden? */
  canInstall: boolean;
  /** Draait de app al als geïnstalleerde app? */
  installed: boolean;
  /** Heeft de browser een installatie-prompt klaarstaan? */
  promptReady: boolean;
  /** iOS heeft geen prompt-API; daar tonen we een instructie. */
  isIos: boolean;
  /** Safari op iOS heeft het deel-icoon onderin; andere iOS-browsers in het menu. */
  isIosSafari: boolean;
  /** Al geïnstalleerd of al weggeklikt. */
  dismissed: boolean;
  install: () => Promise<void>;
  dismiss: () => void;
}

const DISMISS_KEY = "elevate-pwa-dismissed-until";
/** Wegklikken verbergt de balk tijdelijk, niet voorgoed. */
const DISMISS_DAYS = 7;

export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      setDismissed(Number.isFinite(until) && until > Date.now());
    } catch {
      /* localStorage geblokkeerd — dan tonen we de knop gewoon */
    }

    const onPrompt = (e: Event) => {
      // Voorkom de standaardbalk van de browser; we tonen onze eigen knop.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Elk iOS-browsermerk (Safari, Chrome, Firefox, Edge) draait op WebKit en kent
  // géén installatie-API — Apple staat alleen Deel → "Zet op beginscherm" toe.
  // Eerder sloten we CriOS/FxiOS uit, waardoor die browsers de Android-uitleg
  // kregen. iPadOS meldt zich als "Macintosh" met touch, dus die vangen we apart.
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);

  // Safari is de enige iOS-browser zonder CriOS/FxiOS/EdgiOS in de UA.
  const isIosSafari = isIos && !/crios|fxios|edgios|opt\//i.test(ua);

  return {
    canInstall: !installed && !dismissed && (!!deferred || isIos),
    installed,
    promptReady: !!deferred,
    isIos,
    isIosSafari,
    dismissed: installed || dismissed,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    },
    dismiss: () => {
      setDismissed(true);
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000));
      } catch {
        /* niets te bewaren — knop komt volgende sessie terug */
      }
    },
  };
}

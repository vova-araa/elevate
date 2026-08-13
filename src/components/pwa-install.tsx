import { useState } from "react";
import { Download, X, Share } from "lucide-react";
import { useInstallPrompt } from "@/lib/pwa";

/**
 * Installatiebalk, alleen op mobiel en alleen zolang de app nog niet is
 * geïnstalleerd. Zodra hij geïnstalleerd is (of weggeklikt) verdwijnt hij.
 */
export function PwaInstall() {
  const { canInstall, isIos, isIosSafari, install, dismiss } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (!canInstall) return null;

  return (
    <>
      {/* md:hidden = uitsluitend op telefoon/tablet */}
      <div className="fixed inset-x-3 bottom-[76px] z-40 md:hidden">
        <div className="flex items-center gap-3 rounded-2xl border border-gold/25 bg-card/95 p-3 shadow-elegant backdrop-blur">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
            <Download className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Zet Elevate op je beginscherm</div>
            <div className="text-xs text-muted-foreground">Opent als app, zonder browserbalk.</div>
          </div>
          <button
            onClick={() => (isIos ? setShowIosHelp(true) : install())}
            className="min-h-11 shrink-0 rounded-full bg-gradient-gold px-4 text-sm font-medium text-primary-foreground"
          >
            Installeer
          </button>
          <button
            onClick={dismiss}
            aria-label="Niet installeren"
            className="grid h-11 w-8 shrink-0 place-items-center text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* iOS kent geen installatie-prompt; daar leggen we de stappen uit. */}
      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full space-y-4 rounded-t-3xl border border-gold/20 bg-card p-6"
          >
            <div className="font-display text-xl">Toevoegen aan beginscherm</div>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Share className="h-4 w-4 shrink-0 text-gold" />
                {isIosSafari
                  ? "Tik onderin op het deel-icoon."
                  : "Tik op het menu (⋯ of ⋮) en kies Delen."}
              </li>
              <li>Kies &quot;Zet op beginscherm&quot;.</li>
              <li>Tik rechtsboven op &quot;Voeg toe&quot;.</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Apple staat niet toe dat een website dit zelf start — dit is op iPhone de enige weg.
            </p>
            <button
              onClick={() => {
                setShowIosHelp(false);
                dismiss();
              }}
              className="min-h-11 w-full rounded-xl bg-gradient-gold text-sm font-medium text-primary-foreground"
            >
              Begrepen
            </button>
          </div>
        </div>
      )}
    </>
  );
}

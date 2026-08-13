import { useState } from "react";
import { Check, Download, Share, Smartphone } from "lucide-react";
import { useInstallPrompt } from "@/lib/pwa";

/**
 * Vaste ingang om de app te installeren, altijd bereikbaar via Instellingen.
 *
 * De balk onderin verschijnt alleen op het juiste moment (en kun je wegklikken);
 * hier kun je het altijd alsnog doen. Browsers geven hun installatie-prompt
 * niet op commando vrij, dus als die er niet is leggen we uit waar je hem in
 * het browsermenu vindt.
 */
export function InstallAppSetting() {
  const { installed, promptReady, isIos, isIosSafari, install } = useInstallPrompt();
  const [done, setDone] = useState(false);

  return (
    <div className="rounded-xl border border-gold/10 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg">
            <Smartphone className="h-4 w-4 text-gold" />
            App op je telefoon
          </h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {installed
              ? "De app is geïnstalleerd — je gebruikt hem nu als app."
              : "Zet Elevate op je beginscherm: opent als app, zonder browserbalk."}
          </p>
        </div>

        {installed ? (
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 text-sm text-emerald-500">
            <Check className="h-4 w-4" /> Geïnstalleerd
          </span>
        ) : promptReady ? (
          <button
            onClick={async () => {
              await install();
              setDone(true);
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-gradient-gold px-4 text-sm font-medium text-primary-foreground"
          >
            <Download className="h-4 w-4" /> Installeren
          </button>
        ) : null}
      </div>

      {done && !installed && (
        <p className="mt-3 text-xs text-muted-foreground">
          Installatie gestart — volg de melding van je browser.
        </p>
      )}

      {/* Geen prompt beschikbaar: uitleggen waar het in de browser zit. */}
      {!installed && !promptReady && (
        <div className="mt-4 rounded-lg bg-surface-elevated/50 p-4 text-sm">
          {isIos ? (
            <>
              <div className="mb-2 font-medium">Op iPhone of iPad</div>
              <ol className="space-y-1.5 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Share className="h-4 w-4 shrink-0 text-gold" />
                  {isIosSafari
                    ? "Tik onderin op het deel-icoon."
                    : "Tik op het menu (⋯ of ⋮) en kies Delen."}
                </li>
                <li>Kies &quot;Zet op beginscherm&quot;.</li>
                <li>Tik rechtsboven op &quot;Voeg toe&quot;.</li>
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                Apple staat niet toe dat een website het installeren zelf start; op iPhone is dit de
                enige manier. Op Android gaat het wél met één knop.
              </p>
            </>
          ) : (
            <>
              <div className="mb-2 font-medium">Via het browsermenu</div>
              <ol className="space-y-1.5 text-muted-foreground">
                <li>Open het menu van je browser (de drie puntjes).</li>
                <li>Kies &quot;App installeren&quot; of &quot;Toevoegen aan startscherm&quot;.</li>
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                Staat die optie er niet? Dan is de app al geïnstalleerd, of je browser ondersteunt
                het niet — probeer Chrome of Edge.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

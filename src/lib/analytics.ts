/**
 * Dunne wrapper om Plausible-events te versturen (S04). Werkt zonder dat het
 * Plausible-script al geladen is — dan is het gewoon een no-op, nooit een
 * fout die een knop of formulier laat vastlopen.
 */
type PlausibleFn = (event: string, options?: { props?: Record<string, string> }) => void;

export function track(event: string, props?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  const plausible = (window as unknown as { plausible?: PlausibleFn }).plausible;
  try {
    plausible?.(event, props ? { props } : undefined);
  } catch {
    // Analytics mag nooit de eigenlijke actie breken.
  }
}

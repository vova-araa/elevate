/**
 * Uploadlimieten op één plek.
 *
 * De harde grens ligt bij Supabase Storage zelf (project-instelling
 * "Upload file size limit"): op het gratis plan is dat 50 MB, op Pro kun je die
 * fors hoger zetten. Deze waarde moet daarmee overeenkomen — staat hij hier
 * hoger dan bij Supabase, dan weigert de opslag het bestand alsnog.
 *
 * Verhogen doe je zonder codewijziging via de omgevingsvariabele
 * VITE_MAX_UPLOAD_MB (bijv. "500"), nadat je de limiet in Supabase hebt
 * opgehoogd onder Storage → Settings.
 */
const parsed = Number(import.meta.env?.VITE_MAX_UPLOAD_MB);

export const MAX_UPLOAD_MB = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Nette, uitlegbare foutmelding wanneer een bestand te groot is. */
export function tooLargeMessage(fileName: string): string {
  return `${fileName} is te groot (max ${MAX_UPLOAD_MB} MB). Verhoog de uploadlimiet in Supabase (Storage → Settings) en zet VITE_MAX_UPLOAD_MB gelijk, of verklein de video.`;
}

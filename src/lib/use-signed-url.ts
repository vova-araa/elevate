import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tijdelijke ondertekende URL (1 uur) voor een bestand in de PRIVATE
 * `client-uploads`-bucket. Geeft `null` zolang er geen pad is of terwijl de URL
 * nog geladen wordt. Vervangt het oude `getPublicUrl` nu de bucket privé is.
 */
export function useSignedUrl(
  path: string | null | undefined,
  bucket = "client-uploads",
): string | null {
  return useSignedUrlState(path, bucket).url;
}

export interface SignedUrlState {
  url: string | null;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

/**
 * Zelfde als `useSignedUrl`, maar mét laad- en foutstatus.
 *
 * Nodig omdat "nog aan het laden" en "mislukt" allebei als `null` terugkwamen.
 * Componenten toonden daardoor een spinner die bij een fout eeuwig bleef
 * draaien — in de goedkeuringsflow van de klant zag die dan nooit zijn beeld,
 * zonder enige melding.
 */
export function useSignedUrlState(
  path: string | null | undefined,
  bucket = "client-uploads",
): SignedUrlState {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    // Vernieuw de URL proactief net onder de geldigheidsduur van 1 uur, zodat
    // een langdurig geopend scherm geen verlopen link toont.
    staleTime: 55 * 60 * 1000,
    refetchInterval: 55 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 3600);
      // Doorgooien in plaats van null teruggeven: anders kan de aanroeper een
      // mislukking niet van "nog bezig" onderscheiden.
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return {
    url: data ?? null,
    isLoading: !!path && isLoading,
    isError,
    retry: () => void refetch(),
  };
}

/**
 * Zelfde als `useSignedUrl`, maar voor een hele grid in ÉÉN verzoek.
 *
 * Een mediabibliotheek met 200 tegels deed voorheen 200 losse
 * `createSignedUrl`-aanroepen (elk een eigen HTTP-request). `createSignedUrls`
 * (meervoud) doet dat in één keer. Geeft een Map terug van pad → URL.
 */
export function useSignedUrls(
  paths: Array<string | null | undefined>,
  bucket = "client-uploads",
): Map<string, string> {
  // Stabiele sleutel: gesorteerd en ontdubbeld, zodat dezelfde set tegels
  // (ongeacht volgorde) dezelfde cache-entry deelt.
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p))).sort();

  const { data } = useQuery({
    queryKey: ["signed-urls", bucket, unique],
    enabled: unique.length > 0,
    staleTime: 55 * 60 * 1000,
    refetchInterval: 55 * 60 * 1000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, 3600);
      if (error || !data) return new Map<string, string>();
      const map = new Map<string, string>();
      for (const row of data) {
        // Supabase geeft per pad een eigen (mogelijke) fout terug; sla die over.
        if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
      }
      return map;
    },
  });

  return data ?? new Map<string, string>();
}

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
  const { data } = useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    // Vernieuw de URL proactief net onder de geldigheidsduur van 1 uur, zodat
    // een langdurig geopend scherm geen verlopen link toont.
    staleTime: 55 * 60 * 1000,
    refetchInterval: 55 * 60 * 1000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 3600);
      if (error) return null;
      return data.signedUrl;
    },
  });
  return data ?? null;
}

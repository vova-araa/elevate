import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Eén server-side bron voor "welke klant kijk ik nu naar" in het klantportaal
 * (A01). Voorheen bepaalde elke /client/*-pagina dit zelf — negen kopieën,
 * en zeven daarvan negeerden ?asClient volledig.
 *
 * Volgorde: (1) expliciete ?asClient, maar alleen als de aanroeper admin of
 * super_admin is — dat wordt hier server-side gecontroleerd (is_admin(), niet
 * de client-side rol), anders is het een IDOR; (2) de eigen klantkoppeling;
 * (3) geen van beide.
 */
export interface ActiveClientContext {
  clientId: string | null;
  clientName: string | null;
  isAdmin: boolean;
  previewing: boolean;
}

export const getActiveClientContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ asClient: z.string().uuid().optional() }).parse(d))
  .handler(async ({ context, data }): Promise<ActiveClientContext> => {
    const { supabase, userId } = context;
    const { data: adminCheck } = await supabase.rpc("is_admin", { _user_id: userId });
    const isAdmin = !!adminCheck;

    if (data.asClient && isAdmin) {
      const { data: client } = await supabase
        .from("clients")
        .select("id, name")
        .eq("id", data.asClient)
        .maybeSingle();
      // Klant niet (meer) gevonden: val terug op een lege staat, niet op een
      // foutpagina — de id kan verouderd zijn (verwijderde klant, oude link).
      return {
        clientId: client?.id ?? null,
        clientName: client?.name ?? null,
        isAdmin,
        previewing: true,
      };
    }

    const { data: membership } = await supabase
      .from("client_members")
      .select("client_id, clients(name)")
      .eq("user_id", userId)
      .order("client_id")
      .limit(1)
      .maybeSingle();

    return {
      clientId: membership?.client_id ?? null,
      clientName: membership?.clients?.name ?? null,
      isAdmin,
      // asClient was gezet maar de aanroeper is geen admin: negeer hem
      // stilletjes (val terug op de eigen koppeling) in plaats van te foutmelden.
      previewing: false,
    };
  });

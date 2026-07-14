import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/uploads")({ component: ClientUploads });

function ClientUploads() {
  const qc = useQueryClient();
  const { data: members } = useQuery({
    queryKey: ["my-clients"],
    queryFn: async () => (await supabase.from("client_members").select("client_id, clients(id,name)")).data ?? [],
  });
  const [clientId, setClientId] = useState<string>("");
  useEffect(() => { if (!clientId && members && members[0]) setClientId(members[0].client_id); }, [members, clientId]);

  const { data: uploads } = useQuery({
    queryKey: ["uploads-client", clientId], enabled: !!clientId,
    queryFn: async () => (await supabase.from("uploads").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!clientId) return;
    const files = Array.from(e.target.files ?? []);
    const { data: u } = await supabase.auth.getUser();
    for (const file of files) {
      const path = `${clientId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("client-uploads").upload(path, file);
      if (error) { toast.error(error.message); continue; }
      await supabase.from("uploads").insert({
        client_id: clientId, file_path: path, file_name: file.name,
        file_type: file.type, file_size: file.size, uploader_id: u.user?.id ?? null,
      });
    }
    toast.success("Geüpload — admin krijgt notificatie");
    qc.invalidateQueries({ queryKey: ["uploads-client", clientId] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Beeld & video</p>
          <h1 className="font-display text-5xl mt-2">Uploads</h1>
        </div>
        {members && members.length > 1 && (
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="rounded-lg bg-input/60 hairline px-4 py-2 text-sm">
            {members.map((m: any) => <option key={m.client_id} value={m.client_id}>{m.clients?.name}</option>)}
          </select>
        )}
      </div>

      <label className="glass-strong block rounded-2xl border-2 border-dashed border-gold/30 p-10 text-center cursor-pointer hover:border-gold/60">
        <Plus className="h-6 w-6 mx-auto text-gold" />
        <div className="mt-2 text-sm">Sleep of klik om beeld of video toe te voegen</div>
        <input type="file" multiple accept="image/*,video/*" onChange={handleFile} className="hidden" />
      </label>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {uploads?.map((u: any) => <Tile key={u.id} u={u} />)}
      </div>
    </div>
  );
}

function Tile({ u }: { u: any }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    supabase.storage.from("client-uploads").createSignedUrl(u.file_path, 3600).then(({ data }) => setUrl(data?.signedUrl || ""));
  }, [u.file_path]);
  const isVideo = u.file_type?.startsWith("video/");
  return (
    <a href={url} target="_blank" className="group block aspect-square overflow-hidden rounded-xl glass relative">
      {url && (isVideo
        ? <video src={url} className="h-full w-full object-cover" />
        : <img src={url} alt={u.file_name} className="h-full w-full object-cover transition group-hover:scale-105" />)}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="text-xs text-white/90 truncate">{u.file_name}</div>
      </div>
    </a>
  );
}

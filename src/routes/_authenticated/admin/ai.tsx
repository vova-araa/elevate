import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, FlaskConical, MessageSquareQuote, Recycle, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssistantTab } from "@/components/ai-studio/assistant-tab";
import { CaptionsAbTab } from "@/components/ai-studio/captions-ab-tab";
import { ToneOfVoiceTab } from "@/components/ai-studio/tone-of-voice-tab";
import { RepurposeTab } from "@/components/ai-studio/repurpose-tab";
import { HooksHashtagsTab } from "@/components/ai-studio/hooks-hashtags-tab";

export const Route = createFileRoute("/_authenticated/admin/ai")({ component: AiStudioPage });

function AiStudioPage() {
  const { data: clients = [] } = useQuery({
    queryKey: ["ai-studio-clients"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name,industry").order("name")).data ?? [],
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-gold grid place-items-center text-primary-foreground">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl leading-tight">AI Studio</h1>
          <p className="text-xs text-muted-foreground">
            Assistent, caption-varianten, tone-of-voice, hergebruik en hooks & hashtags
          </p>
        </div>
      </header>

      <Tabs defaultValue="assistent">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="assistent" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            Assistent
          </TabsTrigger>
          <TabsTrigger value="captions" className="gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            Captions A/B
          </TabsTrigger>
          <TabsTrigger value="tone" className="gap-1.5">
            <MessageSquareQuote className="h-3.5 w-3.5" />
            Tone-of-voice
          </TabsTrigger>
          <TabsTrigger value="repurpose" className="gap-1.5">
            <Recycle className="h-3.5 w-3.5" />
            Hergebruik
          </TabsTrigger>
          <TabsTrigger value="hooks" className="gap-1.5">
            <Hash className="h-3.5 w-3.5" />
            Hooks & Hashtags
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assistent" className="mt-4">
          <AssistantTab />
        </TabsContent>
        <TabsContent value="captions" className="mt-4">
          <CaptionsAbTab clients={clients} />
        </TabsContent>
        <TabsContent value="tone" className="mt-4">
          <ToneOfVoiceTab clients={clients} />
        </TabsContent>
        <TabsContent value="repurpose" className="mt-4">
          <RepurposeTab clients={clients} />
        </TabsContent>
        <TabsContent value="hooks" className="mt-4">
          <HooksHashtagsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

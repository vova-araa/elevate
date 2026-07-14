export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_generations: {
        Row: {
          briefing: string;
          client_id: string | null;
          created_at: string;
          generated_text: string;
          id: string;
          platform: string;
          tone: string;
          user_id: string | null;
        };
        Insert: {
          briefing: string;
          client_id?: string | null;
          created_at?: string;
          generated_text: string;
          id?: string;
          platform: string;
          tone?: string;
          user_id?: string | null;
        };
        Update: {
          briefing?: string;
          client_id?: string | null;
          created_at?: string;
          generated_text?: string;
          id?: string;
          platform?: string;
          tone?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generations_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      api_keys: {
        Row: {
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          key_hash: string;
          key_prefix: string;
          last_used_at: string | null;
          name: string;
          scopes: string[];
          updated_at: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          key_hash: string;
          key_prefix: string;
          last_used_at?: string | null;
          name: string;
          scopes?: string[];
          updated_at?: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          key_hash?: string;
          key_prefix?: string;
          last_used_at?: string | null;
          name?: string;
          scopes?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_rules: {
        Row: {
          action_config: Json;
          action_type: Database["public"]["Enums"]["automation_action"];
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          last_run_at: string | null;
          name: string;
          run_count: number;
          trigger_config: Json;
          trigger_type: Database["public"]["Enums"]["automation_trigger"];
          updated_at: string;
        };
        Insert: {
          action_config?: Json;
          action_type: Database["public"]["Enums"]["automation_action"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          last_run_at?: string | null;
          name: string;
          run_count?: number;
          trigger_config?: Json;
          trigger_type: Database["public"]["Enums"]["automation_trigger"];
          updated_at?: string;
        };
        Update: {
          action_config?: Json;
          action_type?: Database["public"]["Enums"]["automation_action"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          last_run_at?: string | null;
          name?: string;
          run_count?: number;
          trigger_config?: Json;
          trigger_type?: Database["public"]["Enums"]["automation_trigger"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automation_rules_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_runs: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          payload: Json;
          rule_id: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          payload?: Json;
          rule_id?: string | null;
          status: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          payload?: Json;
          rule_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automation_runs_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "automation_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      best_time_benchmarks: {
        Row: {
          day_of_week: number;
          id: string;
          platform: Database["public"]["Enums"]["social_platform"];
          rationale: string | null;
          score: number;
          time_of_day: string;
        };
        Insert: {
          day_of_week: number;
          id?: string;
          platform: Database["public"]["Enums"]["social_platform"];
          rationale?: string | null;
          score?: number;
          time_of_day: string;
        };
        Update: {
          day_of_week?: number;
          id?: string;
          platform?: Database["public"]["Enums"]["social_platform"];
          rationale?: string | null;
          score?: number;
          time_of_day?: string;
        };
        Relationships: [];
      };
      calendar_items: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          date: string;
          deliverable_type: Database["public"]["Enums"]["deliverable_type"];
          description: string | null;
          id: string;
          status: Database["public"]["Enums"]["calendar_status"];
          step_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          date: string;
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"];
          description?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["calendar_status"];
          step_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"];
          description?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["calendar_status"];
          step_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_items_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_items_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_steps";
            referencedColumns: ["id"];
          },
        ];
      };
      client_intakes: {
        Row: {
          brand_awareness_score: number | null;
          brand_name: string;
          brand_values: string | null;
          budget_range: string | null;
          client_id: string | null;
          competitors: string | null;
          content_pillars: string | null;
          created_at: string;
          created_by: string | null;
          extra_notes: string | null;
          facebook: Json | null;
          goals_12_months: string | null;
          goals_3_months: string | null;
          has_copywriter: boolean | null;
          has_photographer: boolean | null;
          has_videographer: boolean | null;
          id: string;
          industry: string | null;
          influencer_history: string | null;
          instagram: Json | null;
          internal_team_notes: string | null;
          kpis: string | null;
          linkedin: Json | null;
          main_goal: string | null;
          paid_ads_history: string | null;
          perceived_strengths: string | null;
          perceived_weaknesses: string | null;
          posting_frequency: string | null;
          preferred_formats: string | null;
          status: string;
          target_audience: string | null;
          tiktok: Json | null;
          tone_of_voice: string | null;
          top_performing_content: string | null;
          updated_at: string;
          usp: string | null;
          website: string | null;
          worst_performing_content: string | null;
          youtube: Json | null;
        };
        Insert: {
          brand_awareness_score?: number | null;
          brand_name: string;
          brand_values?: string | null;
          budget_range?: string | null;
          client_id?: string | null;
          competitors?: string | null;
          content_pillars?: string | null;
          created_at?: string;
          created_by?: string | null;
          extra_notes?: string | null;
          facebook?: Json | null;
          goals_12_months?: string | null;
          goals_3_months?: string | null;
          has_copywriter?: boolean | null;
          has_photographer?: boolean | null;
          has_videographer?: boolean | null;
          id?: string;
          industry?: string | null;
          influencer_history?: string | null;
          instagram?: Json | null;
          internal_team_notes?: string | null;
          kpis?: string | null;
          linkedin?: Json | null;
          main_goal?: string | null;
          paid_ads_history?: string | null;
          perceived_strengths?: string | null;
          perceived_weaknesses?: string | null;
          posting_frequency?: string | null;
          preferred_formats?: string | null;
          status?: string;
          target_audience?: string | null;
          tiktok?: Json | null;
          tone_of_voice?: string | null;
          top_performing_content?: string | null;
          updated_at?: string;
          usp?: string | null;
          website?: string | null;
          worst_performing_content?: string | null;
          youtube?: Json | null;
        };
        Update: {
          brand_awareness_score?: number | null;
          brand_name?: string;
          brand_values?: string | null;
          budget_range?: string | null;
          client_id?: string | null;
          competitors?: string | null;
          content_pillars?: string | null;
          created_at?: string;
          created_by?: string | null;
          extra_notes?: string | null;
          facebook?: Json | null;
          goals_12_months?: string | null;
          goals_3_months?: string | null;
          has_copywriter?: boolean | null;
          has_photographer?: boolean | null;
          has_videographer?: boolean | null;
          id?: string;
          industry?: string | null;
          influencer_history?: string | null;
          instagram?: Json | null;
          internal_team_notes?: string | null;
          kpis?: string | null;
          linkedin?: Json | null;
          main_goal?: string | null;
          paid_ads_history?: string | null;
          perceived_strengths?: string | null;
          perceived_weaknesses?: string | null;
          posting_frequency?: string | null;
          preferred_formats?: string | null;
          status?: string;
          target_audience?: string | null;
          tiktok?: Json | null;
          tone_of_voice?: string | null;
          top_performing_content?: string | null;
          updated_at?: string;
          usp?: string | null;
          website?: string | null;
          worst_performing_content?: string | null;
          youtube?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_intakes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      client_members: {
        Row: {
          client_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      client_secrets: {
        Row: {
          client_id: string;
          created_at: string;
          postiz_api_key: string | null;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          postiz_api_key?: string | null;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          postiz_api_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_secrets_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          brand_color: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          facebook_url: string | null;
          id: string;
          industry: string | null;
          instagram_url: string | null;
          linkedin_url: string | null;
          logo_url: string | null;
          name: string;
          notes: string | null;
          postiz_organization_id: string | null;
          provisioned_at: string | null;
          tiktok_url: string | null;
          updated_at: string;
          website: string | null;
          youtube_url: string | null;
        };
        Insert: {
          brand_color?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          facebook_url?: string | null;
          id?: string;
          industry?: string | null;
          instagram_url?: string | null;
          linkedin_url?: string | null;
          logo_url?: string | null;
          name: string;
          notes?: string | null;
          postiz_organization_id?: string | null;
          provisioned_at?: string | null;
          tiktok_url?: string | null;
          updated_at?: string;
          website?: string | null;
          youtube_url?: string | null;
        };
        Update: {
          brand_color?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          facebook_url?: string | null;
          id?: string;
          industry?: string | null;
          instagram_url?: string | null;
          linkedin_url?: string | null;
          logo_url?: string | null;
          name?: string;
          notes?: string | null;
          postiz_organization_id?: string | null;
          provisioned_at?: string | null;
          tiktok_url?: string | null;
          updated_at?: string;
          website?: string | null;
          youtube_url?: string | null;
        };
        Relationships: [];
      };
      connection_errors: {
        Row: {
          client_id: string;
          created_at: string;
          error_message: string;
          id: string;
          platform: Database["public"]["Enums"]["social_platform"];
        };
        Insert: {
          client_id: string;
          created_at?: string;
          error_message: string;
          id?: string;
          platform: Database["public"]["Enums"]["social_platform"];
        };
        Update: {
          client_id?: string;
          created_at?: string;
          error_message?: string;
          id?: string;
          platform?: Database["public"]["Enums"]["social_platform"];
        };
        Relationships: [
          {
            foreignKeyName: "connection_errors_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      content_items: {
        Row: {
          assignee_id: string | null;
          channel: Database["public"]["Enums"]["content_channel"];
          client_id: string;
          concept: string | null;
          copy: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          hashtags: string | null;
          id: string;
          published_at: string | null;
          scheduled_at: string | null;
          status: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          assignee_id?: string | null;
          channel?: Database["public"]["Enums"]["content_channel"];
          client_id: string;
          concept?: string | null;
          copy?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          hashtags?: string | null;
          id?: string;
          published_at?: string | null;
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          channel?: Database["public"]["Enums"]["content_channel"];
          client_id?: string;
          concept?: string | null;
          copy?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          hashtags?: string | null;
          id?: string;
          published_at?: string | null;
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      deals: {
        Row: {
          client_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string | null;
          description: string | null;
          expected_close_date: string | null;
          id: string;
          notes: string | null;
          owner_id: string | null;
          probability: number | null;
          stage: Database["public"]["Enums"]["deal_stage"];
          title: string;
          updated_at: string;
          value_cents: number | null;
        };
        Insert: {
          client_id: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string | null;
          description?: string | null;
          expected_close_date?: string | null;
          id?: string;
          notes?: string | null;
          owner_id?: string | null;
          probability?: number | null;
          stage?: Database["public"]["Enums"]["deal_stage"];
          title: string;
          updated_at?: string;
          value_cents?: number | null;
        };
        Update: {
          client_id?: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string | null;
          description?: string | null;
          expected_close_date?: string | null;
          id?: string;
          notes?: string | null;
          owner_id?: string | null;
          probability?: number | null;
          stage?: Database["public"]["Enums"]["deal_stage"];
          title?: string;
          updated_at?: string;
          value_cents?: number | null;
        };
        Relationships: [];
      };
      evaluations: {
        Row: {
          body: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          improvements: string | null;
          next_steps: string | null;
          period_label: string | null;
          score: number | null;
          strengths: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          body?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          improvements?: string | null;
          next_steps?: string | null;
          period_label?: string | null;
          score?: number | null;
          strengths?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          improvements?: string | null;
          next_steps?: string | null;
          period_label?: string | null;
          score?: number | null;
          strengths?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_folders: {
        Row: {
          client_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_folders_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      meetings: {
        Row: {
          action_items: string | null;
          attendees: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          duration_min: number | null;
          id: string;
          location: string | null;
          meeting_type: Database["public"]["Enums"]["meeting_type"];
          notes: string | null;
          scheduled_at: string;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          action_items?: string | null;
          attendees?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          duration_min?: number | null;
          id?: string;
          location?: string | null;
          meeting_type?: Database["public"]["Enums"]["meeting_type"];
          notes?: string | null;
          scheduled_at: string;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          action_items?: string | null;
          attendees?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          duration_min?: number | null;
          id?: string;
          location?: string | null;
          meeting_type?: Database["public"]["Enums"]["meeting_type"];
          notes?: string | null;
          scheduled_at?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          body: string;
          client_id: string;
          created_at: string;
          deliverable_type: Database["public"]["Enums"]["deliverable_type"] | null;
          due_date: string | null;
          id: string;
          priority: Database["public"]["Enums"]["task_priority"];
          sender_id: string | null;
          sender_role: Database["public"]["Enums"]["message_sender_role"];
          subject: string | null;
          updated_at: string;
        };
        Insert: {
          body: string;
          client_id: string;
          created_at?: string;
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"] | null;
          due_date?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          sender_id?: string | null;
          sender_role: Database["public"]["Enums"]["message_sender_role"];
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: string;
          client_id?: string;
          created_at?: string;
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"] | null;
          due_date?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          sender_id?: string | null;
          sender_role?: Database["public"]["Enums"]["message_sender_role"];
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          email_enabled: boolean;
          id: string;
          in_app_enabled: boolean;
          notify_ai: boolean;
          notify_approval: boolean;
          notify_automation: boolean;
          notify_failure: boolean;
          notify_new_message: boolean;
          notify_new_upload: boolean;
          notify_planning: boolean;
          notify_publish: boolean;
          notify_task_assigned: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email_enabled?: boolean;
          id?: string;
          in_app_enabled?: boolean;
          notify_ai?: boolean;
          notify_approval?: boolean;
          notify_automation?: boolean;
          notify_failure?: boolean;
          notify_new_message?: boolean;
          notify_new_upload?: boolean;
          notify_planning?: boolean;
          notify_publish?: boolean;
          notify_task_assigned?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email_enabled?: boolean;
          id?: string;
          in_app_enabled?: boolean;
          notify_ai?: boolean;
          notify_approval?: boolean;
          notify_automation?: boolean;
          notify_failure?: boolean;
          notify_new_message?: boolean;
          notify_new_upload?: boolean;
          notify_planning?: boolean;
          notify_publish?: boolean;
          notify_task_assigned?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read: boolean;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read?: boolean;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read?: boolean;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      post_comments: {
        Row: {
          author_id: string;
          author_role: string;
          body: string;
          client_id: string;
          created_at: string;
          id: string;
          post_id: string;
        };
        Insert: {
          author_id: string;
          author_role?: string;
          body: string;
          client_id: string;
          created_at?: string;
          id?: string;
          post_id: string;
        };
        Update: {
          author_id?: string;
          author_role?: string;
          body?: string;
          client_id?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_comments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          company: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      provision_queue: {
        Row: {
          attempts: number;
          client_id: string;
          created_at: string;
          error_message: string | null;
          id: string;
          last_attempt_at: string | null;
          status: Database["public"]["Enums"]["provision_status"];
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          client_id: string;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          last_attempt_at?: string | null;
          status?: Database["public"]["Enums"]["provision_status"];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          client_id?: string;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          last_attempt_at?: string | null;
          status?: Database["public"]["Enums"]["provision_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provision_queue_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      queue_slots: {
        Row: {
          client_id: string;
          created_at: string;
          day_of_week: number;
          id: string;
          platform: Database["public"]["Enums"]["social_platform"];
          time_of_day: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          day_of_week: number;
          id?: string;
          platform: Database["public"]["Enums"]["social_platform"];
          time_of_day: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          day_of_week?: number;
          id?: string;
          platform?: Database["public"]["Enums"]["social_platform"];
          time_of_day?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          file_path: string | null;
          highlights: string | null;
          id: string;
          metrics: Json | null;
          period_end: string | null;
          period_start: string | null;
          report_type: Database["public"]["Enums"]["report_type"];
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          file_path?: string | null;
          highlights?: string | null;
          id?: string;
          metrics?: Json | null;
          period_end?: string | null;
          period_start?: string | null;
          report_type?: Database["public"]["Enums"]["report_type"];
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          file_path?: string | null;
          highlights?: string | null;
          id?: string;
          metrics?: Json | null;
          period_end?: string | null;
          period_start?: string | null;
          report_type?: Database["public"]["Enums"]["report_type"];
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      roadmap_steps: {
        Row: {
          created_at: string;
          deliverable_type: Database["public"]["Enums"]["deliverable_type"] | null;
          description: string | null;
          due_date: string | null;
          id: string;
          roadmap_id: string;
          status: Database["public"]["Enums"]["step_status"];
          step_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"] | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          roadmap_id: string;
          status?: Database["public"]["Enums"]["step_status"];
          step_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"] | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          roadmap_id?: string;
          status?: Database["public"]["Enums"]["step_status"];
          step_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_steps_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmaps";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmaps: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          status: Database["public"]["Enums"]["roadmap_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["roadmap_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["roadmap_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmaps_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_posts: {
        Row: {
          caption: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          error_message: string | null;
          id: string;
          is_queued: boolean;
          media_path: string | null;
          media_type: string | null;
          notes: string | null;
          parent_recurring_id: string | null;
          platform: Database["public"]["Enums"]["social_platform"];
          platform_container_id: string | null;
          platform_post_id: string | null;
          published_at: string | null;
          recurring_rule: Json | null;
          scheduled_at: string;
          status: Database["public"]["Enums"]["scheduled_post_status"];
          updated_at: string;
        };
        Insert: {
          caption?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          error_message?: string | null;
          id?: string;
          is_queued?: boolean;
          media_path?: string | null;
          media_type?: string | null;
          notes?: string | null;
          parent_recurring_id?: string | null;
          platform?: Database["public"]["Enums"]["social_platform"];
          platform_container_id?: string | null;
          platform_post_id?: string | null;
          published_at?: string | null;
          recurring_rule?: Json | null;
          scheduled_at: string;
          status?: Database["public"]["Enums"]["scheduled_post_status"];
          updated_at?: string;
        };
        Update: {
          caption?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          error_message?: string | null;
          id?: string;
          is_queued?: boolean;
          media_path?: string | null;
          media_type?: string | null;
          notes?: string | null;
          parent_recurring_id?: string | null;
          platform?: Database["public"]["Enums"]["social_platform"];
          platform_container_id?: string | null;
          platform_post_id?: string | null;
          published_at?: string | null;
          recurring_rule?: Json | null;
          scheduled_at?: string;
          status?: Database["public"]["Enums"]["scheduled_post_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      social_connections: {
        Row: {
          access_token: string | null;
          account_id: string | null;
          account_username: string | null;
          client_id: string;
          connected_at: string | null;
          connected_by: string | null;
          connection_id: string | null;
          created_at: string;
          follower_count: number | null;
          id: string;
          meta: Json;
          platform: Database["public"]["Enums"]["social_platform"];
          postiz_integration_id: string | null;
          refresh_token: string | null;
          status: Database["public"]["Enums"]["social_connection_status"];
          token_expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          access_token?: string | null;
          account_id?: string | null;
          account_username?: string | null;
          client_id: string;
          connected_at?: string | null;
          connected_by?: string | null;
          connection_id?: string | null;
          created_at?: string;
          follower_count?: number | null;
          id?: string;
          meta?: Json;
          platform: Database["public"]["Enums"]["social_platform"];
          postiz_integration_id?: string | null;
          refresh_token?: string | null;
          status?: Database["public"]["Enums"]["social_connection_status"];
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          access_token?: string | null;
          account_id?: string | null;
          account_username?: string | null;
          client_id?: string;
          connected_at?: string | null;
          connected_by?: string | null;
          connection_id?: string | null;
          created_at?: string;
          follower_count?: number | null;
          id?: string;
          meta?: Json;
          platform?: Database["public"]["Enums"]["social_platform"];
          postiz_integration_id?: string | null;
          refresh_token?: string | null;
          status?: Database["public"]["Enums"]["social_connection_status"];
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_connections_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      strategy_notes: {
        Row: {
          body: string | null;
          category: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          pinned: boolean | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          body?: string | null;
          category?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          pinned?: boolean | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          category?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          pinned?: boolean | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          assignee_id: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          priority: Database["public"]["Enums"]["task_priority"];
          status: Database["public"]["Enums"]["task_status"];
          step_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          assignee_id?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          status?: Database["public"]["Enums"]["task_status"];
          step_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          status?: Database["public"]["Enums"]["task_status"];
          step_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_steps";
            referencedColumns: ["id"];
          },
        ];
      };
      uploads: {
        Row: {
          calendar_item_id: string | null;
          caption: string | null;
          client_id: string;
          created_at: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          file_type: string | null;
          folder_id: string | null;
          id: string;
          uploader_id: string | null;
        };
        Insert: {
          calendar_item_id?: string | null;
          caption?: string | null;
          client_id: string;
          created_at?: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          file_type?: string | null;
          folder_id?: string | null;
          id?: string;
          uploader_id?: string | null;
        };
        Update: {
          calendar_item_id?: string | null;
          caption?: string | null;
          client_id?: string;
          created_at?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          file_type?: string | null;
          folder_id?: string | null;
          id?: string;
          uploader_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "uploads_calendar_item_id_fkey";
            columns: ["calendar_item_id"];
            isOneToOne: false;
            referencedRelation: "calendar_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "uploads_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "uploads_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "media_folders";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      webhook_deliveries: {
        Row: {
          created_at: string;
          endpoint_id: string | null;
          error_message: string | null;
          event: string;
          id: string;
          payload: Json;
          response_body: string | null;
          status_code: number | null;
        };
        Insert: {
          created_at?: string;
          endpoint_id?: string | null;
          error_message?: string | null;
          event: string;
          id?: string;
          payload?: Json;
          response_body?: string | null;
          status_code?: number | null;
        };
        Update: {
          created_at?: string;
          endpoint_id?: string | null;
          error_message?: string | null;
          event?: string;
          id?: string;
          payload?: Json;
          response_body?: string | null;
          status_code?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey";
            columns: ["endpoint_id"];
            isOneToOne: false;
            referencedRelation: "webhook_endpoints";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_endpoints: {
        Row: {
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          events: string[];
          failure_count: number;
          id: string;
          is_active: boolean;
          last_called_at: string | null;
          name: string;
          secret: string | null;
          updated_at: string;
          url: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          events?: string[];
          failure_count?: number;
          id?: string;
          is_active?: boolean;
          last_called_at?: string | null;
          name: string;
          secret?: string | null;
          updated_at?: string;
          url: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          events?: string[];
          failure_count?: number;
          id?: string;
          is_active?: boolean;
          last_called_at?: string | null;
          name?: string;
          secret?: string | null;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      enqueue_notification: {
        Args: {
          _body: string;
          _link: string;
          _title: string;
          _type: string;
          _user_id: string;
        };
        Returns: string;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      user_has_client_access: {
        Args: { _client_id: string; _user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "client" | "editor";
      automation_action:
        "create_notification" | "create_task" | "send_webhook" | "change_post_status";
      automation_trigger:
        | "schedule"
        | "post_published"
        | "post_metric_threshold"
        | "new_upload"
        | "new_message"
        | "status_change";
      calendar_status: "pending" | "delivered" | "approved";
      content_channel:
        | "instagram"
        | "tiktok"
        | "linkedin"
        | "facebook"
        | "youtube"
        | "website"
        | "email"
        | "print"
        | "other";
      content_status: "idea" | "draft" | "approved" | "scheduled" | "published" | "archived";
      deal_stage: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
      deliverable_type: "image" | "video" | "copy" | "document" | "other";
      meeting_type: "intake" | "strategy" | "review" | "presentation" | "call" | "other";
      message_sender_role: "admin" | "client";
      provision_status: "pending" | "processing" | "done" | "failed";
      report_type: "monthly" | "campaign" | "analytics" | "audit" | "other";
      roadmap_status: "draft" | "active" | "completed" | "archived";
      scheduled_post_status: "draft" | "scheduled" | "publishing" | "published" | "failed";
      social_connection_status: "active" | "expired" | "error" | "pending";
      social_platform: "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";
      step_status: "pending" | "in_progress" | "completed";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status: "todo" | "in_progress" | "done";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "client", "editor"],
      automation_action: [
        "create_notification",
        "create_task",
        "send_webhook",
        "change_post_status",
      ],
      automation_trigger: [
        "schedule",
        "post_published",
        "post_metric_threshold",
        "new_upload",
        "new_message",
        "status_change",
      ],
      calendar_status: ["pending", "delivered", "approved"],
      content_channel: [
        "instagram",
        "tiktok",
        "linkedin",
        "facebook",
        "youtube",
        "website",
        "email",
        "print",
        "other",
      ],
      content_status: ["idea", "draft", "approved", "scheduled", "published", "archived"],
      deal_stage: ["lead", "qualified", "proposal", "negotiation", "won", "lost"],
      deliverable_type: ["image", "video", "copy", "document", "other"],
      meeting_type: ["intake", "strategy", "review", "presentation", "call", "other"],
      message_sender_role: ["admin", "client"],
      provision_status: ["pending", "processing", "done", "failed"],
      report_type: ["monthly", "campaign", "analytics", "audit", "other"],
      roadmap_status: ["draft", "active", "completed", "archived"],
      scheduled_post_status: ["draft", "scheduled", "publishing", "published", "failed"],
      social_connection_status: ["active", "expired", "error", "pending"],
      social_platform: ["instagram", "tiktok", "linkedin", "youtube", "facebook"],
      step_status: ["pending", "in_progress", "completed"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done"],
    },
  },
} as const;

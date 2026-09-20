export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agreement_payment_confirmations: {
        Row: {
          agreement_id: string
          confirmed_at: string
          confirmed_by: string | null
          id: string
        }
        Insert: {
          agreement_id: string
          confirmed_at?: string
          confirmed_by?: string | null
          id?: string
        }
        Update: {
          agreement_id?: string
          confirmed_at?: string
          confirmed_by?: string | null
          id?: string
        }
        Relationships: []
      }
      content_unlocks: {
        Row: {
          content_id: string
          created_at: string
          id: string
          payment_id: string | null
          unlock_type: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          payment_id?: string | null
          unlock_type?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          payment_id?: string | null
          unlock_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_unlocks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      followers_relationships: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          last_read_at: string
          muted: boolean
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          deleted_at: string | null
          group_id: string
          id: string
          media_type: Database["public"]["Enums"]["message_media_type"]
          media_url: string | null
          reply_to_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          group_id: string
          id?: string
          media_type?: Database["public"]["Enums"]["message_media_type"]
          media_url?: string | null
          reply_to_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          group_id?: string
          id?: string
          media_type?: Database["public"]["Enums"]["message_media_type"]
          media_url?: string | null
          reply_to_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_passes: {
        Row: {
          created_at: string
          group_id: string
          id: string
          payment_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          payment_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          payment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_passes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          cover_url: string | null
          created_at: string
          creator_id: string
          description: string | null
          id: string
          name: string
          pass_price: number
          subscribers_free: boolean
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          name: string
          pass_price?: number
          subscribers_free?: boolean
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          name?: string
          pass_price?: number
          subscribers_free?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      meetups: {
        Row: {
          created_at: string
          guest_id: string
          host_id: string
          id: string
          location: string | null
          notes: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          host_id: string
          id?: string
          location?: string | null
          notes?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          host_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          notif_comments: boolean
          notif_follows: boolean
          notif_likes: boolean
          notif_live: boolean
          notif_messages: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notif_comments?: boolean
          notif_follows?: boolean
          notif_likes?: boolean
          notif_live?: boolean
          notif_messages?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notif_comments?: boolean
          notif_follows?: boolean
          notif_likes?: boolean
          notif_live?: boolean
          notif_messages?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payfast_webhook_events: {
        Row: {
          amount_gross: number | null
          content_id: string | null
          created_at: string
          error_message: string | null
          id: string
          ip_ok: boolean
          m_payment_id: string | null
          payfast_payment_id: string | null
          payment_status: string | null
          processed: boolean
          raw_body: string
          server_ok: boolean
          signature_ok: boolean
          source_ip: string | null
        }
        Insert: {
          amount_gross?: number | null
          content_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_ok?: boolean
          m_payment_id?: string | null
          payfast_payment_id?: string | null
          payment_status?: string | null
          processed?: boolean
          raw_body: string
          server_ok?: boolean
          signature_ok?: boolean
          source_ip?: string | null
        }
        Update: {
          amount_gross?: number | null
          content_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_ok?: boolean
          m_payment_id?: string | null
          payfast_payment_id?: string | null
          payment_status?: string | null
          processed?: boolean
          raw_body?: string
          server_ok?: boolean
          signature_ok?: boolean
          source_ip?: string | null
        }
        Relationships: []
      }
      payment_logs: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          payment_id: string | null
          provider: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          provider?: string | null
          status: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          provider?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          content_id: string
          created_at: string
          currency: string
          id: string
          payfast_payment_id: string | null
          payfast_token: string | null
          payment_type: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          content_id: string
          created_at?: string
          currency?: string
          id?: string
          payfast_payment_id?: string | null
          payfast_token?: string | null
          payment_type?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          content_id?: string
          created_at?: string
          currency?: string
          id?: string
          payfast_payment_id?: string | null
          payfast_token?: string | null
          payment_type?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      platform_revenue: {
        Row: {
          commission_amount: number
          commission_rate: number
          created_at: string
          creator_id: string
          description: string | null
          gross_amount: number
          id: string
          reference: string | null
          source_type: string
          source_user_id: string
        }
        Insert: {
          commission_amount: number
          commission_rate?: number
          created_at?: string
          creator_id: string
          description?: string | null
          gross_amount: number
          id?: string
          reference?: string | null
          source_type: string
          source_user_id: string
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          creator_id?: string
          description?: string | null
          gross_amount?: number
          id?: string
          reference?: string | null
          source_type?: string
          source_user_id?: string
        }
        Relationships: []
      }
      post_boosts: {
        Row: {
          amount: number
          created_at: string
          duration_hours: number
          expires_at: string
          id: string
          payment_method: string
          payment_ref: string | null
          post_id: string
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          duration_hours: number
          expires_at: string
          id?: string
          payment_method: string
          payment_ref?: string | null
          post_id: string
          status?: string
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          duration_hours?: number
          expires_at?: string
          id?: string
          payment_method?: string
          payment_ref?: string | null
          post_id?: string
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_metadata: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          id: string
          is_sensitive: boolean
          media_url: string | null
          post_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          is_sensitive?: boolean
          media_url?: string | null
          post_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          is_sensitive?: boolean
          media_url?: string | null
          post_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          average_rating: number
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          ratings_count: number
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          average_rating?: number
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          ratings_count?: number
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          average_rating?: number
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          ratings_count?: number
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          id: string
          meetup_id: string | null
          ratee_id: string
          rater_id: string
          review: string | null
          stars: number
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          meetup_id?: string | null
          ratee_id: string
          rater_id: string
          review?: string | null
          stars: number
          target_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          meetup_id?: string | null
          ratee_id?: string
          rater_id?: string
          review?: string | null
          stars?: number
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          creator_id: string
          current_period_end: string
          current_period_start: string
          id: string
          payfast_token: string | null
          status: string
          subscriber_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          creator_id: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          payfast_token?: string | null
          status?: string
          subscriber_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          creator_id?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          payfast_token?: string | null
          status?: string
          subscriber_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_join_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      can_rate: {
        Args: { _meetup_id: string; _ratee: string; _rater: string }
        Returns: boolean
      }
      group_role_of: {
        Args: { _group_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["group_role"]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      recalc_profile_rating: { Args: { _user: string }; Returns: undefined }
      should_notify: {
        Args: { _type: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      group_role: "owner" | "admin" | "member"
      message_media_type: "none" | "image" | "video" | "voice"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      group_role: ["owner", "admin", "member"],
      message_media_type: ["none", "image", "video", "voice"],
    },
  },
} as const

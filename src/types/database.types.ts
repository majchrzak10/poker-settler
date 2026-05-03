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
  public: {
    Tables: {
      client_logs: {
        Row: {
          app_version: string | null
          context: Json
          created_at: string
          device: string | null
          event: string
          id: string
          level: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          context?: Json
          created_at?: string
          device?: string | null
          event: string
          id?: string
          level: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          context?: Json
          created_at?: string
          device?: string | null
          event?: string
          id?: string
          level?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      friend_invites: {
        Row: {
          created_at: string
          id: string
          invitee_email: string
          invitee_user_id: string | null
          requester_player_id: string
          requester_user_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_email: string
          invitee_user_id?: string | null
          requester_player_id: string
          requester_user_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_email?: string
          invitee_user_id?: string | null
          requester_player_id?: string
          requester_user_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_invites_requester_player_id_fkey"
            columns: ["requester_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      live_session_state: {
        Row: {
          default_buy_in: number
          owner_id: string
          session_players: Json
          updated_at: string
        }
        Insert: {
          default_buy_in?: number
          owner_id: string
          session_players?: Json
          updated_at?: string
        }
        Update: {
          default_buy_in?: number
          owner_id?: string
          session_players?: Json
          updated_at?: string
        }
        Relationships: []
      }
      participations: {
        Row: {
          cash_out: number | null
          created_at: string | null
          id: string
          net_balance: number | null
          player_name: string
          session_date: string
          session_id: string
          total_buy_in: number
          total_pot: number
          user_id: string
        }
        Insert: {
          cash_out?: number | null
          created_at?: string | null
          id?: string
          net_balance?: number | null
          player_name: string
          session_date: string
          session_id: string
          total_buy_in?: number
          total_pot?: number
          user_id: string
        }
        Update: {
          cash_out?: number | null
          created_at?: string | null
          id?: string
          net_balance?: number | null
          player_name?: string
          session_date?: string
          session_id?: string
          total_buy_in?: number
          total_pot?: number
          user_id?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          linked_user_id: string | null
          name: string
          owner_id: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          linked_user_id?: string | null
          name: string
          owner_id: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          linked_user_id?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string
          email: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          email?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          email?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      session_players: {
        Row: {
          cash_out: number | null
          id: string
          net_balance: number | null
          player_id: string | null
          player_name: string
          session_id: string | null
          total_buy_in: number
        }
        Insert: {
          cash_out?: number | null
          id?: string
          net_balance?: number | null
          player_id?: string | null
          player_name: string
          session_id?: string | null
          total_buy_in?: number
        }
        Update: {
          cash_out?: number | null
          id?: string
          net_balance?: number | null
          player_id?: string | null
          player_name?: string
          session_id?: string | null
          total_buy_in?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          default_buyin: number
          id: string
          owner_id: string
          played_at: string | null
          total_pot: number
        }
        Insert: {
          default_buyin?: number
          id?: string
          owner_id: string
          played_at?: string | null
          total_pot?: number
        }
        Update: {
          default_buyin?: number
          id?: string
          owner_id?: string
          played_at?: string | null
          total_pot?: number
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          from_name: string
          id: string
          session_id: string | null
          to_name: string
        }
        Insert: {
          amount: number
          from_name: string
          id?: string
          session_id?: string | null
          to_name: string
        }
        Update: {
          amount?: number
          from_name?: string
          id?: string
          session_id?: string | null
          to_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_invite: {
        Args: { p_invite_id: string }
        Returns: undefined
      }
      backfill_participations_for_player: {
        Args: { p_friend_user_id: string; p_player_id: string }
        Returns: undefined
      }
      cancel_friend_invite: {
        Args: { p_invite_id: string }
        Returns: undefined
      }
      complete_friend_player_link: {
        Args: { p_friend_user_id: string; p_player_id: string }
        Returns: undefined
      }
      delete_session_atomic: {
        Args: { p_owner_id: string; p_session_id: string }
        Returns: undefined
      }
      find_profile_by_phone: {
        Args: { p_phone: string }
        Returns: {
          display_name: string
          email: string
          id: string
        }[]
      }
      has_reciprocal_link_to: {
        Args: { p_target_owner: string }
        Returns: boolean
      }
      reject_friend_invite: {
        Args: { p_invite_id: string }
        Returns: undefined
      }
      remove_friend_player_link: {
        Args: { p_player_id: string }
        Returns: undefined
      }
      save_session_atomic: {
        Args: {
          p_owner_id: string
          p_participations: Json
          p_played_at: string
          p_session_id: string
          p_session_players: Json
          p_total_pot: number
          p_transfers: Json
        }
        Returns: undefined
      }
      sync_self_player: { Args: never; Returns: string }
      update_session_atomic: {
        Args: {
          p_owner_id: string
          p_participations: Json
          p_played_at: string
          p_session_id: string
          p_session_players: Json
          p_total_pot: number
          p_transfers: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

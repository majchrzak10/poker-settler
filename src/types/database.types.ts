/**
 * Typy bazy danych — zbudowane ręcznie na podstawie migracji 000–019.
 * Uruchom `npm run gen:types` po zalogowaniu do Supabase CLI, żeby zastąpić
 * ten plik wersją auto-generowaną.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          phone: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          phone?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          phone?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          owner_id: string;
          linked_user_id: string | null;
          name: string;
          email: string | null;
          phone: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          linked_user_id?: string | null;
          name: string;
          email?: string | null;
          phone?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          linked_user_id?: string | null;
          name?: string;
          email?: string | null;
          phone?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'players_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'players_linked_user_id_fkey';
            columns: ['linked_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      sessions: {
        Row: {
          id: string;
          owner_id: string;
          played_at: string;
          total_pot: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          played_at: string;
          total_pot: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          played_at?: string;
          total_pot?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      session_players: {
        Row: {
          id: string;
          session_id: string;
          player_id: string | null;
          player_name: string;
          total_buy_in: number;
          cash_out: number;
          net_balance: number | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id?: string | null;
          player_name: string;
          total_buy_in: number;
          cash_out: number;
          net_balance?: never;
        };
        Update: {
          id?: string;
          session_id?: string;
          player_id?: string | null;
          player_name?: string;
          total_buy_in?: number;
          cash_out?: number;
          net_balance?: never;
        };
        Relationships: [
          {
            foreignKeyName: 'session_players_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_players_player_id_fkey';
            columns: ['player_id'];
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
        ];
      };
      transfers: {
        Row: {
          id: string;
          session_id: string;
          from_name: string;
          to_name: string;
          amount: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          from_name: string;
          to_name: string;
          amount: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          from_name?: string;
          to_name?: string;
          amount?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'transfers_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      participations: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          player_name: string;
          total_buy_in: number;
          cash_out: number | null;
          net_balance: number | null;
          session_date: string;
          total_pot: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          player_name: string;
          total_buy_in: number;
          cash_out?: number | null;
          net_balance?: never;
          session_date: string;
          total_pot: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          player_name?: string;
          total_buy_in?: number;
          cash_out?: number | null;
          net_balance?: never;
          session_date?: string;
          total_pot?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'participations_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      live_session_state: {
        Row: {
          owner_id: string;
          default_buy_in: number;
          session_players: Json;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          default_buy_in?: number;
          session_players?: Json;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          default_buy_in?: number;
          session_players?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'live_session_state_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      friend_invites: {
        Row: {
          id: string;
          requester_user_id: string;
          requester_player_id: string;
          invitee_email: string;
          invitee_user_id: string | null;
          status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          requester_user_id: string;
          requester_player_id: string;
          invitee_email: string;
          invitee_user_id?: string | null;
          status?: 'pending' | 'accepted' | 'rejected' | 'cancelled';
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          requester_user_id?: string;
          requester_player_id?: string;
          invitee_email?: string;
          invitee_user_id?: string | null;
          status?: 'pending' | 'accepted' | 'rejected' | 'cancelled';
          created_at?: string;
          responded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'friend_invites_requester_user_id_fkey';
            columns: ['requester_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friend_invites_requester_player_id_fkey';
            columns: ['requester_player_id'];
            referencedRelation: 'players';
            referencedColumns: ['id'];
          },
        ];
      };
      client_logs: {
        Row: {
          id: string;
          created_at: string;
          user_id: string | null;
          session_id: string | null;
          level: 'error' | 'warn' | 'info';
          event: string;
          context: Json;
          device: string | null;
          app_version: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id?: string | null;
          session_id?: string | null;
          level: 'error' | 'warn' | 'info';
          event: string;
          context?: Json;
          device?: string | null;
          app_version?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string | null;
          session_id?: string | null;
          level?: 'error' | 'warn' | 'info';
          event?: string;
          context?: Json;
          device?: string | null;
          app_version?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_session_atomic: {
        Args: {
          p_session_id: string;
          p_owner_id: string;
          p_played_at: string;
          p_total_pot: number;
          p_session_players: Json;
          p_transfers: Json;
          p_participations: Json;
        };
        Returns: undefined;
      };
      update_session_atomic: {
        Args: {
          p_session_id: string;
          p_owner_id: string;
          p_played_at: string;
          p_total_pot: number;
          p_session_players: Json;
          p_transfers: Json;
          p_participations: Json;
        };
        Returns: undefined;
      };
      complete_friend_player_link: {
        Args: { p_player_id: string; p_friend_user_id: string };
        Returns: undefined;
      };
      remove_friend_player_link: {
        Args: { p_player_id: string };
        Returns: undefined;
      };
      find_profile_by_phone: {
        Args: { p_phone: string };
        Returns: { id: string; display_name: string | null; email: string | null }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

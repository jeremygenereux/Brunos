export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      editions: {
        Row: {
          created_at: string;
          description: string | null;
          drink_rule: Database["public"]["Enums"]["drink_rule"];
          event_at: string | null;
          id: string;
          invite_token: string;
          name: string;
          shooter_value: number;
          state: Database["public"]["Enums"]["edition_state"];
          updated_at: string;
          venue_address: string | null;
          venue_name: string | null;
          vote_deadline: string | null;
          year: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          drink_rule?: Database["public"]["Enums"]["drink_rule"];
          event_at?: string | null;
          id?: string;
          invite_token?: string;
          name: string;
          shooter_value?: number;
          state?: Database["public"]["Enums"]["edition_state"];
          updated_at?: string;
          venue_address?: string | null;
          venue_name?: string | null;
          vote_deadline?: string | null;
          year: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          drink_rule?: Database["public"]["Enums"]["drink_rule"];
          event_at?: string | null;
          id?: string;
          invite_token?: string;
          name?: string;
          shooter_value?: number;
          state?: Database["public"]["Enums"]["edition_state"];
          updated_at?: string;
          venue_address?: string | null;
          venue_name?: string | null;
          vote_deadline?: string | null;
          year?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          edition_id: string;
          id: string;
          kind: string;
          message: string;
          participant_id: string | null;
          read_at: string | null;
        };
        Insert: {
          created_at?: string;
          edition_id: string;
          id?: string;
          kind?: string;
          message: string;
          participant_id?: string | null;
          read_at?: string | null;
        };
        Update: {
          created_at?: string;
          edition_id?: string;
          id?: string;
          kind?: string;
          message?: string;
          participant_id?: string | null;
          read_at?: string | null;
        };
        Relationships: [];
      };
      participants: {
        Row: {
          created_at: string;
          edition_id: string;
          id: string;
          kind: Database["public"]["Enums"]["participant_kind"];
          linked_player_id: string | null;
          relation_label: string | null;
          rsvp: Database["public"]["Enums"]["rsvp_status"] | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          edition_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["participant_kind"];
          linked_player_id?: string | null;
          relation_label?: string | null;
          rsvp?: Database["public"]["Enums"]["rsvp_status"] | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          edition_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["participant_kind"];
          linked_player_id?: string | null;
          relation_label?: string | null;
          rsvp?: Database["public"]["Enums"]["rsvp_status"] | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "participants_edition_id_fkey";
            columns: ["edition_id"];
            isOneToOne: false;
            referencedRelation: "editions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "participants_linked_player_id_fkey";
            columns: ["linked_player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          auth_user_id: string | null;
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          created_at: string;
          display_order: number;
          edition_id: string;
          headshot_url: string | null;
          id: string;
          person_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          edition_id: string;
          headshot_url?: string | null;
          id?: string;
          person_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          edition_id?: string;
          headshot_url?: string | null;
          id?: string;
          person_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_edition_id_fkey";
            columns: ["edition_id"];
            isOneToOne: false;
            referencedRelation: "editions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "players_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          person_id: string;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          person_id: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          person_id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: true;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          created_at: string;
          drink_rule_override: Database["public"]["Enums"]["drink_rule"] | null;
          edition_id: string;
          format: Database["public"]["Enums"]["question_format"];
          id: string;
          is_selected_for_show: boolean;
          position: number;
          prompt: string;
          show_order: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          drink_rule_override?: Database["public"]["Enums"]["drink_rule"] | null;
          edition_id: string;
          format: Database["public"]["Enums"]["question_format"];
          id?: string;
          is_selected_for_show?: boolean;
          position?: number;
          prompt: string;
          show_order?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          drink_rule_override?: Database["public"]["Enums"]["drink_rule"] | null;
          edition_id?: string;
          format?: Database["public"]["Enums"]["question_format"];
          id?: string;
          is_selected_for_show?: boolean;
          position?: number;
          prompt?: string;
          show_order?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_edition_id_fkey";
            columns: ["edition_id"];
            isOneToOne: false;
            referencedRelation: "editions";
            referencedColumns: ["id"];
          },
        ];
      };
      results: {
        Row: {
          audience: Database["public"]["Enums"]["result_audience"];
          borda_score: number | null;
          created_at: string;
          drinks: number;
          final_rank: number;
          id: string;
          player_id: string;
          question_id: string;
          updated_at: string;
          vote_count: number | null;
        };
        Insert: {
          audience: Database["public"]["Enums"]["result_audience"];
          borda_score?: number | null;
          created_at?: string;
          drinks?: number;
          final_rank: number;
          id?: string;
          player_id: string;
          question_id: string;
          updated_at?: string;
          vote_count?: number | null;
        };
        Update: {
          audience?: Database["public"]["Enums"]["result_audience"];
          borda_score?: number | null;
          created_at?: string;
          drinks?: number;
          final_rank?: number;
          id?: string;
          player_id?: string;
          question_id?: string;
          updated_at?: string;
          vote_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "results_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "results_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      vote_answers: {
        Row: {
          created_at: string;
          edition_id: string;
          id: string;
          player_id: string;
          question_id: string;
          rank: number;
          updated_at: string;
          vote_id: string;
        };
        Insert: {
          created_at?: string;
          edition_id: string;
          id?: string;
          player_id: string;
          question_id: string;
          rank: number;
          updated_at?: string;
          vote_id: string;
        };
        Update: {
          created_at?: string;
          edition_id?: string;
          id?: string;
          player_id?: string;
          question_id?: string;
          rank?: number;
          updated_at?: string;
          vote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vote_answers_player_edition_fk";
            columns: ["player_id", "edition_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "edition_id"];
          },
          {
            foreignKeyName: "vote_answers_question_edition_fk";
            columns: ["question_id", "edition_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id", "edition_id"];
          },
          {
            foreignKeyName: "vote_answers_vote_edition_fk";
            columns: ["vote_id", "edition_id"];
            isOneToOne: false;
            referencedRelation: "votes";
            referencedColumns: ["id", "edition_id"];
          },
        ];
      };
      votes: {
        Row: {
          created_at: string;
          edition_id: string;
          id: string;
          participant_id: string;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          edition_id: string;
          id?: string;
          participant_id: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          edition_id?: string;
          id?: string;
          participant_id?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "votes_edition_id_fkey";
            columns: ["edition_id"];
            isOneToOne: false;
            referencedRelation: "editions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_participant_edition_fk";
            columns: ["participant_id", "edition_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id", "edition_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_unlock_questions: {
        Args: { p_confirm?: boolean; p_edition: string };
        Returns: undefined;
      };
      archived_edition_voters: {
        Args: { p_edition: string };
        Returns: {
          participant_id: string;
          person_id: string | null;
          display_name: string;
          kind: string;
        }[];
      };
      current_participant_id: { Args: { p_edition: string }; Returns: string };
      current_person_id: { Args: never; Returns: string };
      edition_accepts_votes: { Args: { p_edition: string }; Returns: boolean };
      edition_is_archived: { Args: { p_edition: string }; Returns: boolean };
      edition_join_info: { Args: { p_token: string }; Returns: Json };
      edition_of_question: { Args: { p_question: string }; Returns: string };
      is_admin: { Args: never; Returns: boolean };
      is_edition_participant: { Args: { p_edition: string }; Returns: boolean };
      join_edition: {
        Args: {
          p_token: string;
          p_kind: Database["public"]["Enums"]["participant_kind"];
          p_linked_player?: string;
          p_relation?: string;
        };
        Returns: string;
      };
      person_is_edition_nominee_for_caller: {
        Args: { p_person: string };
        Returns: boolean;
      };
      reorder_questions: {
        Args: { p_edition: string; p_ids: string[] };
        Returns: undefined;
      };
      set_question_selection: {
        Args: { p_edition: string; p_ordered_ids: string[] };
        Returns: undefined;
      };
      submit_ballot: {
        Args: { p_answers: Json; p_edition: string };
        Returns: undefined;
      };
      vote_is_editable: { Args: { p_vote: string }; Returns: boolean };
      user_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      vote_answer_is_consistent: {
        Args: { p_player: string; p_question: string; p_vote: string };
        Returns: boolean;
      };
      vote_belongs_to_caller: { Args: { p_vote: string }; Returns: boolean };
      vote_is_in_open_window: { Args: { p_vote: string }; Returns: boolean };
    };
    Enums: {
      drink_rule: "TOP_UNIQUE" | "ESCALATION";
      edition_state:
        | "CONSTRUCTION"
        | "SENT_FOR_VOTE"
        | "COMPILATION"
        | "LOCKED"
        | "LIVE"
        | "ARCHIVED";
      participant_kind: "player" | "jury";
      question_format: "ranking" | "single_choice";
      result_audience: "players" | "jury";
      rsvp_status: "yes" | "no" | "maybe";
      user_role: "admin" | "player" | "jury";
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      drink_rule: ["TOP_UNIQUE", "ESCALATION"],
      edition_state: ["CONSTRUCTION", "SENT_FOR_VOTE", "COMPILATION", "LOCKED", "LIVE", "ARCHIVED"],
      participant_kind: ["player", "jury"],
      question_format: ["ranking", "single_choice"],
      result_audience: ["players", "jury"],
      rsvp_status: ["yes", "no", "maybe"],
      user_role: ["admin", "player", "jury"],
    },
  },
} as const;

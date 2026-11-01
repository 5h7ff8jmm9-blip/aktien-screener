export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      api_cache: {
        Row: { fetched_at: string; key: string; payload: Json };
        Insert: { fetched_at?: string; key: string; payload: Json };
        Update: { fetched_at?: string; key?: string; payload?: Json };
        Relationships: [];
      };
      saved_screens: {
        Row: { created_at: string; filters: Json; id: string; name: string; user_id: string };
        Insert: { created_at?: string; filters?: Json; id?: string; name: string; user_id?: string };
        Update: { created_at?: string; filters?: Json; id?: string; name?: string; user_id?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

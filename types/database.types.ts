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
      spots: {
        Row: {
          id: string;
          name: string;
          type: "meer" | "see" | "wald";
          icon: string;
          lat: number;
          lng: number;
          access: string;
          status: "green" | "amber" | "red";
          label: string;
          note: string;
          source: string;
          source_url: string | null;
          discovered: boolean;
          updated_at: string;
        };
        Insert: Database["public"]["Tables"]["spots"]["Row"];
        Update: Partial<Database["public"]["Tables"]["spots"]["Insert"]>;
      };
      ratings: {
        Row: {
          id: number;
          spot_id: string;
          user_id: string;
          value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ratings"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Pick<Database["public"]["Tables"]["ratings"]["Row"], "value" | "updated_at">;
      };
      comments: {
        Row: {
          id: string;
          spot_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["comments"]["Row"], "created_at">;
        Update: never;
      };
      comment_photos: {
        Row: {
          id: number;
          comment_id: string;
          user_id: string;
          storage_path: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["comment_photos"]["Row"], "id" | "created_at">;
        Update: never;
      };
      guide_tips: {
        Row: {
          id: string;
          user_id: string;
          section: "setup" | "weather" | "gear" | "location" | "vehicle";
          body: string;
          status: "pending" | "approved" | "rejected";
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: Pick<Database["public"]["Tables"]["guide_tips"]["Row"], "user_id" | "section" | "body">;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

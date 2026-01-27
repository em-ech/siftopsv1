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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bundle_documents: {
        Row: {
          bundle_id: string
          created_at: string | null
          document_id: string
          id: string
        }
        Insert: {
          bundle_id: string
          created_at?: string | null
          document_id: string
          id?: string
        }
        Update: {
          bundle_id?: string
          created_at?: string | null
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_documents_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          bundle_id: string
          created_at: string | null
          id: string
          locked: boolean | null
          updated_at: string | null
        }
        Insert: {
          bundle_id: string
          created_at?: string | null
          id?: string
          locked?: boolean | null
          updated_at?: string | null
        }
        Update: {
          bundle_id?: string
          created_at?: string | null
          id?: string
          locked?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_id: string
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
        }
        Insert: {
          chunk_id: string
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
        }
        Update: {
          chunk_id?: string
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          doc_id: string
          full_text: string | null
          id: string
          published_at: string | null
          title: string
          type: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          doc_id: string
          full_text?: string | null
          id?: string
          published_at?: string | null
          title: string
          type: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          doc_id?: string
          full_text?: string | null
          id?: string
          published_at?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string | null
          doc_id: string
          id: string
          query_signature: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          doc_id: string
          id?: string
          query_signature: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          doc_id?: string
          id?: string
          query_signature?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      gdrive_chunks: {
        Row: {
          chunk_id: string
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          file_id: string | null
          id: string
        }
        Insert: {
          chunk_id: string
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          file_id?: string | null
          id?: string
        }
        Update: {
          chunk_id?: string
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          file_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gdrive_chunks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "gdrive_files"
            referencedColumns: ["id"]
          },
        ]
      }
      gdrive_connections: {
        Row: {
          access_token: string | null
          created_at: string
          email: string
          id: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          email: string
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gdrive_files: {
        Row: {
          connection_id: string | null
          created_at: string
          file_id: string
          folder_path: string | null
          full_text: string | null
          id: string
          indexed_at: string | null
          mime_type: string | null
          modified_time: string | null
          name: string
          updated_at: string
          web_view_link: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          file_id: string
          folder_path?: string | null
          full_text?: string | null
          id?: string
          indexed_at?: string | null
          mime_type?: string | null
          modified_time?: string | null
          name: string
          updated_at?: string
          web_view_link?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          file_id?: string
          folder_path?: string | null
          full_text?: string | null
          id?: string
          indexed_at?: string | null
          mime_type?: string | null
          modified_time?: string | null
          name?: string
          updated_at?: string
          web_view_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gdrive_files_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gdrive_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      gdrive_sync_status: {
        Row: {
          chunks_count: number | null
          connection_id: string | null
          created_at: string
          error: string | null
          files_count: number | null
          id: string
          status: string | null
          synced_at: string | null
        }
        Insert: {
          chunks_count?: number | null
          connection_id?: string | null
          created_at?: string
          error?: string | null
          files_count?: number | null
          id?: string
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          chunks_count?: number | null
          connection_id?: string | null
          created_at?: string
          error?: string | null
          files_count?: number | null
          id?: string
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gdrive_sync_status_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "gdrive_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_status: {
        Row: {
          chunks_count: number | null
          docs_count: number | null
          error: string | null
          id: string
          status: string | null
          synced_at: string | null
        }
        Insert: {
          chunks_count?: number | null
          docs_count?: number | null
          error?: string | null
          id?: string
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          chunks_count?: number | null
          docs_count?: number | null
          error?: string | null
          id?: string
          status?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          doc_id: string
          document_id: string
          similarity: number
          title: string
          type: string
          url: string
        }[]
      }
      match_gdrive_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          file_id: string
          file_name: string
          folder_path: string
          mime_type: string
          similarity: number
          web_view_link: string
        }[]
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

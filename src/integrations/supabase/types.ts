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
      advice: {
        Row: {
          advice_date: string
          case_id: string | null
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          status: string
          subject: string
          updated_at: string
          created_by: string
        }
        Insert: {
          advice_date?: string
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          subject: string
          updated_at?: string
          created_by: string
        }
        Update: {
          advice_date?: string
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "advice_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advice_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      advocates: {
        Row: {
          bar_number: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          specialization: string | null
          status: string
          updated_at: string
          created_by: string
        }
        Insert: {
          bar_number?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          specialization?: string | null
          status?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          bar_number?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          specialization?: string | null
          status?: string
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          advocate_id: string | null
          case_number: string
          case_type: string | null
          client_id: string | null
          court_name: string | null
          court_type: string | null
          cnr_number: string | null
          file_number: string | null
          case_stage: string | null
          stage: string | null
          last_hearing_date: string | null
          next_hearing_date: string | null
          case_imported_date: string | null
          case_tags: string | null
          case_side: string | null
          disposed_date: string | null
          document_size: string | null
          fir_number: string | null
          police_station: string | null
          case_notes_1: string | null
          case_notes_2: string | null
          created_at: string
          description: string | null
          filing_date: string | null
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          advocate_id?: string | null
          case_number: string
          case_type?: string | null
          client_id?: string | null
          court_name?: string | null
          court_type?: string | null
          cnr_number?: string | null
          file_number?: string | null
          case_stage?: string | null
          stage?: string | null
          last_hearing_date?: string | null
          next_hearing_date?: string | null
          case_imported_date?: string | null
          case_tags?: string | null
          case_side?: string | null
          disposed_date?: string | null
          document_size?: string | null
          fir_number?: string | null
          police_station?: string | null
          case_notes_1?: string | null
          case_notes_2?: string | null
          created_at?: string
          description?: string | null
          filing_date?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          advocate_id?: string | null
          case_number?: string
          case_type?: string | null
          client_id?: string | null
          court_name?: string | null
          court_type?: string | null
          cnr_number?: string | null
          file_number?: string | null
          case_stage?: string | null
          stage?: string | null
          last_hearing_date?: string | null
          next_hearing_date?: string | null
          case_imported_date?: string | null
          case_tags?: string | null
          case_side?: string | null
          disposed_date?: string | null
          document_size?: string | null
          fir_number?: string | null
          police_station?: string | null
          case_notes_1?: string | null
          case_notes_2?: string | null
          created_at?: string
          description?: string | null
          filing_date?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_advocate_id_fkey"
            columns: ["advocate_id"]
            isOneToOne: false
            referencedRelation: "advocates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          state: string | null
          updated_at: string
          created_by: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          created_by: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          created_by?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          contact_type: string
          created_at: string
          created_by: string
          designation: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          contact_type?: string
          created_at?: string
          created_by?: string
          designation?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          company?: string | null
          contact_type?: string
          created_at?: string
          created_by?: string
          designation?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          case_id: string | null
          created_at: string
          description: string | null
          document_type: string | null
          file_url: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          case_id: string
          created_at: string
          created_by: string
          description: string | null
          evidence_type: string | null
          file_url: string | null
          id: string
          submitted_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string
          description?: string | null
          evidence_type?: string | null
          file_url?: string | null
          id?: string
          submitted_date?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          evidence_type?: string | null
          file_url?: string | null
          id?: string
          submitted_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_types: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          case_id: string | null
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          expense_date: string
          id: string
          receipt_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          case_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          expense_date?: string
          id?: string
          receipt_url?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          case_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          expense_date?: string
          id?: string
          receipt_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      hearings: {
        Row: {
          case_id: string
          court_name: string | null
          created_at: string
          hearing_date: string
          id: string
          judge_name: string | null
          notes: string | null
          purpose: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          court_name?: string | null
          created_at?: string
          hearing_date: string
          id?: string
          judge_name?: string | null
          notes?: string | null
          purpose?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          court_name?: string | null
          created_at?: string
          hearing_date?: string
          id?: string
          judge_name?: string | null
          notes?: string | null
          purpose?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hearings_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          case_id: string | null
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_date: string | null
          status: string
          tax: number
          tax_amount: number
          total: number
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid_date?: string | null
          status?: string
          tax?: number
          tax_amount?: number
          total?: number
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_date?: string | null
          status?: string
          tax?: number
          tax_amount?: number
          total?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      matters: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          case_id: string | null
          client_id: string | null
          content: string | null
          created_at: string
          created_by: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          table_name: string
          record_id: string | null
          old_data: Json | null
          new_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          table_name: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          table_name?: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          id: string
          message: string
          stack: string | null
          context: Json | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message: string
          stack?: string | null
          context?: Json | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          message?: string
          stack?: string | null
          context?: Json | null
          user_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ai_config: {
        Row: {
          id: string
          provider: string
          api_key: string
          base_url: string | null
          model: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          provider: string
          api_key: string
          base_url?: string | null
          model?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          provider?: string
          api_key?: string
          base_url?: string | null
          model?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      case_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category?: string | null
          created_by?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      case_template_tasks: {
        Row: {
          id: string
          template_id: string
          title: string
          description: string | null
          days_offset: number
          priority: string
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          title: string
          description?: string | null
          days_offset?: number
          priority?: string
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          title?: string
          description?: string | null
          days_offset?: number
          priority?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_template_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "case_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      important_documents: {
        Row: {
          id: string
          name: string
          file_url: string | null
          file_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          file_url?: string | null
          file_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          file_url?: string | null
          file_type?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: 'super_admin' | 'admin' | 'agent' | 'lawyer'
          sections: string[] | null
          status: 'active' | 'inactive'
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: 'super_admin' | 'admin' | 'agent' | 'lawyer'
          sections?: string[] | null
          status?: 'active' | 'inactive'
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: 'super_admin' | 'admin' | 'agent' | 'lawyer'
          sections?: string[] | null
          status?: 'active' | 'inactive'
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

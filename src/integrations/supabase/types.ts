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
      clients: {
        Row: {
          adresse_site: string | null
          created_at: string
          email: string | null
          forme_juridique: string | null
          id: string
          notes: string | null
          raison_sociale: string
          rcs: string | null
          siren: string | null
          siret: string | null
          telephone: string | null
          type_nuisible: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adresse_site?: string | null
          created_at?: string
          email?: string | null
          forme_juridique?: string | null
          id?: string
          notes?: string | null
          raison_sociale: string
          rcs?: string | null
          siren?: string | null
          siret?: string | null
          telephone?: string | null
          type_nuisible?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adresse_site?: string | null
          created_at?: string
          email?: string | null
          forme_juridique?: string | null
          id?: string
          notes?: string | null
          raison_sociale?: string
          rcs?: string | null
          siren?: string | null
          siret?: string | null
          telephone?: string | null
          type_nuisible?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          adresse: string | null
          bic: string | null
          created_at: string
          email: string | null
          iban: string | null
          next_invoice_number: number
          nom: string
          siret: string | null
          telephone: string | null
          tva_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adresse?: string | null
          bic?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          next_invoice_number?: number
          nom?: string
          siret?: string | null
          telephone?: string | null
          tva_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adresse?: string | null
          bic?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          next_invoice_number?: number
          nom?: string
          siret?: string | null
          telephone?: string | null
          tva_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          adresse_etablissement: string | null
          client_id: string
          created_at: string
          date_debut: string
          date_fin: string
          duree_mois: number
          frequence: string | null
          id: string
          nb_passages_inclus: number
          nom_etablissement: string | null
          notes: string | null
          numero: string | null
          passages_realises: number
          signature_at: string | null
          signature_url: string | null
          statut: string
          type_passage: string
          type_prestation: string
          updated_at: string
          user_id: string
          ville_signature: string | null
        }
        Insert: {
          adresse_etablissement?: string | null
          client_id: string
          created_at?: string
          date_debut: string
          date_fin: string
          duree_mois?: number
          frequence?: string | null
          id?: string
          nb_passages_inclus?: number
          nom_etablissement?: string | null
          notes?: string | null
          numero?: string | null
          passages_realises?: number
          signature_at?: string | null
          signature_url?: string | null
          statut?: string
          type_passage?: string
          type_prestation?: string
          updated_at?: string
          user_id: string
          ville_signature?: string | null
        }
        Update: {
          adresse_etablissement?: string | null
          client_id?: string
          created_at?: string
          date_debut?: string
          date_fin?: string
          duree_mois?: number
          frequence?: string | null
          id?: string
          nb_passages_inclus?: number
          nom_etablissement?: string | null
          notes?: string | null
          numero?: string | null
          passages_realises?: number
          signature_at?: string | null
          signature_url?: string | null
          statut?: string
          type_passage?: string
          type_prestation?: string
          updated_at?: string
          user_id?: string
          ville_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          adresse_site: string | null
          client_id: string
          contract_id: string | null
          created_at: string
          date: string
          date_prochain_passage: string | null
          id: string
          observations: string | null
          produits: string | null
          quantite: string | null
          statut: string
          type_intervention: string
          type_nuisible: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adresse_site?: string | null
          client_id: string
          contract_id?: string | null
          created_at?: string
          date: string
          date_prochain_passage?: string | null
          id?: string
          observations?: string | null
          produits?: string | null
          quantite?: string | null
          statut?: string
          type_intervention?: string
          type_nuisible?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adresse_site?: string | null
          client_id?: string
          contract_id?: string | null
          created_at?: string
          date?: string
          date_prochain_passage?: string | null
          id?: string
          observations?: string | null
          produits?: string | null
          quantite?: string | null
          statut?: string
          type_intervention?: string
          type_nuisible?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          ordre: number
          prix_unitaire_ht: number
          quantite: number
          total_ht: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          ordre?: number
          prix_unitaire_ht?: number
          quantite?: number
          total_ht?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          ordre?: number
          prix_unitaire_ht?: number
          quantite?: number
          total_ht?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          adresse_site: string | null
          client_id: string
          created_at: string
          date_facture: string
          echeance: string | null
          id: string
          intervention_id: string | null
          notes: string | null
          numero: number
          statut: string
          total_ht: number
          total_ttc: number
          tva: number
          tva_taux: number
          updated_at: string
          user_id: string
        }
        Insert: {
          adresse_site?: string | null
          client_id: string
          created_at?: string
          date_facture?: string
          echeance?: string | null
          id?: string
          intervention_id?: string | null
          notes?: string | null
          numero: number
          statut?: string
          total_ht?: number
          total_ttc?: number
          tva?: number
          tva_taux?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          adresse_site?: string | null
          client_id?: string
          created_at?: string
          date_facture?: string
          echeance?: string | null
          id?: string
          intervention_id?: string | null
          notes?: string | null
          numero?: number
          statut?: string
          total_ht?: number
          total_ttc?: number
          tva?: number
          tva_taux?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_presets: {
        Row: {
          created_at: string
          description: string
          id: string
          label: string
          ordre: number
          prix_unitaire_ht: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          label: string
          ordre?: number
          prix_unitaire_ht?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          label?: string
          ordre?: number
          prix_unitaire_ht?: number
          user_id?: string
        }
        Relationships: []
      }
      stock_products: {
        Row: {
          created_at: string
          id: string
          nom: string
          prix_achat_ht: number
          quantite: number
          seuil_alerte: number
          unite: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          prix_achat_ht?: number
          quantite?: number
          seuil_alerte?: number
          unite?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          prix_achat_ht?: number
          quantite?: number
          seuil_alerte?: number
          unite?: string
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
      next_invoice_number: { Args: never; Returns: number }
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

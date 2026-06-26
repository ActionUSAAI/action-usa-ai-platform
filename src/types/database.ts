export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "supervisor" | "agent" | "client";
export type CaseStatus =
  | "nuevo"
  | "en_progreso"
  | "pendiente_documentos"
  | "en_revision"
  | "aprobado"
  | "denegado"
  | "cerrado"
  | "archivado";
export type CaseType =
  | "asilo"
  | "visa_trabajo"
  | "residencia"
  | "ciudadania"
  | "daca"
  | "deportacion"
  | "visa_familiar"
  | "otro";
export type DocumentStatus = "pendiente" | "recibido" | "verificado" | "rechazado";
export type AppointmentStatus = "programada" | "completada" | "cancelada" | "reprogramada";
export type Priority = "baja" | "normal" | "alta" | "urgente";
export type NoteType = "general" | "legal" | "cliente" | "interno" | "sistema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = any;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          role: UserRole;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: AnyRecord;
        Update: AnyRecord;
      };
      clients: {
        Row: {
          id: string;
          profile_id: string | null;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          date_of_birth: string | null;
          country_of_origin: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          alien_number: string | null;
          ssn_last4: string | null;
          preferred_language: string;
          notes: string | null;
          assigned_agent_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: AnyRecord;
        Update: AnyRecord;
      };
      cases: {
        Row: {
          id: string;
          case_number: string;
          client_id: string;
          assigned_agent_id: string | null;
          case_type: CaseType;
          status: CaseStatus;
          priority: Priority;
          title: string;
          description: string | null;
          uscis_receipt_number: string | null;
          court_date: string | null;
          filing_date: string | null;
          deadline: string | null;
          fee_amount: number | null;
          fee_paid: boolean;
          fee_paid_date: string | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
          closed_at: string | null;
        };
        Insert: AnyRecord;
        Update: AnyRecord;
      };
      case_notes: {
        Row: {
          id: string;
          case_id: string;
          author_id: string;
          note_type: NoteType;
          content: string;
          is_visible_to_client: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: AnyRecord;
        Update: AnyRecord;
      };
      documents: {
        Row: {
          id: string;
          case_id: string;
          client_id: string;
          uploaded_by: string;
          name: string;
          description: string | null;
          file_path: string;
          file_size: number | null;
          mime_type: string | null;
          status: DocumentStatus;
          rejection_reason: string | null;
          verified_by: string | null;
          verified_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: AnyRecord;
        Update: AnyRecord;
      };
      appointments: {
        Row: {
          id: string;
          case_id: string | null;
          client_id: string;
          agent_id: string;
          title: string;
          description: string | null;
          scheduled_at: string;
          duration_minutes: number;
          status: AppointmentStatus;
          location: string | null;
          is_virtual: boolean;
          meeting_link: string | null;
          reminder_sent: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: AnyRecord;
        Update: AnyRecord;
      };
      case_status_history: {
        Row: {
          id: string;
          case_id: string;
          changed_by: string;
          old_status: CaseStatus | null;
          new_status: CaseStatus;
          notes: string | null;
          created_at: string;
        };
        Insert: AnyRecord;
        Update: AnyRecord;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          is_read: boolean;
          related_case_id: string | null;
          related_client_id: string | null;
          action_url: string | null;
          created_at: string;
        };
        Insert: AnyRecord;
        Update: AnyRecord;
      };
      payments: {
        Row: {
          id: string;
          case_id: string;
          client_id: string;
          amount: number;
          currency: string;
          description: string | null;
          payment_method: string | null;
          payment_date: string;
          receipt_number: string | null;
          notes: string | null;
          recorded_by: string;
          created_at: string;
        };
        Insert: AnyRecord;
        Update: AnyRecord;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      case_status: CaseStatus;
      case_type: CaseType;
      document_status: DocumentStatus;
      appointment_status: AppointmentStatus;
      priority: Priority;
      note_type: NoteType;
    };
  };
}

-- ============================================================
-- ACTION USA AI - Schema completo de base de datos
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsqueda de texto

-- ============================================================
-- TIPOS ENUM
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'supervisor', 'agent', 'client');
CREATE TYPE case_status AS ENUM (
  'nuevo', 'en_progreso', 'pendiente_documentos', 'en_revision',
  'aprobado', 'denegado', 'cerrado', 'archivado'
);
CREATE TYPE case_type AS ENUM (
  'asilo', 'visa_trabajo', 'residencia', 'ciudadania',
  'daca', 'deportacion', 'visa_familiar', 'otro'
);
CREATE TYPE document_status AS ENUM ('pendiente', 'recibido', 'verificado', 'rechazado');
CREATE TYPE appointment_status AS ENUM ('programada', 'completada', 'cancelada', 'reprogramada');
CREATE TYPE priority AS ENUM ('baja', 'normal', 'alta', 'urgente');
CREATE TYPE note_type AS ENUM ('general', 'legal', 'cliente', 'interno', 'sistema');

-- ============================================================
-- TABLA: profiles (extensión de auth.users)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'agent',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: clients
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  country_of_origin TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  alien_number TEXT, -- A-Number
  ssn_last4 TEXT, -- Solo últimos 4 dígitos
  preferred_language TEXT NOT NULL DEFAULT 'es',
  notes TEXT,
  assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: cases
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  case_type case_type NOT NULL,
  status case_status NOT NULL DEFAULT 'nuevo',
  priority priority NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  description TEXT,
  uscis_receipt_number TEXT,
  court_date TIMESTAMPTZ,
  filing_date DATE,
  deadline DATE,
  fee_amount DECIMAL(10,2),
  fee_paid BOOLEAN NOT NULL DEFAULT false,
  fee_paid_date DATE,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Secuencia para números de caso
CREATE SEQUENCE IF NOT EXISTS case_number_seq START 1000;

-- Función para generar número de caso automático
CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
    NEW.case_number := 'AUA-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('case_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_case_number
  BEFORE INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION generate_case_number();

-- ============================================================
-- TABLA: case_notes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.case_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  note_type note_type NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  is_visible_to_client BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: documents
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  status document_status NOT NULL DEFAULT 'pendiente',
  rejection_reason TEXT,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: appointments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status appointment_status NOT NULL DEFAULT 'programada',
  location TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  meeting_link TEXT,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: case_status_history
-- ============================================================

CREATE TABLE IF NOT EXISTS public.case_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  old_status case_status,
  new_status case_status NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  related_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: payments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  payment_method TEXT,
  payment_date DATE NOT NULL,
  receipt_number TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cases_client_id ON public.cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_agent_id ON public.cases(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.cases(case_number);
CREATE INDEX IF NOT EXISTS idx_clients_agent_id ON public.clients(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON public.case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_agent_id ON public.appointments(agent_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_payments_case_id ON public.payments(case_id);

-- Índice de texto completo para clientes
CREATE INDEX IF NOT EXISTS idx_clients_fulltext ON public.clients
  USING gin(to_tsvector('spanish', first_name || ' ' || last_name || ' ' || COALESCE(email, '')));

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_case_notes_updated_at BEFORE UPDATE ON public.case_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Registrar cambios de estado automáticamente
CREATE OR REPLACE FUNCTION log_case_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.case_status_history (case_id, changed_by, old_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_case_status
  AFTER UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION log_case_status_change();

-- Crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'agent'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Helper: obtener rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: es admin o supervisor
CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin', 'supervisor');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- POLÍTICAS: profiles
CREATE POLICY "Usuarios ven su propio perfil" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR is_admin_or_supervisor());

CREATE POLICY "Usuarios actualizan su propio perfil" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY "Solo admins insertan perfiles" ON public.profiles
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

-- POLÍTICAS: clients
CREATE POLICY "Staff ve todos los clientes" ON public.clients
  FOR SELECT USING (
    get_user_role() IN ('admin', 'supervisor') OR
    assigned_agent_id = auth.uid() OR
    profile_id = auth.uid()
  );

CREATE POLICY "Agentes y superiores crean clientes" ON public.clients
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'supervisor', 'agent'));

CREATE POLICY "Agentes y superiores actualizan clientes" ON public.clients
  FOR UPDATE USING (
    get_user_role() IN ('admin', 'supervisor') OR
    assigned_agent_id = auth.uid()
  );

-- POLÍTICAS: cases
CREATE POLICY "Staff ve casos asignados" ON public.cases
  FOR SELECT USING (
    get_user_role() IN ('admin', 'supervisor') OR
    assigned_agent_id = auth.uid() OR
    client_id IN (SELECT id FROM public.clients WHERE profile_id = auth.uid())
  );

CREATE POLICY "Agentes y superiores crean casos" ON public.cases
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'supervisor', 'agent'));

CREATE POLICY "Agentes y superiores actualizan casos" ON public.cases
  FOR UPDATE USING (
    get_user_role() IN ('admin', 'supervisor') OR
    assigned_agent_id = auth.uid()
  );

-- POLÍTICAS: case_notes
CREATE POLICY "Staff ve notas de casos asignados" ON public.case_notes
  FOR SELECT USING (
    get_user_role() IN ('admin', 'supervisor') OR
    author_id = auth.uid() OR
    (is_visible_to_client AND case_id IN (
      SELECT c.id FROM public.cases c
      JOIN public.clients cl ON cl.id = c.client_id
      WHERE cl.profile_id = auth.uid()
    ))
  );

CREATE POLICY "Staff crea notas" ON public.case_notes
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'supervisor', 'agent'));

CREATE POLICY "Autores actualizan sus notas" ON public.case_notes
  FOR UPDATE USING (author_id = auth.uid() OR is_admin_or_supervisor());

-- POLÍTICAS: documents
CREATE POLICY "Staff ve documentos" ON public.documents
  FOR SELECT USING (
    get_user_role() IN ('admin', 'supervisor') OR
    uploaded_by = auth.uid() OR
    client_id IN (SELECT id FROM public.clients WHERE assigned_agent_id = auth.uid()) OR
    client_id IN (SELECT id FROM public.clients WHERE profile_id = auth.uid())
  );

CREATE POLICY "Staff sube documentos" ON public.documents
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'supervisor', 'agent', 'client'));

CREATE POLICY "Staff actualiza documentos" ON public.documents
  FOR UPDATE USING (get_user_role() IN ('admin', 'supervisor', 'agent'));

-- POLÍTICAS: appointments
CREATE POLICY "Ver citas propias o asignadas" ON public.appointments
  FOR SELECT USING (
    is_admin_or_supervisor() OR
    agent_id = auth.uid() OR
    client_id IN (SELECT id FROM public.clients WHERE profile_id = auth.uid())
  );

CREATE POLICY "Staff crea citas" ON public.appointments
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'supervisor', 'agent'));

CREATE POLICY "Staff actualiza citas" ON public.appointments
  FOR UPDATE USING (is_admin_or_supervisor() OR agent_id = auth.uid());

-- POLÍTICAS: notifications
CREATE POLICY "Usuarios ven sus notificaciones" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Sistema crea notificaciones" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Usuarios actualizan sus notificaciones" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- POLÍTICAS: payments
CREATE POLICY "Admin y supervisores ven pagos" ON public.payments
  FOR SELECT USING (
    is_admin_or_supervisor() OR
    client_id IN (SELECT id FROM public.clients WHERE profile_id = auth.uid())
  );

CREATE POLICY "Admin y supervisores crean pagos" ON public.payments
  FOR INSERT WITH CHECK (is_admin_or_supervisor());

-- POLÍTICAS: case_status_history
CREATE POLICY "Staff ve historial" ON public.case_status_history
  FOR SELECT USING (
    is_admin_or_supervisor() OR
    case_id IN (SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid())
  );

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Authenticated users upload documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users access own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

-- ============================================================
-- DATOS INICIALES: Admin por defecto
-- ============================================================

-- NOTA: El primer admin se crea mediante Supabase Auth Dashboard
-- o via API con service_role key. El trigger handle_new_user
-- creará el perfil automáticamente.

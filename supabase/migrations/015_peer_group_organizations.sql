-- ============================================================
-- Migration 015: Create peer_group_organizations catalog
-- ============================================================
-- Purpose: implements the intake foundation for Module 13
-- (Subtipo A — Advisory Opinion/No-Objection), the last of the
-- five letterType values of A3's Motor Institucional lacking
-- intake support (see A3_ENGINE_INSTITUCIONAL.md §Subtipo B).
--
-- Rather than asking the client whether a relevant peer
-- organization exists (a question requiring immigration-domain
-- expertise the client doesn't have), the system determines this
-- from a maintained catalog: USCIS's own published list of labor
-- organizations, management organizations, and peer groups known
-- to provide consultation letters for O/P classifications
-- (https://www.uscis.gov, "Lista de Direcciones para Cartas de
-- Consulta... Clasificaciones de Visas O y P"). Not exhaustive —
-- USCIS updates it quarterly and explicitly notes so.
--
-- Scope: O-1A/O-1B only. EB-1A petitions do not require a
-- consultation letter (a different regulatory requirement),
-- confirmed with Alex before this migration.
--
-- Three categories preserve the regulatory distinction the source
-- document itself makes ("consulta de parte de un grupo de
-- colegas, organización laboral, y/u organizaciones
-- administrativas"): labor_organization, management_organization,
-- peer_group.
--
-- Access: staff-only (admin/supervisor/agent), no case_id — this
-- is a shared reference catalog across all cases, not per-case
-- data, unlike every other RLS'd table in this schema.
-- ============================================================

BEGIN;

CREATE TABLE public.peer_group_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('labor_organization', 'management_organization', 'peer_group')),
  professions_covered TEXT NOT NULL,
  contact_name TEXT,
  address TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.peer_group_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_peer_group_organizations"
  ON public.peer_group_organizations
  FOR SELECT TO authenticated
  USING (is_admin_or_supervisor() OR get_user_role() = 'agent');

CREATE TRIGGER set_peer_group_organizations_updated_at
  BEFORE UPDATE ON public.peer_group_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.peer_group_organizations (organization_name, category, professions_covered, contact_name, address, website, phone, email, notes) VALUES
('Actors'' Equity Association (AEA)', 'labor_organization', 'Artistas (excepto músicos), directores de escena, directores auxiliares de escena empleados en teatro en vivo, dramas y musicales teatrales. Incluye teatro de revista o variedades y teatro en parques temáticos.', 'Attn: Immigration', '165 West 46th Street, New York, NY 10036', 'www.actorsequity.org', '212-869-8530', 'immigration@actorsequity.org', NULL),
('American Federation of Musicians (AFM)', 'labor_organization', 'Todos los músicos instrumentistas. Incluye todos los músicos y vocalistas integrados como parte de un grupo musical, conductores, bibliógrafos musicales, arreglistas y compositores.', 'George Fiddler', '1501 Broadway, Suite 600, New York, NY 10036', 'www.afm.org', '212-869-1330', NULL, NULL),
('American Guild of Musical Artists (AGMA)', 'labor_organization', 'Cantantes de concierto y solistas, instrumentistas solistas, bailarines, coreógrafos, directores de escena, asistente de dirección de escena, personal de producción escénica empleados por compañías de baile y ópera y superproducciones de Broadway y off-Broadway, narradores de conciertos, recitales, oratorio, ópera y baile. También compositores, patinadores, actores de circo, mimos, marionetista, y artistas en vivo en formatos de nuevos medios.', 'Susan Davison', 'PO Box 908, New York, NY 10018', 'www.musicalartists.org', '212-265-3687', 'sdavison@musicalartists.org', NULL),
('American Guild of Organists (AGO) National Headquarters', 'labor_organization', 'Organistas y directores de coros.', 'James E. Thomashower', '475 Riverside Drive, Suite 1260, New York, NY 10115', 'www.agohq.org', '212-870-2310', 'jet@agohq.org', NULL),
('American Guild of Variety Artists (AGVA)', 'labor_organization', 'Intérpretes musicales y de variedades en actuaciones en directo en teatro de revistas no literarias, comediantes, patinadores, actores de circo, ciertos artistas conferenciantes, artistas de cabaret y clubes nocturnos y deportistas en espectáculos de entretenimiento no competitivos.', 'Immigration Consultation', '363 Seventh Avenue, 17th Floor, New York, NY 10001-3904', 'www.agvausa.com', '212-675-1003', 'agva@agvausa.com', 'No incluye actores/artistas de teatro (AGMA) ni músicos (AFM) salvo que también canten/bailen/actúen.'),
('The Animation Guild (TAG)', 'labor_organization', 'Artistas de animaciones en el área de Los Ángeles. Local 839 de IATSE.', 'Business Representative', '1105 N Hollywood Way, Burbank, CA 91505', 'animationguild.org/about-the-guild/advisory-opinion', '818-845-7500', 'visas@tag839.org', 'Único local de IATSE que proporciona sus propias opiniones de asesoría.'),
('Association of Theatrical Press Agents and Managers', 'labor_organization', 'Administradores de teatro y salas de concierto, gerentes de compañías, agentes de prensa/publicistas.', 'Tito Sanchez', '14 Penn Plaza, 225 W. 34th Street, Suite 1703, New York, NY 10122', 'www.atpam.com', '212-719-3666', NULL, NULL),
('Directors Guild of America National Headquarters', 'labor_organization', 'Directores, gerentes de unidades de producción, directores auxiliares, directores asociados, coordinadores técnicos y directores de escena en películas teatrales, comerciales, documentales, TV en vivo/pregrabada, videos musicales, y todo tipo de filmes/cintas para videocasetes.', 'Sonja Renz', '7920 Sunset Blvd., Los Angeles, CA 90046', 'www.dga.org', '310-289-2000', 'srenz@dga.org', 'También consulta para extranjeros acompañantes en: director asociado, director de escena, coordinador técnico, gerente de unidades de producción.'),
('International Alliance of Theatrical Stage Employees (IATSE)', 'labor_organization', 'Profesionales en producción de teatro en vivo, cinematografía y TV: cinematógrafos, personal técnico y artístico, animación por computadora, cosmetólogos/estilistas, posproducción, proyección/audiovisuales, artes escénicas, tramoyistas, ferias/exhibiciones, tesorería, boletos, vestuario, transmisión televisiva, conciertos.', 'Davel Hamue/Immigration Dept.', '207 West 25th St., 4th Floor, New York, NY 10011', 'www.iatse-intl.org', '212-730-1770', NULL, 'Excepto Local 839 (Animation Guild), todas las solicitudes de locales de IATSE van por este contacto.'),
('Major League Soccer Players Union', 'labor_organization', 'Futbolistas de la MLS.', NULL, '7373 Wisconsin Avenue, Suite 1800, Bethesda, MD 20814', 'www.mlsplayers.org', '301-657-3535', 'legal@mlsplayers.org', NULL),
('National Basketball Players Association', 'labor_organization', 'Jugadores de baloncesto.', 'Kirk Berger', '1133 Avenue of Americas 5th Fl., New York, NY 10036', 'www.nbpa.com', '212-655-0880', 'kirk.berger@nbpa.com', NULL),
('National Writers Union/UAW Local 1981', 'labor_organization', 'Escritores independientes.', 'Larry Goldbetter', '256 West 38th St., Suite 703, New York, NY 10018', 'www.nwu.org', '212-254-0279', 'lgoldbetter@nwu.org', NULL),
('The NewsGuild - CWA', 'labor_organization', 'Ocupaciones en medios de comunicación: periodistas, escritores, reporteros, fotógrafos, editores, correctores y corresponsales.', 'Dominique Edmondson', '501 Third Street, NW, Washington, DC 20001', 'www.newsguild.org', '202-434-7177', 'dedmondson@cwa-union.org', NULL),
('Screen Actors Guild/American Federation of Television and Radio Artists (SAG-AFTRA)', 'labor_organization', 'Actores, presentadores, locutores, periodistas, bailarines, DJs, redactores/editores de noticias, anfitriones, titiriteros, artistas discográficos, cantantes, acróbatas, dobles de acción, narradores (voz en off) y otros profesionales de medios.', 'Steve Otroshkin', '5757 Wilshire Blvd, 7th Floor, Los Angeles, CA 90036-0800', 'www.sagaftra.org', '323-549-6632', 'visa@sagaftra.org', 'Esta oficina maneja TODAS las consultas; no dirigir a SAG-AFTRA NY.'),
('The Stage Directors and Choreographers Society (SDC)', 'labor_organization', 'Directores y coreógrafos en giras de Broadway y National, off-Broadway, Resident Theatre, Dinner Theatre, Regional Musical Theatre Outdoor, League of Resident Theatres.', NULL, '321 West 44th Street, Suite 804, New York, NY 10036', 'www.sdcweb.org', '212-391-1070', 'info@SDCweb.org', NULL),
('Studio Transportation Drivers—Teamsters Local 399', 'labor_organization', 'Trabajadores de la industria cinematográfica: largometrajes, programas de TV, comerciales, producciones teatrales en vivo.', 'Leo T. Reed, Division Director', '4747 Vineland Avenue, North Hollywood, CA 91602', 'www.ht399.org', '818-985-7374', 'office@ht399.org', 'Pacto con IATSE desde 8/5/2010.'),
('United Scenic Artists (IATSE local 829)', 'labor_organization', 'Diseñadores escénicos profesionales, artistas escénicos, diseñadores de producción, diseñadores de vestuario e iluminación, artistas de dioramas/exposiciones, artistas murales en TV, teatro, producción comercial y cine.', NULL, '29 West 38th Street, 15th Floor, New York, NY 10036', 'www.usa829.org', '212-581-0300', 'visa@usa829.org', NULL),
('Writers Guild of America, East', 'labor_organization', 'Escritores de programas de TV, películas, noticias, documentales, animación, CD-ROM y nuevos medios. Cubre Europa y mitad de Canadá.', 'Anne Burdick', '250 Hudson Street, Suite 700, New York, NY 10013', 'www.wgaeast.org', '212-767-7800', NULL, NULL),
('Writers Guild of America, West', 'labor_organization', 'Igual que WGA East. Cubre Asia y mitad de Canadá.', 'Bertha Garcia', '7000 West 3rd Street, Los Angeles, CA 90048', 'www.wga.org', '323-782-4501', NULL, NULL),
('Alliance of Motion Picture & Television Producers (AMPTP)', 'management_organization', 'Profesionales en producción de películas cinematográficas, TV, series, programas basados en la red, comerciales o videos musicales.', 'Immigration', '15301 Ventura Boulevard, Building E, Sherman Oaks, CA 91403', 'amptp.org/work-visas/', '818-995-3600', 'immigration@amptp.org', NULL),
('Association of Independent Commercial Producers (AICP)', 'management_organization', 'Comerciales. Productores de comerciales en cine, video, digital para anunciantes y agencias.', 'David Stewart, Manager of Membership', '3 West 18th Street, 5th Floor, New York, NY 10011', 'www.aicp.com', '212-929-3000', 'info@aicp.com', 'Solo socios.'),
('American Culinary Federation', 'peer_group', 'Cocinero profesional (chef), cocineros y reposteros.', NULL, '6816 Southpoint Pkwy Ste 400, Jacksonville, FL 32216', 'www.acfchefs.org', '904-484-0228', 'VisaRequests@acfchefs.net', NULL),
('American Folklore Society', 'peer_group', 'Folclore, artes étnicas, artes folclóricas, arte popular, danza folclórica y tradiciones musicales de varias culturas.', NULL, '800 E. Third Street, Bloomington, IN 47405', 'americanfolkloresociety.org', '812-856-2379', 'info@afsnet.org', NULL),
('American Motorcyclist Association', 'peer_group', 'Competencias de motociclismo y eventos de motociclismo recreacional para aficionados.', 'Bill Cumbo', '13515 Yarmouth Drive, Pickerington, OH 43147', 'www.americanmotorcyclist.com', '614-856-1900', NULL, NULL),
('American Motorcyclist Association Pro Racing', 'peer_group', 'Competencias de motociclismo profesional y eventos de motociclismo recreacional para aficionados.', NULL, '525 Fentress Blvd. Suite B, Daytona, FL 32114', 'www.amaproracing.com', '386-492-1014', NULL, NULL),
('American Society for Nutrition', 'peer_group', 'Investigación en los campos de nutrición animal y humana.', NULL, '9211 Corporate Blvd., Suite 300, Rockville, MD 20850', 'www.nutrition.org', '240-428-3650', NULL, NULL),
('American Psychiatric Association', 'peer_group', 'Psiquiatras.', NULL, '800 Maine Ave SW, Suite 900, Washington, DC 20024', 'www.psychiatry.org', '202-559-3900', 'apa@psych.org', NULL),
('American Photographic Artists (APA)', 'peer_group', 'Organizaciones comerciales sin fines de lucro creadas por fotógrafos para fotógrafos.', 'Juliette Wolf-Robin', '5042 Wilshire Blvd., #321, Los Angeles, CA 90036 (LA); P.O.Box 1514, 217 E 70th St., New York, NY 10021 (NY)', 'www.apanational.org', '323-933-1631', 'director@apa-la-.com', NULL),
('The American Institute of Architects (AIA)', 'peer_group', 'Arquitectos.', 'Cassandra Brown, Paralegal, Senior Manager, Intellectual Property', '1735 New York Avenue, NW, Washington, DC 20006', 'www.aia.org', '202-626-7348', 'cbrown@aia.org', NULL),
('American Institute of Graphic Arts (AIGA)', 'peer_group', 'Diseño gráfico, tipografía, diseño de interacción, desarrollo de marca (branding) e identidad.', 'Membership', '228 Park Avenue South, Suite 58603, New York, NY 10003-1502', 'www.aiga.org', '212-807-1990', 'membership@aiga.org', NULL),
('The Asia Society', 'peer_group', 'Artistas asiáticos y eventos culturales.', 'Director of Performances, Films and Lectures Dept.', '725 Park Avenue, New York, NY 10021', 'www.asiasociety.org', '212-288-6400', 'info@asiasociety.org', NULL),
('Association of Performing Arts Presenters', 'peer_group', 'Representantes de artes escénicas: centros e instalaciones municipales/universitarias, centros de artes escénicas sin fines de lucro, organizaciones culturalmente específicas, gobiernos extranjeros, agencias de artistas, directores, compañías de giras.', NULL, '1211 Connecticut Ave., NW, Suite 200, Washington, DC 20036', 'www.apap365.org', '202-833-2787', 'info@artspresenters.org', 'Solo miembros.'),
('Association of Professional Landscape Designers', 'peer_group', 'Profesionales en el campo del diseño paisajístico.', NULL, '2207 Forest Hills Drive, Harrisburg, PA 17112', 'www.apld.org', '717-238-9780', 'communications@apld.org', NULL),
('The Authors Guild', 'peer_group', 'Escritores empleados.', 'Michael Gross', '31 East 32nd Street, 7th Floor, New York, NY 10016', 'www.authorsguild.org', '212-563-5904', 'mgross@authorsguild.org', NULL),
('Carnegie Hall', 'peer_group', 'Música y músicos.', NULL, '881 Seventh Avenue, New York, NY 10019', 'www.carnegiehall.org', '212-903-9600', NULL, NULL),
('The One Club for Creativity', 'peer_group', 'Comunicaciones visuales: publicidad, diseño, medios interactivos.', 'Justin Epstein', '260 Fifth Avenue, Second Floor, New York, NY 10001', 'www.oneclub.org', '212-979-1900', 'info@oneclub.org', NULL),
('Dance/USA', 'peer_group', 'Bailarines, grupos de baile, coreógrafos, instructores de baile, profesores de baile.', 'Director of Government Affairs', '1029 Vermont Ave, NW, Washington, DC 20005', 'www.danceusa.org', '202-833-1717', 'advocacy@danceusa.org', NULL),
('Colegio de Productores de Espectaculos Publicos de Puerto Rico, Inc.', 'peer_group', 'Supervisa todos los eventos/conciertos públicos de productores en Puerto Rico.', NULL, 'P.O. Box 13717, San Juan, Puerto Rico 00908', NULL, '787-721-2006', NULL, NULL),
('Dramatists Guild of America', 'peer_group', 'Dramaturgos, compositores, letristas y libretistas que componen para escenarios en vivo.', 'Ginnila Pérez', '1501 Broadway, Suite 701, New York, NY 10036', 'www.dramatistsguild.com', '212-398-9366', 'gperez@dramatistsguild.com', NULL),
('English-Speaking Union of the United States', 'peer_group', 'Organización educativa sin fines de lucro para celebrar el inglés como idioma compartido, oportunidades educativas y culturales.', 'The Andrew Romay New Immigrant Center', '144 East 39th Street, New York, NY 10016', 'www.esuus.org', '212-818-1200', 'info@esuus.org', NULL),
('Fractured Atlas', 'peer_group', 'Artes: escénicas, visual, literaria, diseño y medios de comunicación.', NULL, '248 West 35th Street, 10th Floor, New York, NY 10001-2505', 'www.fracturedatlas.org', '888-692-7878', 'support@fracturedatlas.org', NULL),
('Institute for Certification of Computing Professionals', 'peer_group', 'Profesionales en la industria de la informática.', NULL, '2400 East Devon Avenue, Suite 281, Des Plaines, IL 60018', 'www.iccp.org', '847-299-4227', 'office2@iccp.org', NULL),
('International Brotherhood of Magicians', 'peer_group', 'Asociación de magos profesionales.', NULL, '13 Point West Blvd., St. Charles, MO 63301-4431', 'www.magician.org', '636-724-2400', 'office@magician.org', 'Solo disponible para miembros.'),
('International Council of Air Shows (ICAS)', 'peer_group', 'Acróbatas aéreos y organizadores de espectáculos aéreos.', NULL, '748 Miller Drive SE, Suite G-3, Leesburg, VA 20175', 'www.airshows.aero', '703-779-8510', NULL, NULL),
('International Game Developers Association (IGDA)', 'peer_group', 'Desarrolladores de juegos de video/computadoras.', NULL, '19 Mantau Road, Mt. Royal, NJ 08061', 'www.igda.org', '856-423-2990', 'info@igda.org', NULL),
('IMG Artists North/South America', 'peer_group', 'Gestión artística para clientes independientes, instituciones artísticas, salas de conciertos y corporaciones comprometidas culturalmente.', NULL, 'Pleiades House, 7 West 54th Street, New York, NY 10019', 'https://imgartists.com', '212-994-3500', 'artistsny@imgartists.com', 'Sede este; sede oeste en Burbank, CA (818-260-8523, artistsla@imgartists.com).'),
('League of American Orchestras', 'peer_group', 'Orquestas sinfónicas, solistas, directores de orquestas y músicos tocando con orquestas sinfónicas.', NULL, NULL, 'www.americanorchestras.org', '202-776-0215', 'advocacy@americanorchestras.org', NULL),
('Music Video Production Association (MVPA)', 'peer_group', 'Compañías de producción y post-producción de videos musicales, editores, directores, productores, cinematógrafos, coreógrafos, supervisores de guiones, animadores, maquillistas.', 'Fuliane Petikyan', '201 N. Occidental Street, Los Angeles, CA 90026', 'www.mvpa.com', NULL, 'fuliane@mac.com', NULL),
('National Storytelling Network', 'peer_group', 'Preservación y crecimiento del arte de contar cuentos.', NULL, 'P.O. Box 795, Jonesborough, TN 37659', 'www.storynet.org', '800-525-4514', NULL, NULL),
('Opera America', 'peer_group', 'Cantantes de ópera y personal de apoyo, como diseñadores y directores de escena.', 'Justin Giles', '330 7th Avenue, 16th Floor, New York, NY 10001', 'www.operaamerica.org', '212-796-8620', 'jgiles@operaamerica.org', 'Indicar en el asunto si requiere servicio expedito/urgente.'),
('Producers Guild of America, Inc.', 'peer_group', 'Miembros del equipo de producción en cine, televisión y nuevos medios.', NULL, NULL, 'https://producersguild.org/01-02-visa/', '310-358-9020', 'visaapplications@producersguild.org', 'Solo visas O-1 y O-2.'),
('Professional Skaters Association', 'peer_group', 'Patinadores y entrenadores de patinaje.', NULL, '3006 Allegro Park Lane SW, Rochester, MN 55902', 'https://www.skatepsa.com/', '507-281-5122', 'office@skatepsa.com', NULL),
('Skate Park Association International', 'peer_group', 'Patinadores, parques de patinaje (skate).', 'Heidi Lemmon', '2118 Wilshire Blvd. # 622, Santa Monica, CA 90403', 'https://skateparkassociation.org/', '310-827-2700', 'Heidi@spausa.org', NULL),
('Theatre Communications Group', 'peer_group', 'Teatro profesional, comunitario y universitario. Compañías de teatro y artistas independientes.', 'Erica Lauren Ortiz', '520 Eighth Ave., 20th Floor, New York, NY 10018-4156', 'www.tcg.org', '212-609-5900', 'eortiz@tcg.org', NULL),
('U.S. Chess Federation', 'peer_group', 'Jugadores de ajedrez; representa a EE.UU. en la federación mundial de ajedrez y junta evaluadora de torneos.', NULL, 'P.O. Box 3967, Crossville, TN 38557', 'https://new.uschess.org', '931-787-1234', 'executive@uschess.org', NULL),
('USA Rugby', 'peer_group', 'Organización nacional para el deporte de rugby en EE.UU., incluyendo Juegos Olímpicos.', 'Melissa Von Keyserling', '2655 Crescent Dr., Unit A, Lafayette, CO 80026', 'https://usa.rugby/', '303-539-0300', NULL, NULL),
('U.S. Dressage Federation', 'peer_group', 'Competidores de doma de exhibición, estilo libre musical, cría de caballos deportivos, espectáculos con varios caballos y jinetes.', NULL, '4051 Iron Works Pkwy, Lexington, KY 40511', 'www.usdf.org', '859-971-2277', 'usdressage@usdf.org', NULL),
('U.S. Equestrian Federation (USEF)', 'peer_group', 'Competidores ecuestres; órgano nacional rector del deporte ecuestre, incluidos los Juegos Olímpicos.', 'Amelia Sandot', '4047 Iron Works Pkwy, Lexington, KY 40511', 'www.usef.org', '859-258-2472', 'asandot@usef.org', NULL),
('U.S. Figure Skating Association', 'peer_group', 'Organización nacional para el deporte de patinaje artístico, incluyendo los Juegos Olímpicos.', 'Kristen Habgood', '20 First Street, Colorado Springs, CO 80906', 'www.usfsa.org', '719-635-5200', 'khabgood@usfigureskating.org', NULL),
('United States Polo Association', 'peer_group', 'Deporte de polo.', 'Bev Basist', '12300 South Shore Blvd., Suite 218, Wellington, FL 33414', NULL, '800-232-8772', 'bbasist@uspolo.org', 'Solo miembros.'),
('United States Trotting Association', 'peer_group', 'Dueños, criadores, conductores, entrenadores y funcionarios del deporte del trote. Organismo regulador de carreras con arneses.', 'Dan Leary / T.C. Lane', '6130 S. Sunbury Road, Westerville, OH 43081-9309', 'www.ustrotting.com', '614-224-2291', NULL, NULL),
('Visual Effects Society', 'peer_group', 'Profesionales de efectos visuales: artistas, tecnólogos, modelistas, educadores, líderes de estudios, supervisores, RR.PP., productores en cine, TV, comerciales, videos musicales y juegos.', 'Colleen Kelly', '5805 Sepulveda Blvd., Suite 620, Sherman Oaks, CA 91411', 'https://vesglobal.org/', '818-981-7861', 'colleen@visualeffectssociety.com', NULL),
('Western States Arts Federation', 'peer_group', 'Artistas, músicos, expertos en tecnología y administración de las artes. Todos los campos de arte y cultura.', 'Cynthia Chen', '1536 Wynkoop St. Ste 522, Denver, Colorado 80202', 'www.westaf.org', '303-629-1166', 'consultationletters@westaf.org', NULL);

COMMIT;

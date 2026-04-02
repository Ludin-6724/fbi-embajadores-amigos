/* FBI Embajadores Amigos - Content Schema & Mock Data */

-- 1. Create Posts table (Comunidad)
create table public.posts (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  likes integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.posts enable row level security;
create policy "Posts are viewable by everyone." on public.posts for select using (true);
create policy "Authenticated users can insert posts." on public.posts for insert with check (auth.uid() = author_id);

-- 2. Create Events table (Retiros, Congresos, etc)
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  event_date timestamp with time zone not null,
  location text not null,
  tag text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.events enable row level security;
create policy "Events are viewable by everyone." on public.events for select using (true);

-- 3. Create Streaks table (Progreso del usuario)
create table public.streaks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  streak_days integer default 0,
  last_checkin timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.streaks enable row level security;
create policy "Streaks are viewable by everyone." on public.streaks for select using (true);

-- 4. Create Testimonials table (Para la página web)
create table public.testimonials (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  role text not null,
  story text not null,
  image_url text,
  featured boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.testimonials enable row level security;
create policy "Testimonials are viewable by everyone." on public.testimonials for select using (true);

/* ==================================================== */
/* DUMMY DATA FOR VISUALIZATION                         */
/* Creates an anonymous server placeholder profile      */
/* ==================================================== */

-- Create a dummy auth.users layer user manually to satisfy constraints
-- Replace this with real users later
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values 
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'dummy@fbi.com', 'dummy_hash', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name": "Agente Base"}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Since the trigger might fire automatically, we just do an UPSERT
insert into public.profiles (id, username, full_name, avatar_url)
values ('11111111-1111-1111-1111-111111111111', 'FBIoficial', 'FBI Embajadores', 'https://api.dicebear.com/7.x/open-peeps/svg?seed=FBI')
ON CONFLICT (id) DO UPDATE SET username = 'FBIoficial';

-- Insert Dummy Post
insert into public.posts (author_id, content, likes) values
('11111111-1111-1111-1111-111111111111', 'Acabo de completar mi tercer día de conexión sin distracciones. Dios es bueno.', 42),
('11111111-1111-1111-1111-111111111111', 'El taller cambió mi perspectiva. Las redes ahora son mi campo de misión.', 128);

-- Insert Dummy Events
insert into public.events (title, description, event_date, location, tag) values
('Retiro Nacional FBI', 'Un fin de semana para desconectar de la red y conectar con el creador.', (now() + interval '14 days'), 'Campamento Bethel', 'Congreso'),
('Ayuno Digital Colectivo', '24 horas de desconexión masiva donde toda la comunidad embajadora orará junta.', (now() + interval '3 days'), 'Online (Grupos de Paz)', 'Desafío');

-- Insert Dummy Testimonials
insert into public.testimonials (name, role, story, image_url, featured) values
('David', 'Líder Juvenil', 'Estaba hundido en horas de pantalla vacías. FBI me enseñó a retomar el control y ser un agente de luz para mi universidad.', 'https://api.dicebear.com/7.x/open-peeps/svg?seed=David', true),
('Lucía', 'Embajadora', 'Entendí que mi dispositivo no me define. Aprendí a compartir la Palabra en mis historias sin sentir temor o vergüenza.', 'https://api.dicebear.com/7.x/open-peeps/svg?seed=Lucia', true);

-- Insert Dummy Streak
insert into public.streaks (user_id, streak_days) values
('11111111-1111-1111-1111-111111111111', 14);

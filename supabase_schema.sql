-- 1. Create custom types
CREATE TYPE community_role AS ENUM ('member', 'admin', 'founder');

-- 2. Create the Profiles table 
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone,

  primary key (id)
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- 3. Create Communities table
create table public.communities (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  owner_id uuid references public.profiles(id) not null,
  is_official boolean default false, -- Determines if it's an overarching church community versus user-made
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.communities enable row level security;
create policy "Communities are viewable by everyone." on communities for select using (true);
create policy "Anyone authenticated can create a community." on communities for insert with check (auth.role() = 'authenticated');
create policy "Only owner can update community." on communities for update using (auth.uid() = owner_id);

-- 4. Create Community Memberships
create table public.community_members (
  id uuid default uuid_generate_v4() primary key,
  community_id uuid references public.communities(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role community_role default 'member'::community_role not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(community_id, user_id)
);

alter table public.community_members enable row level security;
create policy "Members are viewable by everyone." on community_members for select using (true);
create policy "Authenticated users can join communities." on community_members for insert with check (auth.uid() = user_id);
create policy "Users can leave communities." on community_members for delete using (auth.uid() = user_id);

-- 5. Set up automatic profile trigger when new user signs up via Auth
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Note: The "Gran Comunidad Inicial" feature is handled implicitly at logic level. 
-- Any verified `auth.users` inherently belongs to the FBI system. Table `community_members` is used only for extra sub-groups.

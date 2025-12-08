-- Basic schema for Lukas-VINE

create extension if not exists pgcrypto; -- for gen_random_uuid() in some Postgres setups

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  full_name text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists plants (
  id uuid primary key default gen_random_uuid(),
  common_name text,
  scientific_name text,
  data jsonb,
  created_at timestamptz default now()
);

create table if not exists chemicals (
  id uuid primary key default gen_random_uuid(),
  name text,
  manufacturer text,
  properties jsonb,
  created_at timestamptz default now()
);

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  level text,
  message text,
  meta jsonb,
  created_at timestamptz default now()
);

-- Simple index to speed up searches on common_name
create index if not exists idx_plants_common_name on plants using gin (to_tsvector('english', coalesce(common_name,'')));

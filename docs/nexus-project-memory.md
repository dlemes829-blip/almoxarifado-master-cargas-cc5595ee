# Nexus project memory

Project: Almoxarifado Master Cargas
Kind: fullstack
Last instruction: Refactor and improve the current project
Updated: 2026-06-07T18:07:05.938Z

## Priority files
- package.json
- supabase/schema.sql

## Engineer notes
The Nexus Engineer must read this context before applying further changes, preserve existing behavior, update preview files, run validation and only publish after the user approves the preview.

## File excerpts

### package.json
```
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "tsx script/build.ts",
    "start": "NODE_ENV=production node dist/index.cjs",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@jridgewell/trace-mapping": "^0.3.25",
    "@radix-ui/react-accordion": "^1.2.4",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-aspect-ratio": "^1.1.3",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-collapsible": "^1.1.4",
    "@radix-ui/react-context-menu": "^2.2.7",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-hover-card": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-menubar": "^1.1.7",
    "@radix-ui/react-navigation-menu": "^1.2.6",
    "@radix-ui/react-popover": "^1.1.7",
    "@radix-ui/react-progress": "^1.1.3",
    "@radix-ui/react-radio-group": "^1.2.4",
    "@radix-ui/react-scroll-area": "^1.2.4",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.4",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-toggle": "^1.1.3",
    "@radix-ui/react-toggle-group": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.2.0",
    "@tanstack/react-query": "^5.95.2",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/jspdf": "^1.3.3",
    "@types/multer": "^2.0.0",
    "barcode-detector": "^3.1.0",
    "bcryptjs": "^3.0.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "connect-pg-simple": "^10.0.0",
    "date-fns": "^3.6.0",
    "drizzle-orm": "^0.39.3",
    "drizzle-zod": "^0.7.0",
    "embla-carousel-react": "^8.6.0",
    "express": "^5.0.1",
    "express-session": "^1.18.1",
    "framer-motion": "^11.18.2",
    "input-otp": "^1.4.2",
    "jsonwebtoken": "^9.0.3",
    "jspdf": "^
```

### supabase/schema.sql
```
-- Supabase schema for Almoxarifado Master Cargas
create extension if not exists pgcrypto;

create table if not exists public.almoxarifado_master_cargas_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.almoxarifado_master_cargas_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.almoxarifado_master_cargas_workspaces(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  amount numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.almoxarifado_master_cargas_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.almoxarifado_master_cargas_workspaces(id) on delete cascade,
  actor text not null default 'Agent Nexus',
  event text not null,
  created_at timestamptz not null default now()
);

alter table public.almoxarifado_master_cargas_workspaces enable row level security;
alter table public.almoxarifado_master_cargas_items enable row level security;
alter table public.almoxarifado_master_cargas_activity enable row level security;

create policy "almoxarifado_master_cargas_workspaces_read" on public.almoxarifado_master_cargas_workspaces for select using (true);
create policy "almoxarifado_master_cargas_items_read" on public.almoxarifado_master_cargas_items for select using (true);
create policy "almoxarifado_master_cargas_activity_read" on public.almoxarifado_master_cargas_activity for select using (true);

```
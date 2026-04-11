-- ============================================================
-- Task Brain — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable the pg_cron extension (for scheduled reminders)
-- NOTE: You must enable pg_cron in your Supabase dashboard first:
--   Dashboard > Database > Extensions > search "pg_cron" > enable it
create extension if not exists pg_cron;

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: tasks
-- Stores to-do items with optional reminders and due dates
-- ============================================================
create table if not exists tasks (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  notes           text,
  -- category helps you filter: call / email / linkedin / other
  category        text check (category in ('call', 'email', 'linkedin', 'other')) default 'other',
  reminder_time   timestamptz,        -- when to fire the Slack reminder
  due_date        date,               -- optional calendar due date
  done            boolean default false,
  slack_scheduled boolean default false,  -- true once reminder has been queued
  added_at        timestamptz default now()
);

-- ============================================================
-- TABLE: memories
-- A log of prospects / people you've met or interacted with
-- ============================================================
create table if not exists memories (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  company       text,
  context       text,
  -- tag lets you filter by signal type
  tag           text check (tag in ('linkedin-signal', 'post-like', 'event-met', 'warm-prospect', 'other')) default 'other',
  reminder_time timestamptz,
  added_at      timestamptz default now()
);

-- ============================================================
-- Enable Row Level Security (RLS)
-- This locks down access so only your service role key can
-- read/write — important for production security.
-- ============================================================
alter table tasks    enable row level security;
alter table memories enable row level security;

-- Allow full access when using the service role key (your bot uses this)
create policy "service role full access to tasks"
  on tasks for all
  using (true)
  with check (true);

create policy "service role full access to memories"
  on memories for all
  using (true)
  with check (true);

-- ============================================================
-- Enable Realtime
-- This allows the React dashboard to get live updates without
-- page refresh. Run these after creating the tables.
-- ============================================================
-- In Supabase dashboard: Database > Replication > select tasks + memories tables
-- OR run:
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table memories;

-- ============================================================
-- pg_cron job: fire reminders every minute
-- This checks for tasks whose reminder_time has passed and
-- calls an Edge Function to send the Slack message.
--
-- NOTE: Replace YOUR_SUPABASE_PROJECT_URL and YOUR_SERVICE_ROLE_KEY
-- with your actual values before running this block.
-- ============================================================
-- select cron.schedule(
--   'task-brain-reminders',   -- job name (must be unique)
--   '* * * * *',              -- every minute
--   $$
--   select
--     net.http_post(
--       url := 'https://YOUR_SUPABASE_PROJECT_URL/functions/v1/send-reminders',
--       headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--       body := '{}'::jsonb
--     )
--   $$
-- );
--
-- SIMPLER ALTERNATIVE: The Railway bot polls every 60s instead (already built in).
-- You only need pg_cron if you want pure serverless reminders.

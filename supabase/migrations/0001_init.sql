-- LuxuryPad schema.
--
-- STATUS: written and reviewed, NOT applied — no Supabase project is
-- provisioned for this environment. The running app reads chain state directly
-- (see src/lib/indexer/launches.ts); this schema is the durable-storage layer
-- that slots in behind the same interfaces.
--
-- Design rule that drives the policies below: onchain facts are written only by
-- the indexer (service role). A user may edit their own profile and their own
-- off-chain launch metadata, and nothing else.

create extension if not exists "uuid-ossp";

-- ——— Identity ———————————————————————————————————————————————————————————————

create table if not exists profiles (
  wallet          text primary key check (wallet ~ '^0x[a-f0-9]{40}$'),
  username        text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name    text check (char_length(display_name) <= 48),
  avatar_url      text,
  bio             text check (char_length(bio) <= 280),
  -- Immutable X user id, kept separate from the mutable handle. The handle is
  -- display only and is never an authentication authority.
  x_user_id       text unique,
  x_handle        text,
  joined_at       timestamptz not null default now()
);

create table if not exists wallet_nonces (
  nonce       text primary key,
  wallet      text,
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz
);
create index if not exists wallet_nonces_expiry on wallet_nonces (expires_at);

create table if not exists wallet_sessions (
  id          uuid primary key default uuid_generate_v4(),
  wallet      text not null references profiles(wallet) on delete cascade,
  chain_id    integer not null,
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);

-- ——— Registry ————————————————————————————————————————————————————————————————

create table if not exists stock_token_assets (
  address             text primary key check (address ~ '^0x[a-f0-9]{40}$'),
  asset_id            text not null,
  symbol              text not null,
  name                text not null,
  chain_id            integer not null,
  decimals            integer not null default 18,
  logo_url            text,
  current_multiplier  numeric not null default 1,
  -- Verified against the Pons factory, not assumed.
  pair_approved       boolean not null default false,
  pair_checked_at     timestamptz
);

create table if not exists luxury_companies (
  id           text primary key,
  company_name text not null,
  stock_ticker text,
  sector       text not null,
  country      text not null,
  website      text,
  note         text,
  enabled      boolean not null default true
);

create table if not exists themes (
  id    text primary key,
  title text not null,
  blurb text
);

create table if not exists theme_companies (
  theme_id   text references themes(id) on delete cascade,
  company_id text references luxury_companies(id) on delete cascade,
  primary key (theme_id, company_id)
);

-- ——— Protocol provenance —————————————————————————————————————————————————————

-- Every launch records the deployment it was created under so a future Pons
-- release never retroactively rewrites the meaning of old rows.
create table if not exists launch_protocol_deployments (
  protocol_version text primary key,
  chain_id         integer not null,
  factory          text not null,
  router           text,
  hook             text,
  locker           text,
  first_seen_block bigint
);

create table if not exists luxurypad_launches (
  token                text primary key check (token ~ '^0x[a-f0-9]{40}$'),
  curve                text not null,
  creator              text not null,
  quote_asset          text not null,
  graduation_threshold numeric not null,
  protocol_version     text not null references launch_protocol_deployments(protocol_version),
  factory              text not null,
  block_number         bigint not null,
  tx_hash              text not null unique,
  launched_at          timestamptz not null,
  name                 text,
  symbol               text,
  phase                text not null default 'curve'
                       check (phase in ('curve','ready_to_graduate','graduated'))
);
create index if not exists launches_creator on luxurypad_launches (creator);
create index if not exists launches_quote on luxurypad_launches (quote_asset);

-- Creator-supplied, off-chain only. Never mixed with onchain columns.
create table if not exists launch_metadata (
  token       text primary key references luxurypad_launches(token) on delete cascade,
  description text check (char_length(description) <= 600),
  image_url   text,
  website     text,
  x_url       text,
  telegram    text,
  updated_at  timestamptz not null default now()
);

create table if not exists trades (
  id        uuid primary key default uuid_generate_v4(),
  token     text not null references luxurypad_launches(token) on delete cascade,
  side      text not null check (side in ('buy','sell')),
  trader    text not null,
  amount_in numeric not null,
  amount_out numeric not null,
  block_number bigint not null,
  tx_hash   text not null,
  log_index integer not null,
  occurred_at timestamptz not null,
  unique (tx_hash, log_index)
);
create index if not exists trades_token_time on trades (token, occurred_at desc);

create table if not exists launch_snapshots (
  token        text not null references luxurypad_launches(token) on delete cascade,
  captured_at  timestamptz not null default now(),
  quote_reserve numeric not null,
  token_reserve numeric not null,
  real_quote_reserve numeric not null,
  progress     numeric not null,
  primary key (token, captured_at)
);

create table if not exists creator_fee_snapshots (
  curve       text not null,
  captured_at timestamptz not null default now(),
  creator     text not null,
  balance     numeric not null,
  quote_asset text not null,
  primary key (curve, captured_at)
);

create table if not exists favorites (
  wallet text not null references profiles(wallet) on delete cascade,
  token  text not null references luxurypad_launches(token) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wallet, token)
);

-- ——— Indexer bookkeeping —————————————————————————————————————————————————————

create table if not exists indexer_state (
  id                  text primary key,
  last_processed_block bigint not null,
  updated_at          timestamptz not null default now()
);

create table if not exists security_events (
  id         uuid primary key default uuid_generate_v4(),
  kind       text not null,
  wallet     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- ——— Row level security ——————————————————————————————————————————————————————

alter table profiles              enable row level security;
alter table luxurypad_launches    enable row level security;
alter table launch_metadata       enable row level security;
alter table trades                enable row level security;
alter table launch_snapshots      enable row level security;
alter table creator_fee_snapshots enable row level security;
alter table favorites             enable row level security;
alter table stock_token_assets    enable row level security;
alter table luxury_companies      enable row level security;
alter table themes                enable row level security;
alter table theme_companies       enable row level security;
alter table wallet_nonces         enable row level security;
alter table wallet_sessions       enable row level security;
alter table indexer_state         enable row level security;
alter table security_events       enable row level security;

-- The authenticated wallet, lowercased, from the session JWT.
create or replace function auth_wallet() returns text
language sql stable as $$
  select lower(nullif(current_setting('request.jwt.claims', true)::json->>'sub', ''))
$$;

-- Public read for discovery data.
create policy "public read launches"   on luxurypad_launches    for select using (true);
create policy "public read metadata"   on launch_metadata       for select using (true);
create policy "public read trades"     on trades                for select using (true);
create policy "public read snapshots"  on launch_snapshots      for select using (true);
create policy "public read fees"       on creator_fee_snapshots for select using (true);
create policy "public read assets"     on stock_token_assets    for select using (true);
create policy "public read companies"  on luxury_companies      for select using (true);
create policy "public read themes"     on themes                for select using (true);
create policy "public read theme_map"  on theme_companies       for select using (true);
create policy "public read profiles"   on profiles              for select using (true);

-- A user owns exactly their own profile row.
create policy "own profile insert" on profiles for insert
  with check (lower(wallet) = auth_wallet());
create policy "own profile update" on profiles for update
  using (lower(wallet) = auth_wallet())
  with check (lower(wallet) = auth_wallet());

-- Off-chain metadata may be written only by the launch's onchain creator.
create policy "creator writes own metadata" on launch_metadata for insert
  with check (exists (
    select 1 from luxurypad_launches l
    where l.token = launch_metadata.token and lower(l.creator) = auth_wallet()
  ));
create policy "creator updates own metadata" on launch_metadata for update
  using (exists (
    select 1 from luxurypad_launches l
    where l.token = launch_metadata.token and lower(l.creator) = auth_wallet()
  ))
  with check (exists (
    select 1 from luxurypad_launches l
    where l.token = launch_metadata.token and lower(l.creator) = auth_wallet()
  ));

-- Favourites are private to their owner.
create policy "own favorites read"   on favorites for select using (lower(wallet) = auth_wallet());
create policy "own favorites insert" on favorites for insert with check (lower(wallet) = auth_wallet());
create policy "own favorites delete" on favorites for delete using (lower(wallet) = auth_wallet());

-- No policies are defined for: luxurypad_launches (write), trades, snapshots,
-- creator_fee_snapshots, stock_token_assets, launch_protocol_deployments,
-- wallet_nonces, wallet_sessions, indexer_state and security_events.
-- With RLS enabled and no permissive policy, every non-service-role write is
-- denied. Onchain truth is therefore writable only by the indexer.

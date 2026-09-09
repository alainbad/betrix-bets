// PGLITE_MODULE may point to an isolated @electric-sql/pglite installation.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
create table profiles(id uuid primary key,username text,account_id text,parent_id uuid,status text default 'active',role text);
create function is_ultra_admin(u uuid) returns boolean language sql as $$select exists(select 1 from profiles where id=u and role='ultra_admin')$$;
create function is_admin(u uuid) returns boolean language sql as $$select is_ultra_admin(u)$$;
create function is_super_agent(u uuid) returns boolean language sql as $$select exists(select 1 from profiles where id=u and role='super_agent')$$;
create function is_agent_tier(u uuid) returns boolean language sql as $$select exists(select 1 from profiles where id=u and role='agent')$$;
create function set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create table wallets(id uuid primary key default gen_random_uuid(),user_id uuid unique,available_balance numeric(14,2) default 1000 check(available_balance>=0),reserved_balance numeric(14,2) default 0 check(reserved_balance>=0),lifetime_virtual_staked numeric default 0,lifetime_virtual_returned numeric default 0);
create type wallet_transaction_type as enum ('casino_stake','casino_return');
create table wallet_transactions(id uuid default gen_random_uuid(),user_id uuid,wallet_id uuid,transaction_type wallet_transaction_type,amount numeric,balance_before numeric,balance_after numeric,reference_type text,reference_id uuid,description text);
create table casino_rounds(id uuid primary key default gen_random_uuid(),user_id uuid,game_id text,stake numeric check(stake>0),outcome text,multiplier numeric(8,3),payout numeric);
create function play_casino_round(_game_id text,_stake numeric) returns jsonb language plpgsql as $$begin return '{}';end$$;
create function play_html5_casino_round(_game_id text,_stake numeric) returns jsonb language plpgsql as $$begin return '{}';end$$;
`);
for (const name of [
  "20260908000000_velvet_server_rounds.sql",
  "20260908010000_withdrawal_transaction_types.sql",
  "20260908020000_withdrawal_review.sql",
  "20260908030000_velvet_round_guardrails.sql",
])
  await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
const u = "00000000-0000-0000-0000-000000000001",
  a = "00000000-0000-0000-0000-000000000002",
  p = "00000000-0000-0000-0000-000000000003",
  other = "00000000-0000-0000-0000-000000000004";
for (const [id, role, parent] of [
  [u, "ultra_admin", null],
  [a, "agent", u],
  [p, "player", a],
  [other, "agent", u],
]) {
  await db.query("insert into auth.users values($1)", [id]);
  await db.query("insert into profiles(id,username,role,parent_id) values($1,$2,$2,$3)", [
    id,
    role,
    parent,
  ]);
  await db.query("insert into wallets(user_id) values($1)", [id]);
}
const auth = async (id, role = "authenticated") => {
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
    [id, role],
  );
};
const wallet = async () =>
  (await db.query("select available_balance,reserved_balance from wallets where user_id=$1", [p]))
    .rows[0];
const run = async (sql, args = []) => {
  const r = await db.query(sql, args);
  return Object.values(r.rows[0])[0];
};
await auth(p);
await assert.rejects(
  run("select settle_velvet_round($1,$2,'velvet-vault',0,10,20,'{}',null,null)", [
    p,
    crypto.randomUUID(),
  ]),
);
await auth(p, "service_role");
const request = crypto.randomUUID();
let response = await run(
  "select settle_velvet_round($1,$2,'velvet-vault',0,10,20,'{}',null,null)",
  [p, request],
);
assert.equal(Number(response.balanceAfter), 1010);
response = await run("select settle_velvet_round($1,$2,'velvet-vault',0,10,20,'{}',null,null)", [
  p,
  request,
]);
assert.equal(Number((await wallet()).available_balance), 1010);
await assert.rejects(
  run("select settle_velvet_round($1,$2,'velvet-vault',0,10,20,'{}',null,null)", [
    p,
    crypto.randomUUID(),
  ]),
);
assert.equal(Number((await wallet()).available_balance), 1010);
await assert.rejects(
  run("select settle_velvet_round($1,$2,'velvet-candy',0,10,20,'{}',null,null)", [p, request]),
);
await auth(p);
let w = await run("select player_request_withdrawal(100)");
const id = w.request_id;
assert.equal(Number((await wallet()).available_balance), 910);
assert.equal(Number((await wallet()).reserved_balance), 100);
await auth(other);
await assert.rejects(run("select agent_approve_withdrawal($1)", [id]));
await auth(a);
await assert.rejects(run("select settle_player_withdrawal($1,'TEST-1')", [id]));
await run("select agent_approve_withdrawal($1)", [id]);
await assert.rejects(run("select ultra_admin_approve_withdrawal($1)", [id]));
await auth(u);
await run("select ultra_admin_approve_withdrawal($1)", [id]);
await auth(a);
await run("select settle_player_withdrawal($1,'TEST-1')", [id]);
assert.equal(Number((await wallet()).reserved_balance), 0);
await assert.rejects(run("select settle_player_withdrawal($1,'TEST-1')", [id]));
await auth(p);
w = await run("select player_request_withdrawal(100)");
await auth(a);
await run("select reject_withdrawal_request($1,'Test rejection')", [w.request_id]);
assert.equal(Number((await wallet()).available_balance), 910);
assert.equal(Number((await wallet()).reserved_balance), 0);
await assert.rejects(run("select play_html5_casino_round('velvet-vault',10)"));
await assert.rejects(run("select play_casino_round('velvet-roulette',10)"));
await db.exec("set role authenticated");
await assert.rejects(db.query("select * from velvet_sessions"));
await db.exec("reset role");
await db.close();
console.log(
  "PASS: migrations, settlement authorization, idempotency, stale-state rollback, withdrawal permissions/stages/refund, hidden bonus state, legacy endpoint isolation.",
);

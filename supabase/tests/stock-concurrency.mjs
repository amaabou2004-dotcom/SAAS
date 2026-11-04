import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const databaseUrl = process.env.SUPABASE_DB_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const fixture = {
  userId: randomUUID(),
  tenantId: randomUUID(),
  roleId: randomUUID(),
  productId: randomUUID(),
  variantId: randomUUID(),
};

const first = new pg.Client({ connectionString: databaseUrl });
const second = new pg.Client({ connectionString: databaseUrl });

async function postOperation(client, operationType, key, lines, reason, reversesOperationId = null) {
  await client.query('begin');
  try {
    await client.query('set local role authenticated');
    await client.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ sub: fixture.userId, role: 'authenticated' }),
    ]);
    const result = await client.query(
      `select public.post_stock_operation(
        $1::uuid, $2::text, $3::text, $4::text, null,
        $5::jsonb, $6::uuid
      ) as operation_id`,
      [fixture.tenantId, operationType, key, reason, JSON.stringify(lines), reversesOperationId],
    );
    await client.query('commit');
    return result.rows[0].operation_id;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

function postAdjustment(client, key, quantity) {
  return postOperation(client, 'adjustment', key, [{
    variant_id: fixture.variantId,
    location_id: fixture.locationId,
    quantity_delta: quantity,
  }], 'Test concurrent');
}

function postReversal(client, key, operationId) {
  return postOperation(client, 'reversal', key, [], 'Correction concurrente', operationId);
}

async function balance(client = first) {
  const result = await client.query(
    'select on_hand::float8 as on_hand from public.stock_balances where tenant_id = $1 and variant_id = $2 and location_id = $3',
    [fixture.tenantId, fixture.variantId, fixture.locationId],
  );
  return result.rows[0]?.on_hand;
}

async function operationCount(key) {
  const result = await first.query(
    'select count(*)::integer as count from public.stock_operations where tenant_id = $1 and idempotency_key = $2',
    [fixture.tenantId, key],
  );
  return result.rows[0].count;
}

try {
  await Promise.all([first.connect(), second.connect()]);

  await first.query(
    `insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      $1, 'authenticated', 'authenticated', $2, '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb, now(), now()
    )`,
    [fixture.userId, `concurrency-${fixture.userId}@example.test`],
  );
  await first.query(
    'insert into public.tenants(id, name, slug) values ($1, $2, $3)',
    [fixture.tenantId, 'Test concurrence', `concurrency-${fixture.userId}`],
  );
  await first.query(
    'insert into public.roles(id, tenant_id, name, is_system) values ($1, $2, $3, true)',
    [fixture.roleId, fixture.tenantId, 'Propriétaire'],
  );
  await first.query(
    'insert into public.memberships(tenant_id, user_id, role_id) values ($1, $2, $3)',
    [fixture.tenantId, fixture.userId, fixture.roleId],
  );
  await first.query(
    'insert into public.role_permissions(tenant_id, role_id, permission_code) select $1, $2, code from public.permissions',
    [fixture.tenantId, fixture.roleId],
  );
  await first.query(
    `insert into public.products(id, tenant_id, name, sale_price, cost_price)
     values ($1, $2, 'Produit concurrence', 10, 5)`,
    [fixture.productId, fixture.tenantId],
  );
  await first.query(
    `insert into public.product_variants(id, tenant_id, product_id, sku)
     values ($1, $2, $3, $4)`,
    [fixture.variantId, fixture.tenantId, fixture.productId, `CONC-${fixture.userId.replaceAll('-', '').slice(0, 20).toUpperCase()}`],
  );
  const location = await first.query(
    "select id from public.stock_locations where tenant_id = $1 and code = 'PRINCIPAL'",
    [fixture.tenantId],
  );
  fixture.locationId = location.rows[0].id;
  await first.query(
    'insert into public.stock_balances(tenant_id, variant_id, location_id, on_hand) values ($1, $2, $3, 5)',
    [fixture.tenantId, fixture.variantId, fixture.locationId],
  );

  const competing = await Promise.allSettled([
    postAdjustment(first, 'competing-key-a', -4),
    postAdjustment(second, 'competing-key-b', -4),
  ]);
  const succeeded = competing.filter((result) => result.status === 'fulfilled');
  const rejected = competing.filter((result) => result.status === 'rejected');
  assert.equal(succeeded.length, 1, 'Exactly one competing withdrawal must succeed');
  assert.equal(rejected.length, 1, 'The other withdrawal must be rejected');
  assert.equal(rejected[0].reason.code, 'P0001');
  assert.equal(rejected[0].reason.message, 'Insufficient available stock');
  assert.equal(await balance(), 1, 'Competing withdrawals cannot oversell stock');

  await first.query(
    'update public.stock_balances set on_hand = 5 where tenant_id = $1 and variant_id = $2 and location_id = $3',
    [fixture.tenantId, fixture.variantId, fixture.locationId],
  );

  const duplicatePayload = [
    postAdjustment(first, 'duplicate-retry-key', -2),
    postAdjustment(second, 'duplicate-retry-key', -2),
  ];
  const duplicateResults = await Promise.all(duplicatePayload);
  assert.equal(duplicateResults[0], duplicateResults[1], 'Identical retries must return the same operation');
  assert.equal(await operationCount('duplicate-retry-key'), 1, 'Identical retries create one operation');
  assert.equal(await balance(), 3, 'Identical retries apply stock only once');

  const sourceOperationId = await postAdjustment(first, 'reversal-source-key', 1);
  const reversalResults = await Promise.all([
    postReversal(first, 'same-reversal-key', sourceOperationId),
    postReversal(second, 'same-reversal-key', sourceOperationId),
  ]);
  assert.equal(reversalResults[0], reversalResults[1], 'Same-key reversal retries return one result');
  assert.equal(await operationCount('same-reversal-key'), 1, 'Same-key reversal retries create one operation');
  assert.equal(await balance(), 3, 'A concurrent reversal is applied only once');
  const sourceStatus = await first.query(
    'select status from public.stock_operations where tenant_id = $1 and id = $2',
    [fixture.tenantId, sourceOperationId],
  );
  assert.equal(sourceStatus.rows[0].status, 'reversed');

  console.log('Stock concurrency tests passed: no overselling, duplicate retry, or duplicate reversal.');
} catch (error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`::error::${message.replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([
    first.query('delete from public.tenants where id = $1', [fixture.tenantId]),
  ]);
  await Promise.allSettled([
    first.query('delete from auth.users where id = $1', [fixture.userId]),
  ]);
  await Promise.allSettled([first.end(), second.end()]);
}

import pg from 'pg';

const url = process.env.DATABASE_URL;
const c = new pg.Client({ connectionString: url });
await c.connect();
for (const t of ['patients', 'appointments', 'doctors', 'payments', 'leads', 'reviews', 'users', 'login_history']) {
  const r = await c.query(
    'SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position',
    [t],
  );
  console.log(`${t}:`, r.rows.map((x) => x.column_name).join(', '));
}
await c.end();

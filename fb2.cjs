const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.NEW_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`
    select f.id, a.tp_number, f.strengths_planning, f.strengths_teaching
    from tp_feedback f join tp_assignments a on a.id = f.tp_assignment_id
    join profiles p on p.id = a.trainee_id
    where p.email='demo-amara@celtaconnect.com' order by a.tp_number limit 3`);
  for (const row of r.rows) {
    console.log(`TP${row.tp_number}:`);
    console.log("   strengths_planning:", JSON.stringify(row.strengths_planning).slice(0,220));
  }
  await c.end();
})().catch(e => console.log("ERR", e.message));

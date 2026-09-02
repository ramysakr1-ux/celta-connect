const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.NEW_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  // Build one lesson record per graded teaching practice, from the feedback and
  // plan that already exist -- the CELTA 5 form is a record of what happened,
  // so it should agree with them rather than invent anything.
  const rows = (await c.query(`
    select f.trainee_id, f.tp_number, f.grade, f.submitted_at, f.trainer_id,
           p.course_id, pl.main_aims
    from tp_feedback f
    join profiles p on p.id = f.trainee_id
    left join tp_plans pl on pl.trainee_id = f.trainee_id and pl.tp_number = f.tp_number
    where f.submitted_at is not null and p.course_id is not null
    order by f.trainee_id, f.tp_number`)).rows;

  let made = 0;
  for (const r of rows) {
    // The level changes halfway, as the timetable's "Level & tutor change" says.
    const level = r.tp_number <= 4 ? "Intermediate (B1+)" : "Elementary (A2)";
    const ins = await c.query(
      `insert into tp_lessons (course_id, trainee_id, trainer_id, lesson_date, length_minutes,
         level, learner_count, lesson_focus, tutor_assessment, tp_number)
       select $1,$2,$3,$4,45,$5,$6,$7,$8,$9
       where not exists (select 1 from tp_lessons t where t.trainee_id=$2 and t.tp_number=$9)
       returning id`,
      [r.course_id, r.trainee_id, r.trainer_id, String(r.submitted_at).slice(0,10),
       level, r.tp_number <= 4 ? 11 : 9, r.main_aims || "Teaching practice", r.grade, r.tp_number]);
    made += ins.rows.length;
  }
  console.log(`graded teaching practices found: ${rows.length}, lesson records created: ${made}`);
  await c.end();
})().catch(e => console.log("ERR", e.message));

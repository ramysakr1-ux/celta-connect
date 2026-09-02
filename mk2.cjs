const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.NEW_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`
    insert into tp_lessons (course_id, trainee_id, trainer_id, lesson_date, length_minutes,
                            level, learner_count, lesson_focus, tutor_assessment, tp_number)
    select p.course_id, f.trainee_id, f.trainer_id, f.submitted_at::date, 45,
           case when f.tp_number <= 4 then 'Intermediate (B1+)' else 'Elementary (A2)' end,
           case when f.tp_number <= 4 then 11 else 9 end,
           coalesce(nullif(pl.main_aims, ''), 'Teaching practice'),
           f.grade, f.tp_number
    from tp_feedback f
    join profiles p on p.id = f.trainee_id
    left join tp_plans pl on pl.trainee_id = f.trainee_id and pl.tp_number = f.tp_number
    where f.submitted_at is not null
      and p.course_id is not null
      and not exists (select 1 from tp_lessons t where t.trainee_id = f.trainee_id and t.tp_number = f.tp_number)
    returning id`);
  console.log("lesson records created:", r.rowCount);
  const n = await c.query(`select count(*)::int n from tp_lessons`);
  console.log("tp_lessons total:", n.rows[0].n);
  await c.end();
})().catch(e => console.log("ERR", e.message));

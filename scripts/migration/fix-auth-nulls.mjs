// Repairs the auth.users rows copy-data.mjs inserted.
//
// GoTrue reads several of auth.users' token columns into non-nullable Go
// strings. They are nullable in the table, so a direct insert that omits
// them leaves NULL, and every lookup then fails with a 500 and the
// singularly unhelpful "Database error finding user" -- while the row looks
// perfectly fine in SQL and the matching profile reads back without
// complaint.
//
// That is what took out every /demo/* link after production switched to the
// new database: not the data, not the identities, just eight columns that
// have to be '' rather than NULL.
import pg from "pg";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.migration", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const COLS = [
  "confirmation_token",
  "recovery_token",
  "email_change",
  "email_change_token_new",
  "email_change_token_current",
  "phone_change",
  "phone_change_token",
  "reauthentication_token",
];

const c = new pg.Client({ connectionString: env.NEW_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const counts = await c.query(
  `select ${COLS.map((col) => `count(*) filter (where ${col} is null) as ${col}`).join(", ")} from auth.users`
);
const nulls = Object.entries(counts.rows[0]).filter(([, v]) => Number(v) > 0);
console.log(nulls.length ? `columns holding NULL: ${nulls.map(([k, v]) => `${k}(${v})`).join(", ")}` : "no NULLs found");

const res = await c.query(
  `update auth.users set ${COLS.map((col) => `${col} = coalesce(${col}, '')`).join(", ")}`
);
console.log(`normalised ${res.rowCount} rows`);

await c.end();

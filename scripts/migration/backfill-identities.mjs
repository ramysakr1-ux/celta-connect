// Gives every copied auth user its auth.identities row.
//
// copy-data.mjs inserts into auth.users directly, because the admin API
// cannot set an id and every profiles.id foreign key depends on the ids
// surviving. But GoTrue does not treat auth.users as the whole story: an
// email-provider login needs a matching row in auth.identities, and without
// one generateLink() fails outright -- which took out every /demo/* entry
// point the moment production pointed at the new database.
//
// The failure gave nothing away: generateLink returned an empty error
// object, and the profile row existed and looked fine.
import pg from "pg";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.migration", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const c = new pg.Client({ connectionString: env.NEW_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const { rows: before } = await c.query("select count(*)::int n from auth.identities");
console.log(`identities before: ${before[0].n}`);

// provider_id is the provider's own identifier for the account; for the
// email provider that is the user id itself. identity_data must carry sub
// and email or GoTrue will not match the account on sign-in.
const { rowCount } = await c.query(`
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(),
         u.id,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
         'email',
         u.id::text,
         u.created_at,
         u.created_at,
         u.updated_at
  from auth.users u
  where u.email is not null
    and not exists (
      select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
    )
`);

const { rows: after } = await c.query("select count(*)::int n from auth.identities");
const { rows: users } = await c.query("select count(*)::int n from auth.users");
console.log(`created ${rowCount} identities -- now ${after[0].n} for ${users[0].n} users`);

await c.end();

import "server-only";
import { cache } from "react";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getCurrentProfile } from "@/lib/auth/get-profile";

// Service-role client: bypasses RLS entirely. Only ever import this inside
// server code, and only for operations RLS can't cover (e.g. the Auth
// Admin API used to invite trainer/trainee logins). Never expose this key
// to the browser.
function rawAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local yet. Get it from " +
        "Supabase Project Settings -> API -> service_role secret."
    );
  }
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------- the demo ---
//
// The shared demo promises that nothing is saved. Migration 0079 keeps that
// promise with a database trigger -- but only for `auth.role() =
// 'authenticated'`; the service role is exempt so the seed can write the demo
// in the first place. Every write through this client walked straight past
// it: 218 writes across 74 files by 15 Sep 2026. Centre Management was
// guarded that day at its capability chokepoints (src/lib/demo-guard.ts); the
// trainer's and the candidate's hundred-odd actions had no chokepoint at all.
//
// This is the chokepoint (Ramy, 17 Sep 2026: "the demo write-block on the
// trainer and trainee paths"). The client itself refuses to write when the
// SIGNED-IN VIEWER's own centre is a demo centre, answering exactly as the
// trigger does -- `{ data: null, error }` with the same message -- so every
// call site that already reads `error` says "not saved" the way it does for a
// session-client write, and one that ignores `error` silently keeps nothing,
// which is also the promise.
//
// Who is NOT refused, on purpose:
//   - nobody at a real centre (Elmswood, and every future centre);
//   - crons, webhooks and scripts -- no session, no viewer, nothing to refuse;
//   - token viewers (a volunteer, an assessor) and applicants -- they have no
//     profile, and the demo journey's application and the volunteer's
//     recording submit for real by design (project_demo_journey_writes);
//   - the Auth Admin API (demo sign-in links are minted through it) and RPCs
//     (the destructive ones sit behind requireCapability already).
//
// The platform owner's standing pass elsewhere does not apply here: signed in
// through a demo login they ARE a demo account, and the demo is read-only.
export const DEMO_WRITE_REFUSAL = "This is a shared demo -- changes are not saved.";

/** Is the person making this request signed in at a demo centre? Once per request. */
const viewerIsOnDemoCentre = cache(async (): Promise<boolean> => {
  try {
    const session = await getCurrentProfile();
    const centerId = session?.profile?.center_id;
    if (!centerId) return false;
    const { data } = await rawAdminClient().from("centers").select("is_demo").eq("id", centerId).maybeSingle();
    return Boolean(data?.is_demo);
  } catch {
    // No request scope (a cron, a script): nobody to refuse.
    return false;
  }
});

const refusal = () => ({
  data: null,
  error: { message: DEMO_WRITE_REFUSAL, details: "", hint: "", code: "DEMO_READ_ONLY", name: "PostgrestError" },
  count: null,
  status: 403,
  statusText: "Forbidden",
});

const MUTATORS = new Set(["insert", "update", "upsert", "delete"]);
const STORAGE_MUTATORS = new Set(["upload", "uploadToSignedUrl", "update", "remove", "move", "copy"]);

/** A query builder whose `await` first asks whether this viewer may write. */
function guardBuilder<T extends object>(builder: T): T {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "then") {
        return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          viewerIsOnDemoCentre().then(
            (demo) => (demo ? Promise.resolve(refusal()).then(onFulfilled, onRejected) : (target as unknown as PromiseLike<unknown>).then(onFulfilled, onRejected)),
            onRejected
          );
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        // Chained modifiers (.eq(), .select(), .single(), ...) hand back the
        // builder; keep guarding it. Anything else passes through.
        return result && typeof result === "object" && typeof (result as { then?: unknown }).then === "function" ? guardBuilder(result as object) : result;
      };
    },
  });
}

function guardTable<T extends object>(table: T): T {
  return new Proxy(table, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || !MUTATORS.has(prop) || typeof value !== "function") return value;
      return (...args: unknown[]) => guardBuilder(value.apply(target, args) as object);
    },
  });
}

function guardBucket<T extends object>(bucket: T): T {
  return new Proxy(bucket, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || !STORAGE_MUTATORS.has(prop) || typeof value !== "function") return value;
      return async (...args: unknown[]) => ((await viewerIsOnDemoCentre()) ? { data: null, error: { message: DEMO_WRITE_REFUSAL, name: "StorageError" } } : value.apply(target, args));
    },
  });
}

export function createAdminClient(): SupabaseClient<Database> {
  const raw = rawAdminClient();
  const client = new Proxy(raw, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (...args: unknown[]) => guardTable((target.from as (...a: unknown[]) => object)(...args));
      }
      if (prop === "storage") {
        const storage = Reflect.get(target, prop, receiver) as { from: (...a: unknown[]) => object };
        return new Proxy(storage, {
          get(s, p, r) {
            if (p === "from") return (...args: unknown[]) => guardBucket(s.from(...args));
            return Reflect.get(s, p, r);
          },
        });
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return client as SupabaseClient<Database>;
}

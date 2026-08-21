import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ConnectHubLinkForm } from "@/app/trainer/(hub)/connect-hub/link-form";

// Connect Hub is a separate Google Apps Script project (different
// codebase, no shared login) -- see the design-handoff memory. It has no
// account system of its own, only a token in the URL, so there's nothing
// to single-sign-on into. This page just lets a trainer/admin paste and
// save their own personal tutor link once; after that the header's
// "Connect Hub" button goes straight there, no detour through this page.
export default async function ConnectHubSetupPage() {
  const profile = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("connect_hub_link").eq("id", profile.id).maybeSingle();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="sheet flex flex-col gap-3">
        <h1 className="font-serif text-xl text-ink">Connect Hub</h1>
        <p className="text-sm text-muted">
          Connect Hub is a separate app for teaching-practice paperwork -- lesson plans,
          self-evaluations, TP feedback and assignments. It has no login of its own; the only way
          in is your personal tutor link. Paste it here once and the &quot;Connect Hub&quot; button in
          the header will take you straight there from now on.
        </p>
        {data?.connect_hub_link ? (
          <a
            href={data.connect_hub_link}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Open Connect Hub →
          </a>
        ) : null}
      </div>

      <div className="sheet flex flex-col gap-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          {data?.connect_hub_link ? "Update your link" : "Paste your link"}
        </p>
        <p className="text-xs text-muted">
          Find it in Connect Hub itself, under the tutor dashboard&apos;s &quot;Tutors&quot; tab -- it
          looks like https://.../?tutor=... (either the raw script.google.com link, or the
          shorter ramysakr1-ux.github.io/celta-hub-wrapper/ one in front of it -- both work).
        </p>
        <ConnectHubLinkForm defaultValue={data?.connect_hub_link ?? ""} />
      </div>
    </div>
  );
}

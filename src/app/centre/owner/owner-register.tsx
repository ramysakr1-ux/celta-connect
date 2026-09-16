// The owner's register, in one place.
//
// Remainder pass A5 (16 Sep 2026): the owner's action log lived at
// /centre/owner/log and rendered in Centre Management's idiom -- cream room
// page, plain cards, a grey "Back to centre owner" text link -- so clicking a
// figure on the owner's dark-band screen dropped you into a different world.
// The register was a <style> block inside the owner's landing page, reachable
// by nobody else, which is why the log could not have used it even if someone
// had wanted to. It is a component now, and both pages mount it.
//
// It stays page-scoped CSS rather than moving into globals.css on purpose:
// these tokens describe ONE surface (.owner-surface) and nothing else in the
// app should be able to reach for them by accident.
export function OwnerRegisterStyles() {
  return (
    <style>{`
        .owner-surface {
          --owner-ink: oklch(20% 0.014 55);
          --owner-garnet: oklch(42% 0.15 27);
          --owner-garnet-soft: oklch(42% 0.15 27 / 0.08);
          --owner-parchment: oklch(94% 0.014 78);
          --owner-paper: oklch(99% 0.006 80);
          --owner-line: oklch(85% 0.018 75);
          --owner-muted: oklch(48% 0.02 65);
          background: var(--owner-parchment);
          color: var(--owner-ink);
        }
        .owner-header { background: var(--owner-ink); border-bottom: 3px solid var(--owner-garnet); }
        .owner-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
        .owner-serif { font-family: var(--font-serif, "Newsreader", Georgia, serif); }
        .owner-pill {
          display: inline-flex; align-items: center; gap: 7px; padding: 7px 16px; border-radius: 3px;
          background: var(--owner-garnet); color: oklch(98% 0.006 85); font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
        }
        /* A person's name is not a label: dropping the caps and the tracking,
           and setting it in the serif at reading size, is what stops it
           reading as another badge and starts it reading as someone. */
        .owner-pill-name {
          padding: 9px 18px; font-size: 15px; font-weight: 600;
          letter-spacing: 0.005em; text-transform: none;
        }
        .owner-card {
          background: var(--owner-paper); border: 1px solid var(--owner-line); border-radius: 10px;
          border-top: 3px solid var(--owner-garnet);
          box-shadow: 0 1px 2px rgba(30,15,10,0.03), 0 14px 32px -20px rgba(30,15,10,0.28);
        }
        /* Was --owner-garnet-soft, an 8% wash you had to look for. The
           shared fill is the same one every other surface uses, so a row
           here highlights as firmly as a row anywhere else. */
    `}</style>
  );
}

import { initials } from "@/lib/initials";

// A person's mark: their initials, in a colour that is theirs.
//
// Ramy, 4 Sep 2026: "is it possible to have a little nice kind of profile
// picture next to all the names... can we make it something that looks nicer
// than just a circle?"
//
// No photographs and nothing to upload. Nobody signs into Connect with Google
// -- sign-in is the emailed magic link -- so there is no account picture to
// fetch, and asking people to upload one is a step most would skip. The name
// is already on file, so the mark comes from that.
//
// The colour comes from the NAME, not the role. The first version tinted by
// role, and Ramy caught why that fails: "the colour should follow the name."
// A trainee roster is twelve candidates, and role-tinting makes twelve
// identical teal tiles -- telling you something you already knew from being on
// the trainee page, and no help at all in finding Amara. Colour keyed to the
// person is what makes a list scannable, which is the whole job.
//
// initials() itself already existed and is good (it carries the 1 Sep fix for
// channel names reading "CO" instead of "CC"); it lived only inside the three
// chat files, styled inline in each. This is that tile lifted out.
//
// Strengthened 4 Sep 2026, same evening it shipped. The first version used a
// 14% tint at 32px, and Ramy looked straight at a roster carrying three of
// them and asked where they were. A mark that has to be pointed out is not
// doing its job, so: 30% tint, a firmer ring, and every size up one step.

/**
 * Ten tones at one lightness and one chroma, evenly spaced around the wheel.
 *
 * Deliberately a fixed set rather than a free hash-to-hue: an unconstrained
 * hue lands on neon greens and violets that would look nothing like the rest
 * of Connect. Holding L and C steady and varying only hue keeps them
 * harmonious with each other and with the app's own muted register, while
 * staying far enough apart to be told apart at 24px.
 */
const TONES = [
  "oklch(45% 0.10 25)",
  "oklch(45% 0.10 60)",
  "oklch(45% 0.10 95)",
  "oklch(45% 0.10 130)",
  "oklch(45% 0.10 165)",
  "oklch(45% 0.10 200)",
  "oklch(45% 0.10 235)",
  "oklch(45% 0.10 270)",
  "oklch(45% 0.10 305)",
  "oklch(45% 0.10 340)",
] as const;

/**
 * Same name, same colour, forever -- and the same on every device, which a
 * random pick or an array index could not promise. Keyed on the name rather
 * than the row id so a person looks the same in a list that only carries their
 * name, and so the colour survives a re-seed.
 */
export function toneForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
}

const SIZE_CLASS = {
  xs: "size-7 text-[10px] rounded-[8px]",
  sm: "size-9 text-[12.5px] rounded-[10px]",
  md: "size-11 text-[15px] rounded-[12px]",
  lg: "size-14 text-[18px] rounded-[16px]",
} as const;

export type AvatarSize = keyof typeof SIZE_CLASS;

export function Avatar({
  name,
  size = "sm",
  ring = true,
  tone,
  className = "",
}: {
  name: string;
  size?: AvatarSize;
  /**
   * The hairline of the person's colour. On by default because it holds
   * definition at the small sizes, where most of these live. Ramy was between
   * this and the flat tint (4 Sep 2026) -- it is one property either way, so
   * if a real roster of twenty reads busy, pass ring={false} rather than
   * restyling.
   */
  ring?: boolean;
  /** Override the derived colour. For the rare case that is not a person. */
  tone?: string;
  className?: string;
}) {
  const c = tone ?? toneForName(name);
  return (
    <span
      // Decorative: the name it is built from is always rendered beside it, so
      // a screen reader announcing the initials too would just be noise.
      aria-hidden="true"
      title={name}
      className={`inline-flex shrink-0 items-center justify-center font-serif font-semibold ${SIZE_CLASS[size]} ${className}`}
      style={{
        color: c,
        background: `color-mix(in oklab, ${c} 30%, var(--color-card))`,
        boxShadow: ring ? `inset 0 0 0 1.5px color-mix(in oklab, ${c} 55%, transparent)` : undefined,
      }}
    >
      {initials(name)}
    </span>
  );
}

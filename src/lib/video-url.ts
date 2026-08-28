// Ramy, 29 Aug 2026: the filmed observations are YouTube links -- "we could
// just hook up to the link, it should be enough." The watch screen only had
// a <video controls> element, which plays a direct media file and shows
// nothing at all for a youtu.be URL, so every recording would have rendered
// as a broken player.
//
// Deliberately not downloading or re-hosting: it would mean storage cost
// for content we do not own (one of the five is a third-party channel's
// demo lesson), for no gain over embedding.

export type PlayableVideo =
  | { kind: "file"; src: string }
  | { kind: "youtube"; videoId: string; embedUrl: string; watchUrl: string };

// Handles the three shapes a person actually pastes: the share link
// (youtu.be/ID), the address bar (youtube.com/watch?v=ID), and an embed URL
// already copied out of an <iframe> (youtube.com/embed/ID). Anything else
// is treated as a direct file, which is still correct for a centre that
// uploads its own recording.
export function parseVideoUrl(raw: string | null | undefined): PlayableVideo | null {
  const url = raw?.trim();
  if (!url) return null;

  let id: string | null = null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      id = parsed.pathname.slice(1) || null;
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") id = parsed.searchParams.get("v");
      else if (parsed.pathname.startsWith("/embed/")) id = parsed.pathname.slice("/embed/".length) || null;
      else if (parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.slice("/shorts/".length) || null;
    }
  } catch {
    return { kind: "file", src: url };
  }

  // A video id is 11 chars of [A-Za-z0-9_-]; anything else came from a URL
  // shaped like YouTube but carrying something we should not put in an
  // iframe src.
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
    return {
      kind: "youtube",
      videoId: id,
      // youtube-nocookie keeps the trainee out of YouTube's ad-profile
      // cookies for a page they were required to open by their course.
      // enablejsapi so the existing discussion-break logic can drive it.
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&enablejsapi=1`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  }
  return { kind: "file", src: url };
}

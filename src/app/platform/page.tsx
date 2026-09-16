import { redirect } from "next/navigation";

// Centre side A10, 16 Sep 2026. This page greeted the platform owner ("Good
// morning, Ramy" + a recap) and offered three cards; Command Center's own
// layout greets again ("Welcome back, Ramy") and is where everything else
// lives. Two greetings for one person, and two homes.
//
// The 22 Aug note put the greeting here because this was the post-login
// landing. The 2 Sep redesign made Command Center the home -- the Connect
// mark itself links there for a platform_owner -- so this is a door into a
// room nobody lives in any more. Its three cards moved: Create a centre and
// Change a role onto Overview and People, and Every centre was already
// Overview's own list.
export default function PlatformPage() {
  redirect("/platform/command-center");
}

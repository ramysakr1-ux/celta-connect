import { redirect } from "next/navigation";

// Ramy, 2026-08-15: nobody signs up through the bare domain -- everyone
// arrives via a role-specific link (join/[token], offer/[token], magic
// link) or signs in directly. The marketing front door this used to render
// drew attention to the "Connect" brand/domain that he explicitly doesn't
// want emphasized; sign-in is the actual destination, so go there directly.
export default function Home() {
  redirect("/login");
}

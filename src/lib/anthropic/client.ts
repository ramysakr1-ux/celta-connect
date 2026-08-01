import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Server-only client for the TP Points Library's coursebook -> TP points
// generation pipeline. Never import this outside a server action or route
// handler, and never expose ANTHROPIC_API_KEY to the browser.
export function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set in .env.local yet. Get it from " +
        "https://console.anthropic.com/settings/keys."
    );
  }

  return new Anthropic({ apiKey });
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

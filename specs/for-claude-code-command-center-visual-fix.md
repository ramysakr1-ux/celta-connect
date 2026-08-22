# Visual fix: Command Center card contrast + type consistency

Written 22 Aug 2026, for Claude Code. The command center route at `/platform/command-center`
is functionally correct (real Connect data for active centres/accounts, correctly marked
"Illustrative" for Connect Hub/Affina since they have no billing reporting wired). This is
a visual-only fix based on a screenshot of the live preview.

## Problem
Every panel — the 4 KPI boxes, the 3 product cards, the account rows — sits at nearly the
same tan/beige value as the page background. There's no border, shadow, or fill difference
separating a "card" from the page itself. The whole page reads as one undifferentiated
beige field rather than distinct panels of information.

## Fix
Give cards a visible surface: a lighter (or otherwise distinct) background than the page,
plus either a 1px border or a subtle shadow — enough that the eye can find panel edges at
a glance. Apply consistently to: the 4 KPI boxes, the 3 product cards (Connect / Connect
Hub / Affina), and the account list panel.

## Secondary issue: typography inconsistency
Three different type treatments compete in a small area:
- "Command center" — heavy serif headline
- "2 centres" / "£0/mo" inside the Connect card — serif, different weight/size than the
  headline
- "ACTIVE CENTRES" / "MRR" labels — sans-serif, uppercase, letter-spaced

Recommend: reserve serif for the page headline and section headings only. KPI values and
product-card stat numbers should be a bold sans-serif (matching the uppercase labels'
family) so numbers read as data, not as a second tier of heading.

## Secondary issue: product cards lack a visual anchor
The three product cards (Connect, Connect Hub, Affina) are plain text blocks with no icon,
accent color, or divider distinguishing one from the next — hard to scan at a glance.
Suggest a small colored accent (top border or label color) per product, consistent with
whatever accent color each product already uses elsewhere in its own brand (Connect's is
likely already defined; Connect Hub and Affina can get placeholder accents until they have
their own established palette here).

## Not a problem — leave as is
- Connect Hub / Affina showing "Illustrative" instead of real numbers — correct, matches
  the spec (`for-claude-code-command-center-belongs-in-connect.md`).
- MRR showing "—" for Connect (no subscriptions on record yet) — correct, real absence of
  data, not a bug.

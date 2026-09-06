# Rotation page — long un-grouped stack of unrelated sections

## What's built

`trainer/(hub)/rotation/page.tsx` renders, top to bottom, in one continuous scroll:

1. Header + "Manual override" link
2. Intensive-TP-block warning (conditional)
3. TP-block-ends-on-final-day warning (conditional)
4. Uneven TP-feedback-distribution warning (conditional)
5. "No subgroups yet" notice (conditional)
6. Per-TP-group board + running order panel (repeats per group)
7. Unpaired subgroup boards (reorder form + teaching-order preview table + progress table)
8. Peer observation notes reveal
9. 1-to-1 / small-group TP section
10. TP7/8 aim-type constraints
11. Coursebook schedule (6 forms, one per TP number)

All of it is genuinely needed — nothing here is invented or duplicated data, unlike the Roster columns. The problem is structural: a trainer visiting to do one specific thing (say, set the coursebook schedule, or reveal peer notes) has to scroll past several unrelated compliance warnings and full team boards to get there.

## Fix

Give this page the same treatment `/trainer/resource-hub` already has: a left rail nav (or a tab strip, whichever fits better given this page has fewer, chunkier sections than Resource Hub's ten) linking to anchors for:

- Compliance warnings (keep these together, near the top, always visible — they're advisory alerts, not something to hide behind a tab)
- TP group boards + running order
- Peer observation notes
- 1-to-1 / small-group TP
- TP7/8 aim constraints
- Coursebook schedule

Compliance warnings should probably stay unconditionally visible at the top regardless of which section is selected (they're safety-relevant, not content a trainer navigates away from) — everything else can live behind its own rail entry so the page loads to one section at a time instead of the full stack.

## Ask Code

Confirm whether the TP group board + running order panel (section 6) is the section a trainer visits most often — if so, that's the right default/landing section when the rail loads, not the top of an undifferentiated list.

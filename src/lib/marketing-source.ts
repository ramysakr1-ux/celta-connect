// for-claude-code-marketing-source-question.md: shared between the public
// application form and the Centre Admin breakdown, so the two can never
// drift on labels or the allowed set.
export const MARKETING_SOURCES = ["search_engine", "social_media", "friend_recommendation", "past_graduate", "other"] as const;
export type MarketingSource = (typeof MARKETING_SOURCES)[number];

export const MARKETING_SOURCE_LABEL: Record<MarketingSource, string> = {
  search_engine: "Search engine",
  social_media: "Social media",
  friend_recommendation: "A friend or colleague recommended us",
  past_graduate: "Past graduate of this centre",
  other: "Other",
};

export const MARKETING_SOURCE_OPTIONS = MARKETING_SOURCES.map((value) => ({ value, label: MARKETING_SOURCE_LABEL[value] }));

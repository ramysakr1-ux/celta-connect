import { CRITERIA_GLOSSARY } from "@/lib/criteria-glossary";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";

// A plain-object re-export so the client editor can render code labels and
// the built-in list without pulling the whole criteria module (and its
// server-side guidance text) into the browser bundle.
export { CRITERIA_GLOSSARY };

export const CRITERIA_LABELS_SAFE: Record<string, string> = { ...CRITERIA_LABELS };

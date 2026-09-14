import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Dates without a zone are the bug this codebase keeps rewriting.
//
// `new Date(x).toLocaleDateString("en-GB", …)` with no `timeZone` renders in
// whatever zone the runtime happens to be in. On Vercel the server is UTC and
// the reader's browser is not, so the same timestamp comes out as two
// different days: the reader abroad sees the wrong one, and React reports the
// disagreement as a hydration mismatch (#418) and repaints.
//
// It was found and fixed at least four separate times before this rule
// existed -- 26 Aug 2026 (multi-timezone support), 11 Sep (date-only
// columns), and twice on 14 Sep, the second time only because every CLOSED
// assignment in the marking room happened to throw #418 in the console.
// src/lib/format-date.ts already says it: "a rule you have to remember is a
// rule that gets missed; this is the same rule as a function you can call."
// This is that rule, enforced.
//
// What to reach for instead:
//   formatDate(iso, timeZone, opts)   a real timestamp -- the CENTRE's zone
//   formatCalendarDate(iso, opts)     a DATE column (due_date, start_date);
//                                     takes no zone, because a calendar date
//                                     does not have one
//   formatTime / formatDateTime       the same, with a clock
// Or pass `timeZone` explicitly when a helper's shape does not fit.
//
// Number formatting is untouched: `amount.toLocaleString("en-GB")` has no
// receiver that looks like a date, so none of the three selectors match it.
const NO_ZONE =
  ':not(:has(ObjectExpression > Property[key.name="timeZone"]))';
const DATE_ZONE_MESSAGE =
  "This renders in the runtime's zone -- UTC on the server, the reader's in the browser -- so it shows the wrong day abroad and mismatches on hydration. Use formatDate(iso, timeZone) for a timestamp, formatCalendarDate(iso) for a DATE column, or pass an explicit `timeZone` option. See src/lib/format-date.ts.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // toLocaleDateString / toLocaleTimeString are only ever called on a
          // Date, so these need no receiver test.
          selector: `CallExpression[callee.property.name=/^toLocale(Date|Time)String$/]${NO_ZONE}`,
          message: DATE_ZONE_MESSAGE,
        },
        {
          // toLocaleString is shared with numbers, so match only the receivers
          // that are unambiguously dates.
          selector: `CallExpression[callee.property.name="toLocaleString"][callee.object.callee.name="Date"]${NO_ZONE}`,
          message: DATE_ZONE_MESSAGE,
        },
        {
          selector: `CallExpression[callee.property.name="toLocaleString"][callee.object.name=/^(d|dt|date|when|at|ts|iso)$/]${NO_ZONE}`,
          message: DATE_ZONE_MESSAGE,
        },
      ],
    },
  },
  {
    // The helpers are where the zone argument is finally applied, so this is
    // the one file that must call the raw APIs.
    files: ["src/lib/format-date.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

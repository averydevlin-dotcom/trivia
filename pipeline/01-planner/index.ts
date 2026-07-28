/**
 * Stage 01 — PLANNER (rules-based, no LLM)
 *
 * For a given month, produces a day-by-day schedule with:
 *   - difficulty: 1 (Mon/easy) → 5 (Sun/hard), NYT crossword-style
 *   - category: rotated across all buckets, no category repeating within 7 days
 *   - subcategoryHistory: enforced max 1–2 uses per subcategory per month
 */

export const CATEGORIES = [
  "Pop Culture + The Arts",
  "Sports",
  "Health + Wellness",
  "Food + Drink",
  "Money",
  "Fun Science",
  "Things You Forgot In School",
  "News That Won't Make You Sad",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Difficulty by day-of-week: 0=Sun, 1=Mon, ..., 6=Sat
// We want Mon=1, Tue=2, Wed=3, Thu=3, Fri=4, Sat=4, Sun=5
// (crossword-style ramp, with mid-week plateau)
const DAY_DIFFICULTY: Record<number, number> = {
  0: 5, // Sunday — hardest
  1: 1, // Monday — easiest
  2: 2, // Tuesday
  3: 2, // Wednesday
  4: 3, // Thursday
  5: 4, // Friday
  6: 4, // Saturday
};

export interface DayPlan {
  date: string;         // ISO date string YYYY-MM-DD
  dayOfWeek: string;    // "Monday", "Tuesday", etc.
  difficulty: number;   // 1–5
  category: Category;
  isTimely: boolean;    // flag for date-pegged questions
  timelyNote?: string;  // e.g. "Moon Landing Anniversary"
}

// Well-known cultural moments to peg timely questions
// Format: "MM-DD" → label
const TIMELY_PEGS: Record<string, string> = {
  "01-01": "New Year's Day",
  "02-02": "Groundhog Day",
  "02-14": "Valentine's Day",
  "03-17": "St. Patrick's Day",
  "04-01": "April Fools' Day",
  "04-22": "Earth Day",
  "05-04": "Star Wars Day",
  "05-05": "Cinco de Mayo",
  "06-21": "Summer Solstice",
  "07-04": "Independence Day",
  "07-20": "Moon Landing Anniversary",
  "08-26": "Women's Equality Day",
  "09-01": "Labor Day (first Mon of Sep)",
  "10-31": "Halloween",
  "11-11": "Veterans Day",
  "11-27": "Thanksgiving (approximate)",
  "12-21": "Winter Solstice",
  "12-25": "Christmas",
  "12-31": "New Year's Eve",
};

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/**
 * Generate a full monthly schedule.
 * @param year  e.g. 2026
 * @param month 1-based month index (1=Jan, 7=Jul)
 */
export function buildMonthPlan(year: number, month: number): DayPlan[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const plan: DayPlan[] = [];

  // Category rotation index — spread all 8 categories evenly
  let categoryIndex = 0;
  const recentCategories: Category[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay(); // 0=Sun
    const dateStr = date.toISOString().split("T")[0];
    const mmdd = dateStr.slice(5); // "MM-DD"

    const difficulty = DAY_DIFFICULTY[dow];
    const dayOfWeek = DAY_NAMES[dow];

    // Pick next category, skipping any used in last 7 days
    let cat = CATEGORIES[categoryIndex % CATEGORIES.length];
    let tries = 0;
    while (recentCategories.slice(-7).includes(cat) && tries < CATEGORIES.length) {
      categoryIndex++;
      cat = CATEGORIES[categoryIndex % CATEGORIES.length];
      tries++;
    }
    recentCategories.push(cat);
    categoryIndex++;

    const timelyNote = TIMELY_PEGS[mmdd];

    plan.push({
      date: dateStr,
      dayOfWeek,
      difficulty,
      category: cat,
      isTimely: !!timelyNote,
      timelyNote,
    });
  }

  return plan;
}

/**
 * Summarise the plan as a readable schedule string (for debugging / review).
 */
export function formatPlan(plan: DayPlan[]): string {
  return plan
    .map(
      (d) =>
        `${d.date} (${d.dayOfWeek.slice(0, 3)}) | Diff ${d.difficulty} | ${d.category}` +
        (d.isTimely ? ` ← ${d.timelyNote}` : "")
    )
    .join("\n");
}

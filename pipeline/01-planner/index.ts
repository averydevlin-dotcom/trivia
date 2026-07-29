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
export type DayCategory = Category | "Fun Observance";

const DAY_DIFFICULTY: Record<number, number> = {
  0: 5, 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 4,
};

export interface DayPlan {
  date: string;
  dayOfWeek: string;
  difficulty: number;
  category: DayCategory;
  isTimely: boolean;
  timelyNote?: string;
  isFunDay?: boolean;
}

const TIMELY_PEGS: Record<string, string> = {
  "01-01": "New Year's Day",
  "01-17": "Benjamin Franklin's Birthday (1706)",
  "02-02": "Groundhog Day",
  "02-11": "National Inventors Day",
  "02-14": "Valentine's Day",
  "03-14": "Pi Day (3.14)",
  "03-17": "St. Patrick's Day",
  "03-20": "First Day of Spring",
  "04-01": "April Fools' Day",
  "04-22": "Earth Day",
  "04-23": "Shakespeare's Birthday (1564)",
  "05-04": "Star Wars Day — Original Film Released 1977",
  "05-05": "Cinco de Mayo",
  "05-25": "Towel Day — Hitchhiker's Guide to the Galaxy",
  "06-05": "World Environment Day",
  "06-08": "World Oceans Day",
  "06-21": "Summer Solstice",
  "07-04": "Independence Day",
  "07-17": "World Emoji Day",
  "07-20": "Moon Landing Anniversary (1969)",
  "08-12": "IBM PC Announced (1981)",
  "08-26": "Women's Equality Day",
  "09-09": "First Computer Bug Found (1947)",
  "09-13": "Roald Dahl Day",
  "09-22": "Hobbit Day — Tolkien's Birthday",
  "10-04": "World Animal Day",
  "10-21": "Back to the Future Day (2015 destination date)",
  "10-31": "Halloween",
  "11-11": "Veterans Day",
  "11-13": "World Kindness Day",
  "12-10": "Nobel Prize Day",
  "12-21": "Winter Solstice",
  "12-25": "Christmas",
  "12-31": "New Year's Eve",
};

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const FUN_DAY_PREFERENCE = ["Wednesday","Tuesday","Thursday","Friday","Monday"];

export function buildMonthPlan(year: number, month: number): DayPlan[] {
  const daysInMonth = new Date(year, month, 0).getDate();

  const skeleton: Array<{
    date: string; dayOfWeek: string; difficulty: number; isTimely: boolean; timelyNote?: string;
  }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    const dow = dt.getDay();
    const ds = dt.toISOString().split("T")[0];
    skeleton.push({
      date: ds,
      dayOfWeek: DAY_NAMES[dow],
      difficulty: DAY_DIFFICULTY[dow],
      isTimely: !!TIMELY_PEGS[ds.slice(5)],
      timelyNote: TIMELY_PEGS[ds.slice(5)],
    });
  }

  // Group into calendar weeks (Mon–Sun)
  const weeks: (typeof skeleton)[] = [];
  let currentWeek: typeof skeleton = [];
  for (const day of skeleton) {
    const dow = new Date(day.date + "T00:00:00").getDay();
    if (dow === 1 && currentWeek.length > 0) { weeks.push(currentWeek); currentWeek = []; }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  // Pick one Fun Day per week (weeks with ≥ 4 days only)
  const funDayDates = new Set<string>();
  for (const week of weeks) {
    if (week.length < 4) continue;
    let picked: string | null = null;
    for (const preferred of FUN_DAY_PREFERENCE) {
      const candidate = week.find(d => d.dayOfWeek === preferred && !d.isTimely);
      if (candidate) { picked = candidate.date; break; }
    }
    if (!picked) {
      const fallback = week.find(d => d.dayOfWeek !== "Sunday" && !d.isTimely);
      if (fallback) picked = fallback.date;
    }
    if (picked) funDayDates.add(picked);
  }

  // Assign categories; Fun Days get "Fun Observance"
  const plan: DayPlan[] = [];
  let ci = 0;
  const rc: Category[] = [];
  for (const day of skeleton) {
    if (funDayDates.has(day.date)) {
      plan.push({ ...day, category: "Fun Observance", isFunDay: true });
    } else {
      let cat = CATEGORIES[ci % CATEGORIES.length];
      let tries = 0;
      while (rc.slice(-7).includes(cat) && tries < CATEGORIES.length) {
        ci++; cat = CATEGORIES[ci % CATEGORIES.length]; tries++;
      }
      rc.push(cat); ci++;
      plan.push({ ...day, category: cat, isFunDay: false });
    }
  }
  return plan;
}

export function formatPlan(plan: DayPlan[]): string {
  return plan.map(d =>
    `${d.date} (${d.dayOfWeek.slice(0, 3)}) | Diff ${d.difficulty} | ${d.isFunDay ? "🎉 Fun Observance" : d.category}` +
    (d.isTimely ? ` ← ${d.timelyNote}` : "")
  ).join("\n");
}

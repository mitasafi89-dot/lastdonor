/**
 * Seasonal Calendar — maps months to cause categories that peak during specific seasons.
 * Used by the topic scorer to boost topic priority when a category's peak season arrives.
 */

export interface SeasonalEntry {
  category: string;
  months: number[]; // 1-12
  boostAmount: number; // priority boost points
  reason: string;
}

const SEASONAL_CALENDAR: SeasonalEntry[] = [
  // Disaster: Hurricane season Jun-Nov, wildfire season Jul-Oct
  { category: 'disaster', months: [6, 7, 8, 9, 10, 11], boostAmount: 20, reason: 'Hurricane & wildfire season' },
  // Memorial: Memorial Day (May), Veterans Day (Nov), around holidays
  { category: 'memorial', months: [5, 11, 12], boostAmount: 15, reason: 'Memorial Day, Veterans Day, holiday memorials' },
  // Military: Veterans Day (Nov), Memorial Day (May), Military Appreciation (May)
  { category: 'military', months: [5, 11], boostAmount: 20, reason: 'Military Appreciation Month, Veterans Day' },
  { category: 'veterans', months: [5, 11], boostAmount: 20, reason: 'Military Appreciation Month, Veterans Day' },
  // First Responders: 9/11 (Sep), National First Responders Day (Oct 28)
  { category: 'first-responders', months: [9, 10], boostAmount: 15, reason: '9/11 anniversary, National First Responders Day' },
  // Education: Back to school (Aug-Sep), graduation (May-Jun)
  { category: 'education', months: [5, 6, 8, 9], boostAmount: 15, reason: 'Back-to-school, graduation season' },
  // Community: Giving Tuesday (Nov), holiday season (Nov-Dec)
  { category: 'community', months: [11, 12], boostAmount: 20, reason: 'Giving Tuesday, holiday giving season' },
  // Emergency: Winter emergencies (Dec-Feb), tax season giving (Mar-Apr)
  { category: 'emergency', months: [1, 2, 12], boostAmount: 10, reason: 'Winter emergencies' },
  // Animal: Adopt-a-Pet (Oct), National Pet Day (Apr 11)
  { category: 'animal', months: [4, 10], boostAmount: 10, reason: 'National Pet Day, Adopt-a-Pet Month' },
  // Faith: Easter (Mar-Apr), Christmas (Dec), Ramadan (varies)
  { category: 'faith', months: [3, 4, 12], boostAmount: 10, reason: 'Easter, Christmas, religious observances' },
  // Medical: Breast Cancer Awareness (Oct), Heart Health (Feb)
  { category: 'medical', months: [2, 10], boostAmount: 15, reason: 'Heart Health Month, Breast Cancer Awareness Month' },
  // Family: Mother's/Father's Day (May/Jun), holiday family hardship (Dec)
  { category: 'family', months: [5, 6, 12], boostAmount: 10, reason: "Mother's/Father's Day, holiday season" },
  // Charity: Giving Tuesday (Nov), year-end tax-deduction giving (Dec)
  { category: 'charity', months: [11, 12], boostAmount: 20, reason: 'Giving Tuesday, year-end charitable giving' },
  // Environment: Earth Day (Apr), World Environment Day (Jun)
  { category: 'environment', months: [4, 6], boostAmount: 10, reason: 'Earth Day, World Environment Day' },
  // Sports: injury season overlaps with fall sports (Sep-Nov)
  { category: 'sports', months: [9, 10, 11], boostAmount: 5, reason: 'Fall sports season' },
];

/**
 * Get the seasonal boost for a category in a given month.
 */
export function getSeasonalBoost(category: string, month?: number): number {
  const currentMonth = month ?? new Date().getMonth() + 1;
  const entry = SEASONAL_CALENDAR.find(
    (e) => e.category === category && e.months.includes(currentMonth),
  );
  return entry?.boostAmount ?? 0;
}

/**
 * Get all categories that are in season for a given month.
 */
export function getInSeasonCategories(month?: number): SeasonalEntry[] {
  const currentMonth = month ?? new Date().getMonth() + 1;
  return SEASONAL_CALENDAR.filter((e) => e.months.includes(currentMonth));
}

/**
 * Get reasoning for why a category is boosted this month (or empty string if not).
 */
export function getSeasonalReason(category: string, month?: number): string {
  const currentMonth = month ?? new Date().getMonth() + 1;
  const entry = SEASONAL_CALENDAR.find(
    (e) => e.category === category && e.months.includes(currentMonth),
  );
  return entry?.reason ?? '';
}



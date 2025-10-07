/**
 * Date utilities for fitness plan week calculations
 * Handles week ranges, date formatting, and day-of-week calculations
 */

export interface DateRange {
  start: string; // ISO date string: "2025-01-20"
  end: string;   // ISO date string: "2025-01-26"
}

/**
 * Get the Monday of the current week
 * @param date - The date to get the week start for (defaults to today)
 * @returns ISO date string for Monday of the week
 */
export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

/**
 * Get the Sunday of the current week
 * @param date - The date to get the week end for (defaults to today)
 * @returns ISO date string for Sunday of the week
 */
export function getWeekEndDate(date: Date = new Date()): string {
  const startDate = new Date(getWeekStartDate(date));
  startDate.setDate(startDate.getDate() + 6);
  return startDate.toISOString().split('T')[0];
}

/**
 * Add days to a date
 * @param dateStr - ISO date string
 * @param days - Number of days to add (can be negative)
 * @returns ISO date string
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate initial week date range based on current day
 * Mon-Thu: Rest of current week
 * Fri-Sun: Till end of next week
 * 
 * @param date - The date to calculate from (defaults to today)
 * @returns DateRange object with start and end dates
 */
export function calculateInitialWeekRange(date: Date = new Date()): DateRange {
  const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const isMonToThu = dayOfWeek >= 1 && dayOfWeek <= 4;
  
  const start = getWeekStartDate(date);
  const end = isMonToThu 
    ? getWeekEndDate(date) 
    : addDays(getWeekEndDate(date), 7);
  
  return { start, end };
}

/**
 * Calculate next week date range
 * @param currentRange - The current week's date range
 * @returns DateRange object for the next week
 */
export function calculateNextWeekRange(currentRange: DateRange): DateRange {
  const nextStart = addDays(currentRange.end, 1);
  const nextEnd = addDays(nextStart, 6);
  return { start: nextStart, end: nextEnd };
}

/**
 * Calculate date from dayOfWeek (0=Sunday, 1=Monday, etc.)
 * @param dayOfWeek - Day of week (0-6)
 * @param weekStartDate - ISO date string for Monday of the week
 * @returns ISO date string for the specific day
 */
export function calculateDateFromDayOfWeek(dayOfWeek: number, weekStartDate: string): string {
  // Convert Sunday (0) to offset 6, Monday (1) to offset 0, etc.
  const dayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return addDays(weekStartDate, dayOffset);
}

/**
 * Format week header: "Jan 20 - 26 - Foundation Week"
 * @param weekNumber - The week number (kept for backward compatibility but not displayed)
 * @param dateRange - The date range for the week
 * @param focus - The week's focus/title
 * @returns Formatted week header string
 */
export function formatWeekHeader(weekNumber: number, dateRange: DateRange, focus: string): string {
  const start = formatMonthDay(dateRange.start);
  const end = formatMonthDay(dateRange.end);
  
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  
  // Cross-month check
  if (startDate.getMonth() !== endDate.getMonth()) {
    // Different months: "Jan 27 - Feb 2 - Foundation Week"
    return `${start} - ${end} - ${focus}`;
  }
  
  // Same month: "Jan 20 - 26 - Foundation Week"
  const month = start.split(' ')[0];
  const startDay = start.split(' ')[1];
  const endDay = end.split(' ')[1];
  return `${month} ${startDay} - ${endDay} - ${focus}`;
}

/**
 * Format month and day: "Jan 20"
 * @param dateStr - ISO date string
 * @returns Formatted month and day string
 */
export function formatMonthDay(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

/**
 * Format day header: "Monday, Jan 20"
 * @param dayOfWeek - Day of week (0-6, 0=Sunday)
 * @param weekStartDate - ISO date string for Monday of the week
 * @returns Formatted day header string
 */
export function formatDayHeader(dayOfWeek: number, weekStartDate: string): string {
  const date = calculateDateFromDayOfWeek(dayOfWeek, weekStartDate);
  const d = new Date(date);
  const weekday = d.toLocaleString('en-US', { weekday: 'long' });
  return `${weekday}, ${formatMonthDay(date)}`;
}

/**
 * Calculate days since a date
 * @param dateStr - ISO date string
 * @returns Number of days since the date (negative if date is in future)
 */
export function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is today
 * @param dateStr - ISO date string
 * @returns true if the date is today
 */
export function isToday(dateStr: string): boolean {
  return daysSince(dateStr) === 0;
}

/**
 * Check if a date is in the past
 * @param dateStr - ISO date string
 * @returns true if the date is in the past
 */
export function isPast(dateStr: string): boolean {
  return daysSince(dateStr) > 0;
}

/**
 * Check if a date is in the future
 * @param dateStr - ISO date string
 * @returns true if the date is in the future
 */
export function isFuture(dateStr: string): boolean {
  return daysSince(dateStr) < 0;
}

/**
 * Get today's date as ISO string
 * @returns ISO date string for today
 */
export function getTodayISO(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0];
}

/**
 * Format a full date: "Monday, January 20, 2025"
 * @param dateStr - ISO date string
 * @returns Formatted full date string
 */
export function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

/** App calendar dates use Malaysia time (UTC+8), not the server's UTC midnight. */
export const APP_TIMEZONE = 'Asia/Kuala_Lumpur';

/** Returns YYYY-MM-DD in Asia/Kuala_Lumpur. */
export function todayInAppTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

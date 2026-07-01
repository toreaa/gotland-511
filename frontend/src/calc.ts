// Re-implementation of the spreadsheet's core formula:
//   arrival_at_poi = start_datetime + (pace_seconds_per_km * distance_km)
// (Original Excel formula: =$B$2 + ($B$3 * B<row>) where $B$3 is a time-of-day
// value expressed as a fraction of a day. We work in seconds in JS land.)

export function arrivalAt(startMs: number, paceSecondsPerKm: number, distanceKm: number): Date {
  const offsetMs = paceSecondsPerKm * 1000 * distanceKm;
  return new Date(startMs + offsetMs);
}

export function formatClock(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function formatDayLabel(d: Date, _startMs?: number): string {
  // Return the weekday abbreviation of the arrival date (local time).
  // The legacy second argument is kept for backwards compatibility but ignored.
  return WEEKDAYS[d.getDay()];
}

export function formatPace(paceSecondsPerKm: number): string {
  const m = Math.floor(paceSecondsPerKm / 60);
  const s = paceSecondsPerKm % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parsePace(text: string): number | null {
  // Accepts "8:15", "08:15", "8.15", or just a number of seconds.
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (m) {
    const mm = parseInt(m[1], 10);
    const ss = parseInt(m[2], 10);
    if (Number.isFinite(mm) && Number.isFinite(ss) && ss < 60) return mm * 60 + ss;
    return null;
  }
  const n = parseInt(t, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

// Haversine distance in km between two lat/lon points.
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

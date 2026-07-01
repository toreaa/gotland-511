// Snap-to-route geometry for the Gotland 511 GPX track.
//
// Loads the bundled track, precomputes cumulative distance per point, and
// exposes:
//   - snapToRoute(lat, lon, prevKm)  → nearest km along the route, within
//     a sliding window around the previous km (so route crossings can't
//     teleport the user from km 98 to km 165).
//   - kmToCoord(km)  → reverse lookup for simulation / "you are here".
//   - haversineKm                    → distance between two lat/lon points.

import routeData from "@/src/data/gotland.json";

export type LatLon = { lat: number; lon: number };

const RAW_TRACK: number[][] = (routeData as any).track ?? [];
export const TRACK: LatLon[] = RAW_TRACK.map(([lat, lon]) => ({ lat, lon }));

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Precompute cumulative distance along the track once at module load.
export const CUM_KM: number[] = new Array(TRACK.length);
CUM_KM[0] = 0;
for (let i = 1; i < TRACK.length; i++) {
  CUM_KM[i] = CUM_KM[i - 1] + haversineKm(TRACK[i - 1], TRACK[i]);
}
export const ROUTE_LEN_KM = CUM_KM.length > 0 ? CUM_KM[CUM_KM.length - 1] : 0;

// Binary search: smallest index i such that CUM_KM[i] >= v.
function bisectLeft(v: number): number {
  let lo = 0,
    hi = CUM_KM.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (CUM_KM[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type SnapHit = {
  kind: "hit";
  km: number;
  lat: number;
  lon: number;
  distanceM: number;
};
export type SnapMiss = { kind: "off-route"; nearestKm: number; distanceM: number };
export type SnapResult = SnapHit | SnapMiss;

// Snap a GPS reading to the nearest track point within ±windowKm of prevKm.
// If prevKm is null (first lock), search globally.
export function snapToRoute(
  lat: number,
  lon: number,
  prevKm: number | null,
  windowKm = 5,
  offRouteThresholdM = 50
): SnapResult | null {
  if (TRACK.length === 0) return null;

  let iStart: number, iEnd: number;
  if (prevKm == null) {
    iStart = 0;
    iEnd = TRACK.length - 1;
  } else {
    iStart = bisectLeft(Math.max(0, prevKm - windowKm));
    iEnd = bisectLeft(Math.min(ROUTE_LEN_KM, prevKm + windowKm));
  }

  const q: LatLon = { lat, lon };
  let bestI = iStart;
  let bestKm = haversineKm(q, TRACK[iStart]);
  for (let i = iStart + 1; i <= iEnd; i++) {
    const d = haversineKm(q, TRACK[i]);
    if (d < bestKm) {
      bestKm = d;
      bestI = i;
    }
  }

  const distanceM = bestKm * 1000;
  if (distanceM > offRouteThresholdM) {
    return { kind: "off-route", nearestKm: CUM_KM[bestI], distanceM };
  }
  return {
    kind: "hit",
    km: CUM_KM[bestI],
    lat: TRACK[bestI].lat,
    lon: TRACK[bestI].lon,
    distanceM,
  };
}

// Reverse: given a kilometre along the route, return the GPX coordinate.
export function kmToCoord(km: number): LatLon {
  if (TRACK.length === 0) return { lat: 0, lon: 0 };
  const clamped = Math.max(0, Math.min(ROUTE_LEN_KM, km));
  const i = bisectLeft(clamped);
  return TRACK[Math.min(i, TRACK.length - 1)];
}

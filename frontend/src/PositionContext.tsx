// Cross-tab position state: GPS subscription, simulation mode, manual
// override, snap-to-route, live pace smoothing.
//
// We deliberately keep ALL stateful position logic in this single provider so
// the Info tab, the Map tab and the About tab all read the same source of
// truth (currentKm, currentCoords, livePace, etc.).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as Location from "expo-location";

import {
  ROUTE_LEN_KM,
  kmToCoord,
  snapToRoute,
  haversineKm,
  TRACK,
  CUM_KM,
} from "@/src/snap";

const MAX_PLAUSIBLE_KMH = 60; // reject GPS-induced impossible jumps
const LIVE_PACE_WINDOW_MS = 5 * 60 * 1000; // 5-minute rolling window
const MANUAL_OVERRIDE_GRACE_MS = 30_000; // override anchors snap window for 30s

type LatLon = { lat: number; lon: number };

type Ctx = {
  // Mode / control
  gpsEnabled: boolean;
  gpsPermDenied: boolean;
  enableGps: () => Promise<boolean>;
  disableGps: () => void;

  // Simulation (Position Test on About)
  simulatedKm: number | null;
  setSimulatedKm: (km: number | null) => void;

  // Derived
  currentKm: number | null;
  currentCoords: LatLon | null;
  livePaceSecondsPerKm: number | null;
  isOffRoute: boolean;

  // Manual override ("I'm here" tap on map)
  setManualOverride: (km: number) => void;

  // Helpers
  routeLenKm: number;
  coordToKm: (lat: number, lon: number) => number;
};

const PositionContext = createContext<Ctx | null>(null);

export function usePosition(): Ctx {
  const v = useContext(PositionContext);
  if (!v) throw new Error("usePosition must be used within PositionProvider");
  return v;
}

export function PositionProvider({ children }: { children: React.ReactNode }) {
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsPermDenied, setGpsPermDenied] = useState(false);
  const [simulatedKm, setSimulatedKmState] = useState<number | null>(null);
  const [currentKm, setCurrentKm] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<LatLon | null>(null);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [livePaceSecondsPerKm, setLivePace] = useState<number | null>(null);

  const subRef = useRef<Location.LocationSubscription | null>(null);
  const paceSamplesRef = useRef<Array<{ ts: number; km: number }>>([]);
  const manualOverrideRef = useRef<{ km: number; expiresAt: number } | null>(null);
  const lastKmRef = useRef<number | null>(null);

  // Keep a ref of latest km so the GPS callback sees fresh data.
  useEffect(() => {
    lastKmRef.current = currentKm;
  }, [currentKm]);

  // Find the km along the route closest to an arbitrary lat/lon.
  // Used for the "I'm here"-tap on the map.
  const coordToKm = useCallback((lat: number, lon: number) => {
    let bestI = 0;
    let bestD = haversineKm({ lat, lon }, TRACK[0]);
    for (let i = 1; i < TRACK.length; i++) {
      const d = haversineKm({ lat, lon }, TRACK[i]);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    return CUM_KM[bestI];
  }, []);

  // Simulation drives the derived state directly.
  const setSimulatedKm = useCallback((km: number | null) => {
    setSimulatedKmState(km);
    if (km != null) {
      setCurrentKm(km);
      setCurrentCoords(kmToCoord(km));
      setIsOffRoute(false);
      setLivePace(null);
      paceSamplesRef.current = [];
    } else {
      // Leaving simulation. If GPS is on we wait for the next fix; otherwise clear.
      paceSamplesRef.current = [];
      setLivePace(null);
      if (!gpsEnabled) {
        setCurrentKm(null);
        setCurrentCoords(null);
      }
    }
  }, [gpsEnabled]);

  const enableGps = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setGpsPermDenied(true);
      return false;
    }
    setGpsPermDenied(false);
    setGpsEnabled(true);
    return true;
  }, []);

  const disableGps = useCallback(() => {
    setGpsEnabled(false);
    subRef.current?.remove();
    subRef.current = null;
    paceSamplesRef.current = [];
    setLivePace(null);
    if (simulatedKm == null) {
      setCurrentKm(null);
      setCurrentCoords(null);
      setIsOffRoute(false);
    }
  }, [simulatedKm]);

  const setManualOverride = useCallback((km: number) => {
    manualOverrideRef.current = {
      km,
      expiresAt: Date.now() + MANUAL_OVERRIDE_GRACE_MS,
    };
    setCurrentKm(km);
    setCurrentCoords(kmToCoord(km));
    setIsOffRoute(false);
    paceSamplesRef.current = [{ ts: Date.now(), km }];
    setLivePace(null);
  }, []);

  // Subscribe to GPS when enabled.
  useEffect(() => {
    if (!gpsEnabled) return;

    let cancelled = false;
    (async () => {
      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 3,
            timeInterval: 2000,
          },
          (loc) => {
            if (cancelled) return;
            handleGpsUpdate(loc.coords);
          }
        );
        if (cancelled) sub.remove();
        else subRef.current = sub;
      } catch {
        /* watch failed — leave subRef null */
      }
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsEnabled]);

  const handleGpsUpdate = useCallback(
    (coords: Location.LocationObjectCoords) => {
      // Simulation wins — don't disturb the simulated km.
      if (simulatedKm != null) return;

      const now = Date.now();
      setCurrentCoords({ lat: coords.latitude, lon: coords.longitude });

      // Determine anchor km for the windowed snap.
      let anchorKm = lastKmRef.current;
      const ov = manualOverrideRef.current;
      if (ov && now < ov.expiresAt) anchorKm = ov.km;

      const result = snapToRoute(coords.latitude, coords.longitude, anchorKm);
      if (!result) return;

      if (result.kind === "off-route") {
        setIsOffRoute(true);
        return; // keep last currentKm so the list/marker don't jump
      }

      // Sanity: reject impossible jumps (would need >60 km/h between samples).
      const samples = paceSamplesRef.current;
      if (samples.length > 0) {
        const last = samples[samples.length - 1];
        const dtSec = (now - last.ts) / 1000;
        const dKm = Math.abs(result.km - last.km);
        if (dtSec > 0 && (dKm / dtSec) * 3600 > MAX_PLAUSIBLE_KMH) {
          return;
        }
      }

      setIsOffRoute(false);
      setCurrentKm(result.km);
      lastKmRef.current = result.km;

      // Live pace smoothing.
      samples.push({ ts: now, km: result.km });
      paceSamplesRef.current = samples.filter(
        (s) => now - s.ts < LIVE_PACE_WINDOW_MS
      );
      const win = paceSamplesRef.current;
      if (win.length >= 2) {
        const first = win[0];
        const last = win[win.length - 1];
        const elapsed = (last.ts - first.ts) / 1000;
        const kmDelta = last.km - first.km;
        if (kmDelta > 0.05 && elapsed > 5) {
          setLivePace(elapsed / kmDelta);
        }
      }
    },
    [simulatedKm]
  );

  return (
    <PositionContext.Provider
      value={{
        gpsEnabled,
        gpsPermDenied,
        enableGps,
        disableGps,
        simulatedKm,
        setSimulatedKm,
        currentKm,
        currentCoords,
        livePaceSecondsPerKm,
        isOffRoute,
        setManualOverride,
        routeLenKm: ROUTE_LEN_KM,
        coordToKm,
      }}
    >
      {children}
    </PositionContext.Provider>
  );
}

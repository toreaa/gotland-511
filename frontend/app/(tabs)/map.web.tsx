import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { theme, categoryIcon } from "@/src/theme";
import routeData from "@/src/data/gotland.json";
import { usePosition } from "@/src/PositionContext";

// Web stub: react-native-maps is iOS/Android only. On web we show a textual
// preview + simulation status so all other tabs keep working.
export default function MapScreenWeb() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ poiId?: string }>();
  const pos = usePosition();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selectedPoi = useMemo(() => {
    if (!params.poiId) return null;
    const id = Number(params.poiId);
    return (routeData as any).pois.find((p: any) => p.id === id) ?? null;
  }, [params.poiId]);

  const counts = useMemo(() => {
    const pois = (routeData as any).pois as any[];
    const withCoords = pois.filter((p) => p.lat != null && p.lon != null);
    const off = withCoords.filter((p) => p.off_route).length;
    return { on: withCoords.length - off, off };
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }),
        (e) => setErr(e.message)
      );
    } else {
      setErr("Geolocation not supported in this browser.");
    }
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="map-view">
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topTitle}>LIVE TRACKER</Text>
          <Text style={styles.topSubtitle}>
            {counts.on} on-route · {counts.off} off-route · {(routeData as any).track_total_km ?? 0} km
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="map-outline" size={40} color={theme.color.brand} />
        </View>
        <Text style={styles.title}>iPhone-only Map</Text>
        <Text style={styles.subtitle}>
          Die volle Karte mit GPX-Track, allen POI-Pins und Live-GPS läuft im iPhone-Build via Expo Go.
        </Text>

        {pos.simulatedKm != null ? (
          <View style={styles.simBox} testID="sim-active-box">
            <Ionicons name="flask-outline" size={18} color={theme.color.brand} />
            <Text style={styles.simBoxText}>
              SIMULATION AKTIV · km {pos.simulatedKm.toFixed(1)}
            </Text>
          </View>
        ) : null}

        {selectedPoi ? (
          <View style={styles.poiCard} testID="poi-card">
            <View style={styles.poiHeader}>
              <View style={styles.poiIcon}>
                <Ionicons
                  name={categoryIcon(selectedPoi.category) as any}
                  size={18}
                  color={theme.color.brand}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.poiName}>{selectedPoi.name}</Text>
                <Text style={styles.poiMeta}>
                  {selectedPoi.category} · {(selectedPoi.distance ?? 0).toFixed(1)} km
                </Text>
              </View>
            </View>
            {selectedPoi.lat != null ? (
              <Text style={styles.poiCoords}>
                {selectedPoi.lat.toFixed(5)}, {selectedPoi.lon.toFixed(5)}
              </Text>
            ) : null}
            {selectedPoi.open ? <Text style={styles.poiOpen}>{selectedPoi.open}</Text> : null}
            {selectedPoi.note ? <Text style={styles.poiNote}>{selectedPoi.note}</Text> : null}
          </View>
        ) : (
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>BROWSER GPS</Text>
            {coords ? (
              <>
                <Text style={styles.statValue}>{coords.lat.toFixed(5)}</Text>
                <Text style={styles.statLabel}>LATITUDE</Text>
                <View style={{ height: 8 }} />
                <Text style={styles.statValue}>{coords.lon.toFixed(5)}</Text>
                <Text style={styles.statLabel}>LONGITUDE</Text>
              </>
            ) : (
              <Text style={styles.statValueDim}>{err ?? "Awaiting permission…"}</Text>
            )}
          </View>
        )}

        <Pressable
          style={styles.btn}
          onPress={() => {
            if (typeof navigator !== "undefined" && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (p) => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }),
                (e) => setErr(e.message)
              );
            }
          }}
          testID="recenter-button"
        >
          <Ionicons name="locate" size={18} color={theme.color.onBrand} />
          <Text style={styles.btnText}>REFRESH POSITION</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  topBar: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    backgroundColor: theme.color.surfaceSecondary,
  },
  topTitle: {
    color: theme.color.onSurface,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
  },
  topSubtitle: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  body: { padding: theme.spacing.xl, alignItems: "center" },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.color.brandSecondary,
    borderWidth: 1,
    borderColor: theme.color.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  title: { color: theme.color.onSurface, fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  subtitle: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 14,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    lineHeight: 21,
    maxWidth: 340,
  },
  simBox: {
    marginTop: theme.spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.color.brandSecondary,
    borderWidth: 1,
    borderColor: theme.color.brand,
    borderRadius: theme.radius.md,
  },
  simBoxText: {
    color: theme.color.brand,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 1,
  },
  statBlock: {
    marginTop: theme.spacing.xl,
    width: "100%",
    maxWidth: 320,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: "flex-start",
  },
  statLabel: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  statValue: {
    color: theme.color.brand,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statValueDim: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  poiCard: {
    marginTop: theme.spacing.xl,
    width: "100%",
    maxWidth: 360,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.color.brand,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
  },
  poiHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  poiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.color.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  poiName: { color: theme.color.onSurface, fontSize: 17, fontWeight: "800" },
  poiMeta: {
    color: theme.color.brand,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  poiCoords: {
    color: theme.color.onSurface,
    fontSize: 13,
    fontFamily: theme.font.mono,
    marginTop: theme.spacing.md,
  },
  poiOpen: {
    color: theme.color.onSurfaceTertiary,
    fontSize: 12,
    marginTop: theme.spacing.sm,
  },
  poiNote: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: theme.spacing.xs,
    lineHeight: 17,
  },
  btn: {
    marginTop: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.color.brand,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
  },
  btnText: {
    color: theme.color.onBrand,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
});

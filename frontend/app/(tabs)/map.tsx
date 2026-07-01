import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";

import { theme, categoryIcon } from "@/src/theme";
import routeData from "@/src/data/gotland.json";
import { usePosition } from "@/src/PositionContext";
import { formatPace } from "@/src/calc";
import { kmToCoord, ROUTE_LEN_KM } from "@/src/snap";
import KM_ICONS from "@/src/kmIcons";

const BLINKY = require("../../assets/blinky.png");

const TRACK: Array<[number, number]> = (routeData as any).track ?? [];
const BOUNDS = (routeData as any).bounds ?? {
  minLat: 56.9,
  maxLat: 58.0,
  minLon: 18.0,
  maxLon: 19.4,
};

const INITIAL_REGION: Region = {
  latitude: (BOUNDS.minLat + BOUNDS.maxLat) / 2,
  longitude: (BOUNDS.minLon + BOUNDS.maxLon) / 2,
  latitudeDelta: (BOUNDS.maxLat - BOUNDS.minLat) * 1.15,
  longitudeDelta: (BOUNDS.maxLon - BOUNDS.minLon) * 1.15,
};

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1726" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

type POI = {
  id: number;
  distance: number | null;
  off_route: boolean;
  name: string;
  category: string;
  open: string | null;
  note: string | null;
  phone: string | null;
  lat: number | null;
  lon: number | null;
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const params = useLocalSearchParams<{ poiId?: string }>();
  const pos = usePosition();

  const [selectedPoiId, setSelectedPoiId] = useState<number | null>(
    params.poiId ? Number(params.poiId) : null
  );
  // Show/hide the every-10-km labels on the route.
  // We only ever toggle the native `opacity` prop of the marker (which does
  // NOT require re-tracking view changes). This avoids the iOS Apple Maps
  // side-effect where nearby POI markers briefly disappear when we force
  // km-markers to re-render.
  const [showKmLabels, setShowKmLabels] = useState<boolean>(true);

  const onMapPois: POI[] = useMemo(
    () =>
      (routeData.pois as POI[]).filter((p) => p.lat != null && p.lon != null),
    []
  );
  const onRouteCount = useMemo(
    () => onMapPois.filter((p) => !p.off_route).length,
    [onMapPois]
  );
  const offRouteCount = onMapPois.length - onRouteCount;

  const polyline = useMemo(
    () => TRACK.map(([lat, lon]) => ({ latitude: lat, longitude: lon })),
    []
  );

  // Blinky Start marker (km 0) + Finish marker (last km on route)
  const startCoord = useMemo(() => {
    const c = kmToCoord(0);
    return { latitude: c.lat, longitude: c.lon };
  }, []);
  const finishCoord = useMemo(() => {
    const c = kmToCoord(ROUTE_LEN_KM);
    return { latitude: c.lat, longitude: c.lon };
  }, []);
  const isLoop = useMemo(() => {
    const dLat = Math.abs(startCoord.latitude - finishCoord.latitude);
    const dLon = Math.abs(startCoord.longitude - finishCoord.longitude);
    // ~500m tolerance
    return dLat < 0.005 && dLon < 0.005;
  }, [startCoord, finishCoord]);

  // Every 10 km, place a small "km label" pin along the route.
  // Skip 0 (Start blinky) and the final km if it coincides with Finish blinky.
  const kmMarkers = useMemo(() => {
    const out: Array<{ km: number; lat: number; lon: number }> = [];
    const maxKm = Math.floor(ROUTE_LEN_KM / 10) * 10;
    for (let km = 10; km <= maxKm; km += 10) {
      const c = kmToCoord(km);
      out.push({ km, lat: c.lat, lon: c.lon });
    }
    return out;
  }, []);

  const selectedPoi = useMemo(
    () =>
      selectedPoiId != null
        ? (routeData.pois as POI[]).find((p) => p.id === selectedPoiId) ?? null
        : null,
    [selectedPoiId]
  );

  useFocusEffect(
    React.useCallback(() => {
      if (params.poiId) {
        const id = Number(params.poiId);
        setSelectedPoiId(id);
      }
    }, [params.poiId])
  );

  useEffect(() => {
    if (selectedPoi?.lat != null && selectedPoi.lon != null && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: selectedPoi.lat,
          longitude: selectedPoi.lon,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        700
      );
    }
  }, [selectedPoi]);

  const recenter = () => {
    if (pos.currentCoords && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: pos.currentCoords.lat,
          longitude: pos.currentCoords.lon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        600
      );
    } else if (mapRef.current) {
      mapRef.current.animateToRegion(INITIAL_REGION, 600);
    }
  };

  const fitRoute = () => {
    mapRef.current?.animateToRegion(INITIAL_REGION, 700);
    setSelectedPoiId(null);
  };

  const gpsBtnLabel = pos.gpsEnabled
    ? "GPS ON"
    : pos.gpsPermDenied
    ? "GPS DENIED"
    : pos.simulatedKm != null
    ? "SIMULATION"
    : "GPS OFF";
  const gpsBtnActive = pos.gpsEnabled || pos.simulatedKm != null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation={pos.gpsEnabled}
        showsMyLocationButton={false}
        showsCompass
        customMapStyle={DARK_MAP_STYLE}
        testID="map-view"
      >
        {polyline.length > 1 && (
          <Polyline
            coordinates={polyline}
            strokeColor={theme.color.brand}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* KM markers every 10 km along the route.
            Each marker renders a static pre-rendered PNG child (no live text
            layout, no re-tracking). Ein-/Ausblenden nur über die native
            `opacity`-Prop, damit auch bei vielen Toggles nichts flackert. */}
        {kmMarkers.map((m) => {
          const icon = KM_ICONS[m.km];
          if (!icon) return null;
          return (
            <Marker
              key={`km-${m.km}`}
              coordinate={{ latitude: m.lat, longitude: m.lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              opacity={showKmLabels ? 1 : 0}
              zIndex={showKmLabels ? 5 : -1}
            >
              <Image source={icon} style={styles.kmIcon} resizeMode="contain" />
            </Marker>
          );
        })}

        {/* Start (km 0) — Blinky */}
        <Marker
          key="start-blinky"
          coordinate={startCoord}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          zIndex={20}
        >
          <View style={styles.blinkyWrap} pointerEvents="none">
            <Image source={BLINKY} style={styles.blinkyImg} resizeMode="contain" />
            <View style={styles.blinkyBadge}>
              <Text style={styles.blinkyBadgeText}>{isLoop ? "START / ZIEL" : "START"}</Text>
            </View>
          </View>
        </Marker>

        {/* Finish (last km) — Blinky. Only render if the route is not a loop
            (otherwise the start marker already represents Start & Ziel). */}
        {!isLoop && (
          <Marker
            key="finish-blinky"
            coordinate={finishCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={20}
          >
            <View style={styles.blinkyWrap} pointerEvents="none">
              <Image source={BLINKY} style={styles.blinkyImg} resizeMode="contain" />
              <View style={styles.blinkyBadge}>
                <Text style={styles.blinkyBadgeText}>ZIEL</Text>
              </View>
            </View>
          </Marker>
        )}

        {onMapPois.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat!, longitude: p.lon! }}
            onPress={() => setSelectedPoiId(p.id)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={selectedPoiId === p.id ? 100 : 30}
          >
            <View
              style={[
                styles.poiDot,
                selectedPoiId === p.id && styles.poiDotSelected,
              ]}
            >
              <Ionicons
                name={categoryIcon(p.category) as any}
                size={selectedPoiId === p.id ? 14 : 10}
                color={
                  selectedPoiId === p.id
                    ? theme.color.onBrand
                    : theme.color.onSurface
                }
              />
            </View>
          </Marker>
        ))}

        {pos.currentCoords && (
          <Marker
            coordinate={{
              latitude: pos.currentCoords.lat,
              longitude: pos.currentCoords.lon,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            // Only ONE me-marker exists on the map, so tracking view changes
            // is cheap and guarantees the child View is snapshotted correctly
            // (fixes iOS bug where the pulse dot was invisible in simulation).
            tracksViewChanges={true}
            zIndex={500}
            testID="me-marker"
          >
            <View
              style={[
                styles.youDot,
                pos.simulatedKm != null && styles.youDotSim,
              ]}
            >
              <View style={styles.youDotInner} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Text style={styles.topTitle}>LIVE TRACKER</Text>
        <Text style={styles.topSubtitle}>
          {onRouteCount} on-route · {offRouteCount} off-route · {(routeData as any).track_total_km ?? 0} km
        </Text>
        <Pressable
          onPress={() => (pos.gpsEnabled ? pos.disableGps() : pos.enableGps())}
          style={[styles.gpsButton, gpsBtnActive && styles.gpsButtonActive]}
          testID="gps-toggle-button"
        >
          <Ionicons
            name={pos.gpsEnabled ? "radio" : "radio-outline"}
            size={16}
            color={gpsBtnActive ? theme.color.brand : theme.color.onSurfaceSecondary}
            style={{ marginRight: 8 }}
          />
          <Text
            style={[
              styles.gpsButtonText,
              gpsBtnActive && { color: theme.color.brand },
            ]}
          >
            {gpsBtnLabel}
          </Text>
        </Pressable>
      </View>

      {/* Permission denied panel */}
      {pos.gpsPermDenied && !pos.gpsEnabled && !pos.simulatedKm && (
        <View style={styles.permPanel}>
          <Ionicons name="warning-outline" size={20} color={theme.color.warning} />
          <Text style={styles.permPanelText}>
            GPS-Berechtigung verweigert. Aktiviere sie in den iPhone-Einstellungen, um
            deine Live-Position zu sehen.
          </Text>
        </View>
      )}

      {/* Live stats card (only if position is known) */}
      {pos.currentKm != null && !selectedPoi && (
        <View
          style={[styles.liveCard, { paddingBottom: insets.bottom + theme.spacing.sm }]}
          testID="live-card"
        >
          <View style={styles.liveStat}>
            <Text style={styles.liveStatLabel}>POSITION</Text>
            <Text style={styles.liveStatValue}>{pos.currentKm.toFixed(1)}</Text>
            <Text style={styles.liveStatUnit}>km</Text>
          </View>
          <View style={styles.liveStatDivider} />
          <View style={styles.liveStat}>
            <Text style={styles.liveStatLabel}>LIVE PACE</Text>
            <Text style={styles.liveStatValue}>
              {pos.livePaceSecondsPerKm
                ? formatPace(Math.round(pos.livePaceSecondsPerKm))
                : "—"}
            </Text>
            <Text style={styles.liveStatUnit}>min/km</Text>
          </View>
          <View style={styles.liveStatDivider} />
          <View style={styles.liveStat}>
            <Text style={styles.liveStatLabel}>STATUS</Text>
            <Text
              style={[
                styles.liveStatValueSm,
                { color: pos.isOffRoute ? theme.color.warning : theme.color.success },
              ]}
            >
              {pos.simulatedKm != null
                ? "SIM"
                : pos.isOffRoute
                ? "OFF"
                : "ON"}
            </Text>
            <Text style={styles.liveStatUnit}>
              {pos.simulatedKm != null ? "simulation" : "route"}
            </Text>
          </View>
        </View>
      )}

      {/* FABs */}
      <View
        style={[
          styles.fabStack,
          { bottom: insets.bottom + (selectedPoi ? 200 : pos.currentKm != null ? 110 : 24) },
        ]}
      >
        <Pressable
          onPress={() => setShowKmLabels((v) => !v)}
          style={[styles.fab, showKmLabels && styles.fabActive]}
          testID="km-labels-toggle"
          accessibilityLabel={showKmLabels ? "KM-Zahlen ausblenden" : "KM-Zahlen einblenden"}
        >
          <View style={styles.kmFabInner}>
            <Text
              style={[
                styles.kmFabText,
                { color: showKmLabels ? theme.color.onBrand : theme.color.onSurface },
              ]}
            >
              KM
            </Text>
            {!showKmLabels && <View style={styles.kmFabSlash} />}
          </View>
        </Pressable>
        <Pressable onPress={fitRoute} style={styles.fab} testID="fit-route-button">
          <Ionicons name="resize-outline" size={20} color={theme.color.onSurface} />
        </Pressable>
        <Pressable onPress={recenter} style={styles.fab} testID="recenter-button">
          <Ionicons name="locate" size={22} color={theme.color.onSurface} />
        </Pressable>
      </View>

      {/* POI card */}
      {selectedPoi && selectedPoi.lat != null ? (
        <View
          style={[styles.poiCard, { paddingBottom: insets.bottom + theme.spacing.sm }]}
          testID="poi-card"
        >
          <View style={styles.poiCardHeader}>
            <View style={styles.poiCardIcon}>
              <Ionicons
                name={categoryIcon(selectedPoi.category) as any}
                size={18}
                color={theme.color.brand}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.poiCardNameRow}>
                <Text style={styles.poiCardName} numberOfLines={2}>
                  {selectedPoi.name}
                </Text>
                {selectedPoi.off_route && (
                  <View style={styles.poiCardOffBadge}>
                    <Text style={styles.poiCardOffBadgeText}>OFF-ROUTE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.poiCardMeta}>
                {selectedPoi.category} · {(selectedPoi.distance ?? 0).toFixed(1)} km
              </Text>
            </View>
            <Pressable onPress={() => setSelectedPoiId(null)} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.color.onSurfaceSecondary} />
            </Pressable>
          </View>
          {(selectedPoi.open || selectedPoi.note || selectedPoi.phone) && (
            <ScrollView style={{ maxHeight: 130 }}>
              {selectedPoi.open ? (
                <Text style={styles.poiCardOpen}>
                  <Ionicons name="time-outline" size={12} color={theme.color.onSurfaceSecondary} />{" "}
                  {selectedPoi.open.replace(/\n/g, " · ")}
                </Text>
              ) : null}
              {selectedPoi.phone ? (
                <Pressable
                  onPress={() => {
                    const num = selectedPoi.phone!.replace(/[^\d+]/g, "");
                    Linking.openURL(`tel:${num}`);
                  }}
                  style={styles.poiCardPhoneBtn}
                  testID="poi-card-phone"
                >
                  <Ionicons name="call" size={14} color={theme.color.brand} />
                  <Text style={styles.poiCardPhoneText}>{selectedPoi.phone}</Text>
                </Pressable>
              ) : null}
              {selectedPoi.note ? (
                <Text style={styles.poiCardNote}>{selectedPoi.note}</Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  map: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: "rgba(18,18,18,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
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
    marginBottom: theme.spacing.md,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surface,
    alignSelf: "stretch",
  },
  gpsButtonActive: {
    backgroundColor: theme.color.brandSecondary,
    borderColor: theme.color.brand,
  },
  gpsButtonText: {
    color: theme.color.onSurface,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  banner: {
    position: "absolute",
    top: 90,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.brand,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  bannerText: {
    color: theme.color.onSurface,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  permPanel: {
    position: "absolute",
    top: 90,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.color.surfaceSecondary,
    borderColor: theme.color.warning,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "flex-start",
  },
  permPanelText: { color: theme.color.onSurface, fontSize: 12, flex: 1, lineHeight: 17 },
  fabStack: {
    position: "absolute",
    right: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  fabActive: {
    backgroundColor: theme.color.brand,
    borderColor: theme.color.brand,
  },
  kmFabInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  kmFabText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  kmFabSlash: {
    position: "absolute",
    width: 30,
    height: 2,
    backgroundColor: theme.color.warning,
    transform: [{ rotate: "-20deg" }],
    borderRadius: 1,
  },
  poiDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: theme.color.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  poiDotOff: {
    backgroundColor: "transparent",
    borderColor: theme.color.onSurfaceSecondary,
    borderStyle: "dashed",
  },
  poiDotSelected: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.color.brand,
    borderColor: theme.color.onBrand,
    borderWidth: 2,
    borderStyle: "solid",
  },
  youDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(52, 199, 89, 0.25)",
    borderWidth: 2,
    borderColor: theme.color.success,
    alignItems: "center",
    justifyContent: "center",
  },
  youDotSim: {
    // Simulation: same size, same green ring — visually identical to real GPS,
    // because the user explicitly asked for no orange/red outline.
  },
  youDotInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.color.success,
  },
  // Km markers (every 10 km) — rendered via pre-generated PNGs.
  kmIcon: {
    width: 32,
    height: 18,
  },
  // Blinky start/finish
  blinkyWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  blinkyImg: {
    width: 34,
    height: 34,
  },
  blinkyBadge: {
    marginTop: 2,
    backgroundColor: "#000",
    borderColor: "#FF3B30",
    borderWidth: 1.2,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  blinkyBadgeText: {
    color: "#FF3B30",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  // Live stats card
  liveCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.color.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    flexDirection: "row",
  },
  liveStat: {
    flex: 1,
    paddingHorizontal: theme.spacing.sm,
  },
  liveStatDivider: {
    width: 1,
    backgroundColor: theme.color.border,
  },
  liveStatLabel: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  liveStatValue: {
    color: theme.color.brand,
    fontSize: 22,
    fontWeight: "800",
  },
  liveStatValueSm: {
    fontSize: 18,
    fontWeight: "800",
  },
  liveStatUnit: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  // POI card
  poiCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.color.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.color.brand,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  poiCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  poiCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.color.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  poiCardName: {
    color: theme.color.onSurface,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  poiCardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  poiCardOffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#3A1E16",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.brand,
  },
  poiCardOffBadgeText: {
    color: theme.color.brand,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  poiCardMeta: {
    color: theme.color.brand,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  poiCardOpen: {
    color: theme.color.onSurfaceTertiary,
    fontSize: 12,
    marginTop: theme.spacing.sm,
  },
  poiCardPhoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: theme.spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.color.brandSecondary,
    borderWidth: 1,
    borderColor: theme.color.brand,
    borderRadius: theme.radius.pill,
    alignSelf: "flex-start",
  },
  poiCardPhoneText: {
    color: theme.color.brand,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  poiCardNote: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: theme.spacing.xs,
    lineHeight: 17,
  },
});

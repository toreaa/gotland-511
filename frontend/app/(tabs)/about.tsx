import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";

import { theme } from "@/src/theme";
import routeData from "@/src/data/gotland.json";
import { formatPace } from "@/src/calc";
import { usePosition } from "@/src/PositionContext";

const HERO_URL =
  "https://images.pexels.com/photos/23913606/pexels-photo-23913606.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const pos = usePosition();
  const defaultStart = new Date(routeData.default_start);
  const poiCount = routeData.pois.length;
  const lastPoi = [...(routeData.pois as any[])]
    .filter((p) => p.distance != null && p.distance < 1000)
    .pop();
  const totalDistance = lastPoi?.distance ?? routeData.total_distance_km;

  const [showSimModal, setShowSimModal] = useState(false);
  const [draftSimKm, setDraftSimKm] = useState<number>(pos.simulatedKm ?? 0);

  const openSimModal = () => {
    setDraftSimKm(pos.simulatedKm ?? Math.min(50, pos.routeLenKm));
    setShowSimModal(true);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
      testID="about-scroll"
    >
      <View style={styles.heroWrap}>
        <Image source={{ uri: HERO_URL }} style={styles.hero} contentFit="cover" />
        <LinearGradient
          colors={["rgba(18,18,18,0.0)", "rgba(18,18,18,0.6)", "rgba(18,18,18,1)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroOverlay, { paddingTop: insets.top + theme.spacing.lg }]}>
          <Text style={styles.heroEyebrow}>ULTRA ROUTE · GOTLAND</Text>
          <Text style={styles.heroTitle}>GOTLAND 511</Text>
          <Text style={styles.heroSub}>
            Self-supported circumnavigation of Sweden&apos;s largest island.
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <Stat label="DISTANCE" value={`${totalDistance}`} unit="km" />
        <Stat label="POIs" value={`${poiCount}`} unit="stops" />
        <Stat label="DEFAULT PACE" value={formatPace(routeData.default_pace_seconds_per_km)} unit="/km" />
      </View>

      {/* Position Test */}
      <Section title="POSITION TEST">
        <Text style={styles.body}>
          Hier kannst du eine virtuelle Position entlang der Route setzen. Damit testest
          du die Live-Funktionen (AHEAD-Filter, &quot;You are here&quot;-Marker, Map-Pin)
          ohne tatsächlich in Gotland zu sein.
        </Text>

        <View style={styles.simStatusCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.simStatusLabel}>SIMULATION</Text>
            <Text style={styles.simStatusValue}>
              {pos.simulatedKm != null ? `AKTIV · km ${pos.simulatedKm.toFixed(1)}` : "AUS"}
            </Text>
          </View>
          {pos.simulatedKm != null ? (
            <Pressable
              style={styles.simBtnGhost}
              onPress={() => pos.setSimulatedKm(null)}
              testID="sim-stop-button"
            >
              <Text style={styles.simBtnGhostText}>STOP</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.simBtnPrimary}
            onPress={openSimModal}
            testID="sim-open-button"
          >
            <Ionicons
              name="flask-outline"
              size={16}
              color={theme.color.onBrand}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.simBtnPrimaryText}>
              {pos.simulatedKm != null ? "ÄNDERN" : "POSITION TEST"}
            </Text>
          </Pressable>
        </View>

        {pos.gpsEnabled && pos.simulatedKm != null ? (
          <Text style={styles.bodyDim}>
            ⚠️ GPS ist parallel aktiv — solange die Simulation läuft, wird das echte
            GPS für die Positionsanzeige ignoriert.
          </Text>
        ) : null}
      </Section>

      <Section title="HOW IT WORKS">
        <Text style={styles.body}>
          Setze <Text style={styles.bold}>Start</Text> und{" "}
          <Text style={styles.bold}>Pace</Text> auf der Info-Seite. Ankunftszeiten für
          alle {poiCount} POIs werden live berechnet:
        </Text>
        <View style={styles.formulaBox}>
          <Text style={styles.formula}>arrival = start + (pace × distance)</Text>
        </View>
        <Text style={styles.bodyDim}>
          Standardstart{" "}
          <Text style={styles.bold}>
            {defaultStart.toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>{" "}
          · Standardpace{" "}
          <Text style={styles.bold}>
            {formatPace(routeData.default_pace_seconds_per_km)} min/km
          </Text>.
        </Text>
      </Section>

      <Section title="CATEGORIES">
        <View style={styles.legendList}>
          <Legend icon="restaurant-outline" label="Food, bakeries, cafés" />
          <Legend icon="bed-outline" label="Accommodation, camping" />
          <Legend icon="cart-outline" label="Grocery & farm shops" />
          <Legend icon="water-outline" label="Water refills" />
          <Legend icon="business-outline" label="Churches & shelters" />
          <Legend icon="shield-checkmark-outline" label="Angel Stations" />
          <Legend icon="compass-outline" label="Attractions & viewpoints" />
        </View>
      </Section>

      <Text style={styles.footer}>
        Source data: GOTLAND 511 — V02 (sheet GR-511-226){"\n"}
        Track: Gotland Run 2026 V03 · {(routeData as any).track_total_km ?? 0} km
      </Text>

      {/* Simulation Modal */}
      <Modal
        visible={showSimModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSimModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>POSITION TEST</Text>
            <Text style={styles.modalSub}>
              Wähle deine virtuelle Position entlang der Route.
            </Text>

            <View style={styles.simReadout}>
              <Text style={styles.simReadoutValue}>{draftSimKm.toFixed(1)}</Text>
              <Text style={styles.simReadoutUnit}>
                km · {((draftSimKm / pos.routeLenKm) * 100).toFixed(0)}%
              </Text>
            </View>

            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={pos.routeLenKm}
              step={0.5}
              value={draftSimKm}
              onValueChange={setDraftSimKm}
              minimumTrackTintColor={theme.color.brand}
              maximumTrackTintColor={theme.color.borderStrong}
              thumbTintColor={theme.color.brand}
              testID="sim-slider"
            />

            <View style={styles.simTicks}>
              <Text style={styles.simTickText}>0 km</Text>
              <Text style={styles.simTickText}>{pos.routeLenKm.toFixed(0)} km</Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalBtnPrimary}
                onPress={() => {
                  pos.setSimulatedKm(draftSimKm);
                  setShowSimModal(false);
                }}
                testID="sim-apply-button"
              >
                <Text style={styles.modalBtnPrimaryText}>APPLY</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtnGhost}
                onPress={() => setShowSimModal(false)}
                testID="sim-cancel-button"
              >
                <Text style={styles.modalBtnGhostText}>CANCEL</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={styles.statTileValue}>{value}</Text>
      <Text style={styles.statTileUnit}>{unit}</Text>
    </View>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Legend({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendIcon}>
        <Ionicons name={icon} size={14} color={theme.color.brand} />
      </View>
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  heroWrap: { height: 260, width: "100%", backgroundColor: theme.color.surfaceSecondary },
  hero: { ...StyleSheet.absoluteFillObject },
  heroOverlay: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: "flex-end",
    paddingBottom: theme.spacing.lg,
  },
  heroEyebrow: { color: theme.color.brand, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  heroTitle: {
    color: theme.color.onSurface,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 4,
  },
  heroSub: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 13,
    marginTop: 6,
    maxWidth: 320,
  },
  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  statTile: {
    flex: 1,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  statTileLabel: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  statTileValue: {
    color: theme.color.brand,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statTileUnit: { color: theme.color.onSurfaceSecondary, fontSize: 10, fontWeight: "600" },
  section: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl },
  sectionTitle: {
    color: theme.color.onSurface,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: theme.spacing.md,
  },
  body: { color: theme.color.onSurface, fontSize: 14, lineHeight: 21 },
  bodyDim: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: theme.spacing.sm,
  },
  bold: { fontWeight: "800", color: theme.color.brand },
  formulaBox: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.color.surfaceSecondary,
    borderLeftWidth: 3,
    borderLeftColor: theme.color.brand,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.sm,
  },
  formula: {
    color: theme.color.onSurface,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: theme.font.mono,
  },
  legendList: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  legendRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  legendIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  legendText: { color: theme.color.onSurface, fontSize: 13 },
  footer: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 10,
    textAlign: "center",
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    letterSpacing: 0.5,
    lineHeight: 14,
  },
  // Position test card
  simStatusCard: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  simStatusLabel: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  simStatusValue: {
    color: theme.color.onSurface,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  simBtnPrimary: {
    backgroundColor: theme.color.brand,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    alignItems: "center",
  },
  simBtnPrimaryText: {
    color: theme.color.onBrand,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  simBtnGhost: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
  },
  simBtnGhostText: {
    color: theme.color.onSurface,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  // Slider modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.color.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    width: "100%",
    maxWidth: 420,
  },
  modalTitle: {
    color: theme.color.onSurface,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  modalSub: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: theme.spacing.md,
  },
  simReadout: {
    alignItems: "center",
    marginVertical: theme.spacing.md,
  },
  simReadoutValue: {
    color: theme.color.brand,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  simReadoutUnit: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  slider: {
    width: "100%",
    height: 40,
    ...(Platform.OS === "android" ? {} : {}),
  },
  simTicks: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 2,
  },
  simTickText: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  modalActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  modalBtnPrimary: {
    flex: 1,
    backgroundColor: theme.color.brand,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  modalBtnPrimaryText: {
    color: theme.color.onBrand,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modalBtnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  modalBtnGhostText: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
});

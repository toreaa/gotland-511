import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  Platform,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";

import { theme, CATEGORY_BUCKETS, categoryIcon } from "@/src/theme";
import {
  arrivalAt,
  formatClock,
  formatDayLabel,
  formatPace,
} from "@/src/calc";
import { storage } from "@/src/utils/storage";
import { usePosition } from "@/src/PositionContext";
import routeData from "@/src/data/gotland.json";

type POI = {
  id: number;
  distance: number | null;
  off_route: boolean;
  name: string;
  category: string;
  open: string | null;
  note: string | null;
  url: string | null;
  lat: number | null;
  lon: number | null;
};

const DEFAULT_START = new Date(routeData.default_start).getTime();
const DEFAULT_PACE = routeData.default_pace_seconds_per_km;
const STORAGE_KEY_PACE = "gotland511.pace";
const STORAGE_KEY_START = "gotland511.startMs";
const STORAGE_KEY_AHEAD = "gotland511.aheadOnly";

// Synthetic list item type for the "YOU ARE HERE" marker injected into the FlatList.
type Row =
  | { kind: "poi"; poi: POI }
  | { kind: "here"; km: number };

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pos = usePosition();

  const [startMs, setStartMs] = useState<number>(DEFAULT_START);
  const [pace, setPace] = useState<number>(DEFAULT_PACE);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [activeBucket, setActiveBucket] = useState<string>("all");
  const [aheadOnly, setAheadOnly] = useState<boolean>(false);
  const [showStartPicker, setShowStartPicker] = useState<boolean>(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");
  const [showPacePicker, setShowPacePicker] = useState<boolean>(false);
  const [draftPaceMin, setDraftPaceMin] = useState<number>(Math.floor(DEFAULT_PACE / 60));
  const [draftPaceSec, setDraftPaceSec] = useState<number>(DEFAULT_PACE % 60);
  const listRef = useRef<FlatList<Row>>(null);
  // Re-render every 30s so the live-pace calculation reflects current time.
  const [nowTick, setNowTick] = useState<number>(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      const [savedPace, savedStart, savedAhead] = await Promise.all([
        storage.getItem<number>(STORAGE_KEY_PACE, DEFAULT_PACE),
        storage.getItem<number>(STORAGE_KEY_START, DEFAULT_START),
        storage.getItem<boolean>(STORAGE_KEY_AHEAD, false),
      ]);
      if (typeof savedPace === "number" && savedPace >= 60 && savedPace <= 60 * 60) {
        setPace(savedPace);
      }
      if (typeof savedStart === "number" && savedStart > 0) setStartMs(savedStart);
      if (typeof savedAhead === "boolean") setAheadOnly(savedAhead);
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEY_PACE, pace);
  }, [pace, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEY_START, startMs);
  }, [startMs, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    storage.setItem(STORAGE_KEY_AHEAD, aheadOnly);
  }, [aheadOnly, hydrated]);

  const pois = routeData.pois as POI[];

  const totalDistance = useMemo(() => {
    const last = [...pois]
      .filter((p) => p.distance != null && p.distance < 1000)
      .pop();
    return last?.distance ?? 0;
  }, [pois]);

  const filteredByCat = useMemo(() => {
    const bucket = CATEGORY_BUCKETS.find((b) => b.id === activeBucket);
    if (!bucket || bucket.id === "all") return pois;
    return pois.filter((p) => bucket.match(p.category || ""));
  }, [activeBucket, pois]);

  const currentKm = pos.currentKm;
  const haveCurrent = currentKm != null;

  // Auto-pace: when we have a known position AND meaningful progress AND the
  // start is in the past, derive pace from elapsed wall-clock time / km.
  // Otherwise fall back to the user-set pace.
  const elapsedSec = (nowTick - startMs) / 1000;
  const autoPaceSec =
    haveCurrent && currentKm! > 0.5 && elapsedSec > 60
      ? Math.round(elapsedSec / currentKm!)
      : null;
  const effectivePace = autoPaceSec ?? pace;
  const isLivePace = autoPaceSec != null;

  // Apply AHEAD filter only when we actually know where the user is.
  const filteredByAhead = useMemo(() => {
    if (!aheadOnly || currentKm == null) return filteredByCat;
    return filteredByCat.filter(
      (p) => p.distance != null && p.distance >= currentKm
    );
  }, [aheadOnly, currentKm, filteredByCat]);

  // Inject the "YOU ARE HERE" row at the correct position in the list.
  const rows: Row[] = useMemo(() => {
    const out: Row[] = filteredByAhead.map((p) => ({ kind: "poi" as const, poi: p }));
    if (currentKm != null) {
      // When AHEAD is on, the marker sits above the list. Otherwise it goes
      // between the last passed POI and the next upcoming POI.
      if (aheadOnly) {
        out.unshift({ kind: "here", km: currentKm });
      } else {
        let insertAt = out.length;
        for (let i = 0; i < out.length; i++) {
          const r = out[i];
          if (r.kind === "poi" && r.poi.distance != null && r.poi.distance >= currentKm) {
            insertAt = i;
            break;
          }
        }
        out.splice(insertAt, 0, { kind: "here", km: currentKm });
      }
    }
    return out;
  }, [filteredByAhead, currentKm, aheadOnly]);

  const finishArrival = arrivalAt(startMs, effectivePace, totalDistance);

  // DISTANCE block: when GPS/sim known → traveled + remaining; otherwise total.
  const traveledKm = haveCurrent ? currentKm! : 0;
  const remainingKm = Math.max(0, totalDistance - traveledKm);

  // When simulation is enabled but the user's start time is still in the
  // future (default Gotland race is in July 2026), live-pace would never
  // kick in — `now − startMs` would be negative. To make testing feel
  // natural, automatically backdate the start to "2 hours ago" the moment
  // simulation activates. The user can adjust it later via the date picker.
  const prevSimRef = useRef<number | null>(null);
  useEffect(() => {
    const wasSim = prevSimRef.current != null;
    const nowSim = pos.simulatedKm != null;
    if (nowSim && !wasSim && startMs > Date.now()) {
      setStartMs(Date.now() - 2 * 60 * 60 * 1000);
    }
    prevSimRef.current = pos.simulatedKm;
  }, [pos.simulatedKm, startMs]);

  // Auto-scroll to YOU-ARE-HERE when:
  //  • the user switches AHEAD on, or
  //  • the position becomes known while AHEAD is already on,
  //  • or any time the user toggles between ALL ↔ AHEAD with a known position.
  // This way they never have to manually scroll back from where they were.
  useEffect(() => {
    if (currentKm == null) return;
    const idx = rows.findIndex((r) => r.kind === "here");
    if (idx < 0) return;
    // Slight delay so the FlatList has rendered after the toggle.
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0,
      });
    }, 80);
    return () => clearTimeout(t);
  }, [aheadOnly, currentKm, rows]);

  const openPacePicker = () => {
    setDraftPaceMin(Math.floor(pace / 60));
    setDraftPaceSec(pace % 60);
    setShowPacePicker(true);
  };
  const commitPace = () => {
    const next = draftPaceMin * 60 + draftPaceSec;
    if (next >= 60 && next <= 60 * 60) setPace(next);
    setShowPacePicker(false);
  };

  const startDate = new Date(startMs);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sticky Header */}
      <View style={styles.header} testID="schedule-header">
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>GOTLAND 511</Text>
          <Pressable
            onPress={() => {
              setPickerMode("date");
              setShowStartPicker(true);
            }}
            hitSlop={10}
            testID="start-time-button"
          >
            <Text style={styles.headerStart} testID="start-time-value">
              {startDate
                .toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                .toUpperCase()
                .replace(/^(\d+)\s/, "$1. ")}
              {"   "}
              {formatClock(startDate)}
            </Text>
          </Pressable>
        </View>

        <View style={styles.inputsRow}>
          {/* Pace */}
          <Pressable
            style={styles.inputBlock}
            onPress={openPacePicker}
            testID="pace-button"
          >
            <Text style={styles.inputLabel}>
              PACE / KM {isLivePace ? "· LIVE" : ""}
            </Text>
            <Text style={styles.paceValue} testID="pace-value">
              {formatPace(effectivePace)}
            </Text>
            <Text style={styles.inputValueSm}>
              {isLivePace ? "based on position" : "min:sec"}
            </Text>
          </Pressable>

          {/* Distance — traveled + remaining */}
          <View style={styles.inputBlock} testID="distance-block">
            <Text style={styles.inputLabel}>DISTANCE</Text>
            <Text style={styles.inputValue} testID="distance-traveled">
              {traveledKm.toFixed(1)}
            </Text>
            <Text style={styles.distanceRemaining} testID="distance-remaining">
              ↓ {remainingKm.toFixed(1)} km left
            </Text>
          </View>

          {/* Finish */}
          <View style={styles.inputBlock} testID="finish-block">
            <Text style={styles.inputLabel}>FINISH</Text>
            <Text style={styles.finishDay} testID="finish-day">
              {formatDayLabel(finishArrival)}
            </Text>
            <Text style={styles.finishDate} testID="finish-date">
              {finishArrival
                .toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })
                .replace(/\//g, ".")}
            </Text>
            <Text style={styles.finishTime} testID="schedule-finish-time">
              {formatClock(finishArrival)}
            </Text>
          </View>
        </View>

        {/* Filter row: category chips + AHEAD/ALL toggle */}
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipRowContent}
          >
            {CATEGORY_BUCKETS.map((b) => {
              const active = b.id === activeBucket;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setActiveBucket(b.id)}
                  style={[styles.chip, active && styles.chipActive]}
                  testID={`category-chip-${b.id}`}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {b.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => setAheadOnly((v) => !v)}
            style={[
              styles.aheadToggle,
              aheadOnly && styles.aheadToggleActive,
              !haveCurrent && styles.aheadToggleDisabled,
            ]}
            testID="ahead-toggle"
            disabled={!haveCurrent && !aheadOnly}
          >
            <Ionicons
              name={aheadOnly ? "navigate" : "list"}
              size={13}
              color={
                aheadOnly
                  ? theme.color.brand
                  : haveCurrent
                  ? theme.color.onSurface
                  : theme.color.onSurfaceSecondary
              }
            />
            <Text
              style={[
                styles.aheadToggleText,
                aheadOnly && { color: theme.color.brand },
              ]}
            >
              {aheadOnly ? "AHEAD" : "ALL"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* List */}
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) =>
          r.kind === "here" ? "here" : `poi-${r.poi.id}`
        }
        onScrollToIndexFailed={(info) => {
          // Fallback: estimate offset and try again after the list lays out.
          const offset = info.averageItemLength * info.index;
          listRef.current?.scrollToOffset({ offset, animated: true });
        }}
        renderItem={({ item }) => {
          if (item.kind === "here") {
            return <YouAreHereRow km={item.km} routeLenKm={totalDistance} />;
          }
          return (
            <PoiRow
              item={item.poi}
              startMs={startMs}
              pace={effectivePace}
              currentKm={currentKm}
              onPress={() => {
                if (item.poi.lat != null && item.poi.lon != null) {
                  router.push({
                    pathname: "/map",
                    params: { poiId: String(item.poi.id) },
                  });
                }
              }}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {aheadOnly && currentKm != null
                ? "Du hast alle POIs hinter dir. 🎉"
                : "No POIs in this category."}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
        testID="poi-list"
      />

      {/* Pace Picker */}
      {showPacePicker && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowPacePicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>PACE PER KILOMETRE</Text>
              <View style={styles.pacePickerRow}>
                <View style={styles.pacePickerCol}>
                  <Picker
                    selectedValue={draftPaceMin}
                    onValueChange={(v) => setDraftPaceMin(Number(v))}
                    itemStyle={styles.pickerItem}
                    style={styles.pickerNative}
                    dropdownIconColor={theme.color.onSurface}
                    testID="pace-min-picker"
                  >
                    {Array.from({ length: 31 }).map((_, i) => (
                      <Picker.Item
                        key={i}
                        label={String(i).padStart(2, "0")}
                        value={i}
                        color={theme.color.onSurface}
                      />
                    ))}
                  </Picker>
                  <Text style={styles.pacePickerUnit}>min</Text>
                </View>
                <Text style={styles.pacePickerColon}>:</Text>
                <View style={styles.pacePickerCol}>
                  <Picker
                    selectedValue={draftPaceSec}
                    onValueChange={(v) => setDraftPaceSec(Number(v))}
                    itemStyle={styles.pickerItem}
                    style={styles.pickerNative}
                    dropdownIconColor={theme.color.onSurface}
                    testID="pace-sec-picker"
                  >
                    {Array.from({ length: 60 }).map((_, i) => (
                      <Picker.Item
                        key={i}
                        label={String(i).padStart(2, "0")}
                        value={i}
                        color={theme.color.onSurface}
                      />
                    ))}
                  </Picker>
                  <Text style={styles.pacePickerUnit}>sec</Text>
                </View>
              </View>
              <View style={styles.modalActions}>
                <Pressable style={styles.modalBtnPrimary} onPress={commitPace} testID="pace-done-button">
                  <Text style={styles.modalBtnPrimaryText}>DONE</Text>
                </Pressable>
                <Pressable style={styles.modalBtnGhost} onPress={() => setShowPacePicker(false)} testID="pace-cancel-button">
                  <Text style={styles.modalBtnGhostText}>CANCEL</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Date/Time Picker */}
      {showStartPicker && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowStartPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {pickerMode === "date" ? "START DATE" : "START TIME"}
              </Text>
              <DateTimePicker
                value={startDate}
                mode={pickerMode}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                themeVariant="dark"
                textColor={theme.color.onSurface}
                onChange={(_, selected) => {
                  if (selected) setStartMs(selected.getTime());
                  if (Platform.OS !== "ios") setShowStartPicker(false);
                }}
              />
              <View style={styles.modalActions}>
                {pickerMode === "date" ? (
                  <Pressable style={styles.modalBtnPrimary} onPress={() => setPickerMode("time")} testID="picker-next-button">
                    <Text style={styles.modalBtnPrimaryText}>NEXT: TIME</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.modalBtnPrimary} onPress={() => setShowStartPicker(false)} testID="picker-done-button">
                    <Text style={styles.modalBtnPrimaryText}>DONE</Text>
                  </Pressable>
                )}
                <Pressable style={styles.modalBtnGhost} onPress={() => setShowStartPicker(false)} testID="picker-cancel-button">
                  <Text style={styles.modalBtnGhostText}>CANCEL</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function YouAreHereRow({ km, routeLenKm }: { km: number; routeLenKm: number }) {
  const pct = routeLenKm > 0 ? Math.min(100, (km / routeLenKm) * 100) : 0;
  return (
    <View style={styles.hereRow} testID="you-are-here-row">
      <View style={styles.hereLeft}>
        <Ionicons name="locate" size={18} color={theme.color.brand} />
      </View>
      <View style={styles.hereCenter}>
        <Text style={styles.hereTitle}>YOU ARE HERE</Text>
        <View style={styles.hereBarTrack}>
          <View style={[styles.hereBarFill, { width: `${pct}%` }]} />
        </View>
      </View>
      <View style={styles.hereRight}>
        <Text style={styles.hereKm}>{km.toFixed(1)}</Text>
        <Text style={styles.hereUnit}>km · {pct.toFixed(0)}%</Text>
      </View>
    </View>
  );
}

function PoiRowImpl({
  item,
  startMs,
  pace,
  currentKm,
  onPress,
}: {
  item: POI;
  startMs: number;
  pace: number;
  currentKm: number | null;
  onPress?: () => void;
}) {
  const dist = item.distance ?? 0;
  const arrival = arrivalAt(startMs, pace, dist);
  const isAngel = /angel|protection and energy/i.test(item.category || "");
  const hasCoords = item.lat != null && item.lon != null;
  const distanceTo =
    currentKm != null && item.distance != null
      ? item.distance - currentKm
      : null;
  // distanceTo > 0 → ahead; <= 0 → behind
  const showDistanceTo = distanceTo != null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!hasCoords}
      android_ripple={{ color: theme.color.surfaceTertiary }}
      style={({ pressed }) => [
        styles.row,
        isAngel && styles.rowAngel,
        pressed && hasCoords && styles.rowPressed,
      ]}
      testID={`poi-row-${item.id}`}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.rowDistance} numberOfLines={1} adjustsFontSizeToFit>
          {dist.toFixed(1)}
        </Text>
        <Text style={styles.rowDistanceUnit}>km</Text>
      </View>

      <View style={styles.rowCenter}>
        <View style={styles.rowNameLine}>
          <Ionicons
            name={categoryIcon(item.category) as any}
            size={14}
            color={isAngel ? theme.color.brand : theme.color.onSurfaceSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.rowName} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <View style={styles.rowMetaLine}>
          <Text style={styles.rowCategory} numberOfLines={1}>
            {item.category}
          </Text>
          {item.off_route && (
            <View style={styles.offRouteBadge} testID={`off-route-${item.id}`}>
              <Text style={styles.offRouteText}>OFF-ROUTE</Text>
            </View>
          )}
        </View>
        {item.open ? (
          <Text style={styles.rowOpen} numberOfLines={1}>
            <Ionicons name="time-outline" size={11} color={theme.color.onSurfaceSecondary} />{" "}
            {item.open.replace(/\n/g, " · ")}
          </Text>
        ) : null}
      </View>

      <View style={styles.rowRight}>
        <Text
          style={styles.rowArrival}
          numberOfLines={1}
          adjustsFontSizeToFit
          testID={`poi-arrival-${item.id}`}
        >
          {formatClock(arrival)}
        </Text>
        <Text style={styles.rowDay}>{formatDayLabel(arrival)}</Text>
        {showDistanceTo && (
          <Text
            style={[
              styles.rowDistanceTo,
              distanceTo! < 0 && styles.rowDistanceToPast,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            testID={`poi-distance-to-${item.id}`}
          >
            {distanceTo! >= 0
              ? `${distanceTo!.toFixed(1)} km`
              : `−${Math.abs(distanceTo!).toFixed(1)} km`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
const PoiRow = React.memo(PoiRowImpl);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.surface },
  header: {
    backgroundColor: theme.color.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    paddingTop: theme.spacing.sm,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  headerTitle: {
    color: theme.color.onSurface,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2,
  },
  headerStart: {
    color: theme.color.onSurface,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  inputsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  inputBlock: {
    flex: 1,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 64,
  },
  inputLabel: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  inputValue: {
    color: theme.color.onSurface,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  inputValueSm: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  distanceRemaining: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  paceValue: {
    color: theme.color.brand,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  finishDay: {
    color: theme.color.brand,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
  },
  finishDate: {
    color: theme.color.brand,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 1,
  },
  finishTime: {
    color: theme.color.brand,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: theme.spacing.lg,
  },
  chipRow: {
    maxHeight: 56,
    flex: 1,
  },
  chipRowContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: "center",
  },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: theme.color.brandSecondary,
    borderColor: theme.color.brand,
  },
  chipText: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  chipTextActive: { color: theme.color.brand },
  // Ahead/All toggle
  aheadToggle: {
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  aheadToggleActive: {
    backgroundColor: theme.color.brandSecondary,
    borderColor: theme.color.brand,
  },
  aheadToggleDisabled: { opacity: 0.4 },
  aheadToggleText: {
    color: theme.color.onSurface,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  // POI rows
  row: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.color.surface,
    alignItems: "flex-start",
  },
  rowAngel: { backgroundColor: theme.color.brandTertiary || "#261612" },
  rowPressed: { backgroundColor: theme.color.surfaceSecondary },
  rowLeft: {
    width: 74,
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingTop: 2,
    paddingRight: theme.spacing.xs,
  },
  rowDistance: {
    color: theme.color.onSurface,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  rowDistanceUnit: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 10,
    fontWeight: "600",
    marginTop: -2,
  },
  rowCenter: { flex: 1, paddingRight: theme.spacing.sm },
  rowNameLine: { flexDirection: "row", alignItems: "center" },
  rowName: {
    color: theme.color.onSurface,
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  rowMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: theme.spacing.sm,
  },
  rowCategory: { color: theme.color.onSurfaceSecondary, fontSize: 12, flexShrink: 1 },
  offRouteBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#3A1E16",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.brand,
  },
  offRouteText: {
    color: theme.color.brand,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  rowOpen: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 3 },
  rowRight: {
    width: 84,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  rowArrival: {
    color: theme.color.brand,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  rowDay: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 1,
  },
  rowDistanceTo: {
    color: theme.color.brand,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  rowDistanceToPast: {
    color: theme.color.onSurfaceSecondary,
    fontWeight: "700",
  },
  rowDivider: {
    height: 1,
    backgroundColor: theme.color.border,
    marginHorizontal: theme.spacing.lg,
  },
  // YOU ARE HERE row
  hereRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.color.brandSecondary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.brand,
    alignItems: "center",
  },
  hereLeft: { width: 32, alignItems: "center" },
  hereCenter: { flex: 1, paddingRight: theme.spacing.md },
  hereTitle: {
    color: theme.color.brand,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 4,
  },
  hereBarTrack: {
    height: 4,
    backgroundColor: "rgba(229,91,60,0.25)",
    borderRadius: 2,
    overflow: "hidden",
  },
  hereBarFill: { height: 4, backgroundColor: theme.color.brand },
  hereRight: { alignItems: "flex-end", minWidth: 84 },
  hereKm: {
    color: theme.color.brand,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  hereUnit: {
    color: theme.color.brand,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  empty: { paddingVertical: theme.spacing.xxl, alignItems: "center" },
  emptyText: { color: theme.color.onSurfaceSecondary, fontSize: 14 },
  // Modals
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
    maxWidth: 380,
  },
  modalTitle: {
    color: theme.color.onSurface,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: theme.spacing.md,
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
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
  pacePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
  },
  pacePickerCol: { flex: 1, alignItems: "center" },
  pickerNative: Platform.select({
    ios: { width: "100%", height: 180 },
    android: {
      width: "100%",
      height: 50,
      color: theme.color.onSurface,
      backgroundColor: theme.color.surface,
    },
    default: { width: "100%", height: 50 },
  }) as any,
  pickerItem: {
    color: theme.color.onSurface,
    fontSize: 22,
    fontWeight: "800",
    height: 180,
  },
  pacePickerColon: {
    color: theme.color.brand,
    fontSize: 32,
    fontWeight: "800",
    marginHorizontal: theme.spacing.sm,
  },
  pacePickerUnit: {
    color: theme.color.onSurfaceSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 4,
  },
});

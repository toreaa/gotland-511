import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { PositionProvider } from "@/src/PositionContext";

export default function TabsLayout() {
  return (
    <PositionProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.color.brand,
          tabBarInactiveTintColor: theme.color.onSurfaceSecondary,
          tabBarStyle: {
            backgroundColor: theme.color.surfaceSecondary,
            borderTopColor: theme.color.border,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Info",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list-outline" size={size} color={color} />
            ),
            tabBarTestID: "tab-schedule",
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: "Map",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map-outline" size={size} color={color} />
            ),
            tabBarTestID: "tab-map",
          }}
        />
        <Tabs.Screen
          name="about"
          options={{
            title: "About",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="information-circle-outline" size={size} color={color} />
            ),
            tabBarTestID: "tab-about",
          }}
        />
      </Tabs>
    </PositionProvider>
  );
}

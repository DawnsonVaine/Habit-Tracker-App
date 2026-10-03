import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { ColorValue, StyleSheet, Text } from 'react-native';
import { font, useTheme } from '../../hooks/useTheme';

interface TabIconProps {
  /** SF Symbol shown when the tab isn't selected; the ".fill" variant is used when it is. */
  symbol: SFSymbol;
  focused: boolean;
  color: ColorValue;
  /** Shown if SF Symbols aren't available, which on iOS shouldn't happen. */
  fallback: string;
}

function TabIcon({ symbol, focused, color, fallback }: TabIconProps) {
  return (
    <SymbolView
      name={(focused ? `${symbol}.fill` : symbol) as SFSymbol}
      tintColor={color}
      size={24}
      fallback={<Text style={{ fontSize: 21, opacity: focused ? 1 : 0.45 }}>{fallback}</Text>}
    />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        // Each tab draws its own large title, so the bar header would duplicate it.
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: { ...font.micro },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.subtext,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon symbol="checkmark.circle" focused={focused} color={color} fallback="✅" />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon symbol="chart.bar" focused={focused} color={color} fallback="📊" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon symbol="gearshape" focused={focused} color={color} fallback="⚙️" />
          ),
        }}
      />
    </Tabs>
  );
}

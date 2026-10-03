import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, space, useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { exportBackup, importBackup } from '../../utils/backup';
import { cancelAllReminders, resetAllReminders } from '../../utils/notifications';

function SettingsRow({
  title,
  subtitle,
  onPress,
  isLast,
  colors,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  isLast?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.rowSubtitle, { color: colors.subtext }]}>{subtitle}</Text>}
      </View>
      <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, card } = useTheme();
  const insets = useSafeAreaInsets();
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const skips = useHabitStore((s) => s.skips);
  const challenges = useHabitStore((s) => s.challenges);
  const categories = useHabitStore((s) => s.categories);
  const replaceAllData = useHabitStore((s) => s.replaceAllData);
  const clearAllData = useHabitStore((s) => s.clearAllData);
  const setNotificationId = useHabitStore((s) => s.setNotificationId);
  const [busy, setBusy] = useState(false);

  function applyReminderUpdates(updates: Map<string, string | null>) {
    updates.forEach((notificationId, habitId) => setNotificationId(habitId, notificationId));
  }

  const archivedHabits = useMemo(() => habits.filter((h) => h.archived), [habits]);

  async function handleExport() {
    try {
      setBusy(true);
      await exportBackup(habits, completions, skips, challenges, categories);
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    try {
      setBusy(true);
      const data = await importBackup();
      if (!data) return;
      Alert.alert(
        'Restore backup',
        'This will replace all current habits and history with the backup file. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              replaceAllData(data);
              // The habits just replaced had their own reminders scheduled, and
              // the restored ones carry ids from whichever device exported them.
              applyReminderUpdates(await resetAllReminders(data.habits));
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Import failed', 'That file could not be read as a valid backup.');
    } finally {
      setBusy(false);
    }
  }

  function handleClearData() {
    Alert.alert(
      'Delete all data',
      'This will permanently delete every habit and all history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            // Without this the reminders outlive the habits and keep firing.
            await cancelAllReminders();
            clearAllData();
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Appearance</Text>
      <View style={[styles.card, card]}>
        <Text style={[styles.cardText, { color: colors.text }]}>
          Follows your iPhone's light and dark mode setting automatically.
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Backup</Text>
      <View style={[styles.card, card]}>
        <SettingsRow
          title="Export Backup"
          subtitle="Save all habits & history as a JSON file"
          onPress={handleExport}
          colors={colors}
        />
        <SettingsRow
          title="Restore Backup"
          subtitle="Load habits & history from a JSON file"
          onPress={handleImport}
          isLast
          colors={colors}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Habits</Text>
      <View style={[styles.card, card]}>
        <SettingsRow
          title="Categories"
          subtitle={
            categories.length > 0
              ? `${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`
              : 'Group habits into sections on Today'
          }
          onPress={() => router.push('/categories')}
          colors={colors}
        />
        <SettingsRow
          title="Archived Habits"
          subtitle={archivedHabits.length > 0 ? `${archivedHabits.length} archived` : 'No archived habits'}
          onPress={() => router.push('/archive')}
          isLast
          colors={colors}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Data</Text>
      <View style={[styles.card, card]}>
        <Pressable
          onPress={handleClearData}
          style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}
        >
          <Text style={[styles.rowTitle, { color: colors.danger }]}>Delete All Data</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>About</Text>
      <View style={[styles.card, card]}>
        <Text style={[styles.cardText, { color: colors.text }]}>
          All your data is stored only on this device. There is no account, no cloud sync, and no tracking.
        </Text>
      </View>

      {busy && <Text style={[styles.busy, { color: colors.subtext }]}>Working…</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingBottom: 60 },
  title: { ...font.largeTitle, marginBottom: space.xl },
  sectionTitle: { ...font.label, marginBottom: space.sm, marginLeft: space.xs },
  // No overflow: 'hidden' here: on iOS it would clip the card's shadow.
  card: {
    borderRadius: radius.lg,
    marginBottom: space.xl + 4,
    paddingHorizontal: space.lg,
  },
  cardText: { ...font.body, lineHeight: 21, paddingVertical: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md + 2,
  },
  rowTitle: { ...font.headline },
  rowSubtitle: { ...font.caption, marginTop: 2 },
  chevron: { fontSize: 22, marginLeft: space.sm },
  pressed: { opacity: 0.6 },
  dangerRow: { paddingVertical: space.md + 2, alignItems: 'center' },
  busy: { ...font.caption, textAlign: 'center', marginTop: space.sm },
});

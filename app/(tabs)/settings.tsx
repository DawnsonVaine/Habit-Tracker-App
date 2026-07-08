import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { exportBackup, importBackup } from '../../utils/backup';

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
    <Pressable onPress={onPress} style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {subtitle && <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <Text style={{ color: colors.subtext, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const habits = useHabitStore((s) => s.habits);
  const completions = useHabitStore((s) => s.completions);
  const replaceAllData = useHabitStore((s) => s.replaceAllData);
  const clearAllData = useHabitStore((s) => s.clearAllData);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    try {
      setBusy(true);
      await exportBackup(habits, completions);
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
            onPress: () => replaceAllData(data.habits, data.completions),
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
        { text: 'Delete Everything', style: 'destructive', onPress: () => clearAllData() },
      ]
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>APPEARANCE</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: 15 }}>
          Follows your iPhone's system Light/Dark mode setting automatically.
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>BACKUP</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>DATA</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable onPress={handleClearData} style={styles.dangerRow}>
          <Text style={{ color: colors.danger, fontSize: 16, fontWeight: '600' }}>Delete All Data</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>ABOUT</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: 15 }}>
          All your data is stored only on this device. There is no account, no cloud sync, and no tracking.
        </Text>
      </View>

      {busy && <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 10 }}>Working…</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 20,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dangerRow: { paddingVertical: 14, alignItems: 'center' },
});

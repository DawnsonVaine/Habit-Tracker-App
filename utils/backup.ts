import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CompletionsMap, Habit, HabitProgress } from '../types/habit';

const BACKUP_VERSION = 2;

interface BackupPayload {
  version: number;
  exportedAt: string;
  habits: Habit[];
  completions: CompletionsMap;
}

/** Version 1 backups predate goal types and stored completions as date arrays. */
interface LegacyBackupPayload {
  version: number;
  habits: (Partial<Habit> & { id: string })[];
  completions: Record<string, string[] | HabitProgress>;
}

function upgradePayload(payload: LegacyBackupPayload): { habits: Habit[]; completions: CompletionsMap } {
  const habits = payload.habits.map(
    (habit) => ({ goalType: 'binary', target: 1, unit: null, step: 1, ...habit }) as Habit
  );
  const completions: CompletionsMap = {};
  for (const [habitId, entry] of Object.entries(payload.completions)) {
    completions[habitId] = Array.isArray(entry)
      ? Object.fromEntries(entry.map((dateStr) => [dateStr, 1]))
      : entry;
  }
  return { habits, completions };
}

const BACKUP_FILENAME = 'habit-tracker-backup.json';

export async function exportBackup(habits: Habit[], completions: CompletionsMap): Promise<void> {
  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    habits,
    completions,
  };

  const fileUri = `${FileSystem.cacheDirectory}${BACKUP_FILENAME}`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export Habit Tracker Backup' });
  }
}

export async function importBackup(): Promise<{ habits: Habit[]; completions: CompletionsMap } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;

  const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
  const payload = JSON.parse(content) as LegacyBackupPayload;

  if (!payload.habits || !payload.completions) {
    throw new Error('Invalid backup file');
  }

  // Older exports are upgraded on the way in, so backups taken before goal
  // types existed still restore correctly.
  return upgradePayload(payload);
}

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Category, Challenge, CompletionsMap, Habit, HabitProgress, SkipsMap } from '../types/habit';

const BACKUP_VERSION = 5;

interface BackupPayload {
  version: number;
  exportedAt: string;
  habits: Habit[];
  completions: CompletionsMap;
  skips: SkipsMap;
  challenges: Challenge[];
  categories: Category[];
}

export interface BackupData {
  habits: Habit[];
  completions: CompletionsMap;
  skips: SkipsMap;
  challenges: Challenge[];
  categories: Category[];
}

/**
 * Any backup version, oldest first: v1 predates goal types and stored
 * completions as date arrays, v1-v2 predate rest days, v1-v3 predate
 * challenges, and v1-v4 predate categories.
 */
interface LegacyBackupPayload {
  version: number;
  habits: (Partial<Habit> & { id: string })[];
  completions: Record<string, string[] | HabitProgress>;
  skips?: SkipsMap;
  challenges?: Challenge[];
  categories?: Category[];
}

function upgradePayload(payload: LegacyBackupPayload): BackupData {
  const habits = payload.habits.map(
    (habit) => ({ goalType: 'binary', target: 1, unit: null, step: 1, categoryId: null, ...habit }) as Habit
  );
  const completions: CompletionsMap = {};
  for (const [habitId, entry] of Object.entries(payload.completions)) {
    completions[habitId] = Array.isArray(entry)
      ? Object.fromEntries(entry.map((dateStr) => [dateStr, 1]))
      : entry;
  }
  // Older backups simply had no rest days, challenges or categories.
  return {
    habits,
    completions,
    skips: payload.skips ?? {},
    challenges: payload.challenges ?? [],
    categories: payload.categories ?? [],
  };
}

const BACKUP_FILENAME = 'habit-tracker-backup.json';

export async function exportBackup(
  habits: Habit[],
  completions: CompletionsMap,
  skips: SkipsMap,
  challenges: Challenge[],
  categories: Category[]
): Promise<void> {
  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    habits,
    completions,
    skips,
    challenges,
    categories,
  };

  const file = new File(Paths.cache, BACKUP_FILENAME);
  // create() throws if the file is already there from a previous export.
  file.create({ overwrite: true });
  file.write(JSON.stringify(payload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export Habit Tracker Backup' });
  }
}

export async function importBackup(): Promise<BackupData | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;

  const content = await new File(result.assets[0].uri).text();
  const payload = JSON.parse(content) as LegacyBackupPayload;

  if (!payload.habits || !payload.completions) {
    throw new Error('Invalid backup file');
  }

  // Older exports are upgraded on the way in, so backups taken before goal
  // types or rest days existed still restore correctly.
  return upgradePayload(payload);
}

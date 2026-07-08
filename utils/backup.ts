import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CompletionsMap, Habit } from '../types/habit';

interface BackupPayload {
  version: 1;
  exportedAt: string;
  habits: Habit[];
  completions: CompletionsMap;
}

const BACKUP_FILENAME = 'habit-tracker-backup.json';

export async function exportBackup(habits: Habit[], completions: CompletionsMap): Promise<void> {
  const payload: BackupPayload = {
    version: 1,
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
  const payload = JSON.parse(content) as BackupPayload;

  if (!payload.habits || !payload.completions) {
    throw new Error('Invalid backup file');
  }

  return { habits: payload.habits, completions: payload.completions };
}

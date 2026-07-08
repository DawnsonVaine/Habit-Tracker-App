import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { HABIT_COLORS, HABIT_EMOJIS, WEEKDAY_SHORT } from '../../constants/habitOptions';
import { useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { Frequency, NewHabitInput } from '../../types/habit';
import { cancelHabitReminder, scheduleHabitReminder } from '../../utils/notifications';

type FrequencyKind = 'daily' | 'weekdays' | 'timesPerWeek';

export default function NewHabitScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const habits = useHabitStore((s) => s.habits);
  const addHabit = useHabitStore((s) => s.addHabit);
  const updateHabit = useHabitStore((s) => s.updateHabit);
  const deleteHabit = useHabitStore((s) => s.deleteHabit);
  const setNotificationId = useHabitStore((s) => s.setNotificationId);
  const setArchived = useHabitStore((s) => s.setArchived);

  const existing = useMemo(() => habits.find((h) => h.id === id), [habits, id]);

  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? HABIT_EMOJIS[0]);
  const [color, setColor] = useState(existing?.color ?? HABIT_COLORS[0]);
  const [frequencyKind, setFrequencyKind] = useState<FrequencyKind>(existing?.frequency.type ?? 'daily');
  const [selectedDays, setSelectedDays] = useState<number[]>(
    existing?.frequency.type === 'weekdays' ? existing.frequency.days : [1, 2, 3, 4, 5]
  );
  const [timesPerWeek, setTimesPerWeek] = useState(
    existing?.frequency.type === 'timesPerWeek' ? existing.frequency.count : 3
  );
  const [reminderEnabled, setReminderEnabled] = useState(!!existing?.reminderTime);
  const [reminderTime, setReminderTime] = useState<Date>(() => {
    const date = new Date();
    if (existing?.reminderTime) {
      const [h, m] = existing.reminderTime.split(':').map(Number);
      date.setHours(h, m, 0, 0);
    } else {
      date.setHours(9, 0, 0, 0);
    }
    return date;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please give your habit a name.');
      return;
    }
    if (frequencyKind === 'weekdays' && selectedDays.length === 0) {
      Alert.alert('Pick at least one day', 'Select which days this habit is due.');
      return;
    }

    let frequency: Frequency;
    if (frequencyKind === 'daily') frequency = { type: 'daily' };
    else if (frequencyKind === 'weekdays') frequency = { type: 'weekdays', days: selectedDays };
    else frequency = { type: 'timesPerWeek', count: timesPerWeek };

    const reminderTimeStr = reminderEnabled
      ? `${String(reminderTime.getHours()).padStart(2, '0')}:${String(reminderTime.getMinutes()).padStart(2, '0')}`
      : null;

    const input: NewHabitInput = {
      name: trimmedName,
      emoji,
      color,
      frequency,
      reminderTime: reminderTimeStr,
    };

    if (isEditing && existing) {
      updateHabit(existing.id, input);
      if (reminderTimeStr) {
        const notifId = await scheduleHabitReminder(
          { id: existing.id, name: trimmedName, emoji },
          reminderTimeStr,
          existing.notificationId
        );
        setNotificationId(existing.id, notifId);
      } else if (existing.notificationId) {
        await cancelHabitReminder(existing.notificationId);
        setNotificationId(existing.id, null);
      }
    } else {
      const habit = addHabit(input);
      if (reminderTimeStr) {
        const notifId = await scheduleHabitReminder(
          { id: habit.id, name: trimmedName, emoji },
          reminderTimeStr,
          null
        );
        setNotificationId(habit.id, notifId);
      }
    }

    router.back();
  }

  async function handleArchiveToggle() {
    if (!existing) return;
    const nextArchived = !existing.archived;

    if (nextArchived) {
      if (existing.notificationId) {
        await cancelHabitReminder(existing.notificationId);
        setNotificationId(existing.id, null);
      }
    } else if (existing.reminderTime) {
      const notifId = await scheduleHabitReminder(
        { id: existing.id, name: existing.name, emoji: existing.emoji },
        existing.reminderTime,
        null
      );
      setNotificationId(existing.id, notifId);
    }

    setArchived(existing.id, nextArchived);
    router.back();
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert('Delete habit', `Are you sure you want to delete "${existing.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelHabitReminder(existing.notificationId);
          deleteHabit(existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.label, { color: colors.subtext }]}>NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Drink water"
        placeholderTextColor={colors.subtext}
        style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
      />

      <Text style={[styles.label, { color: colors.subtext }]}>ICON</Text>
      <View style={styles.grid}>
        {HABIT_EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => setEmoji(e)}
            style={[
              styles.emojiOption,
              { borderColor: e === emoji ? color : colors.border, backgroundColor: colors.card },
            ]}
          >
            <Text style={styles.emojiText}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.subtext }]}>COLOR</Text>
      <View style={styles.grid}>
        {HABIT_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.colorOption,
              { backgroundColor: c, borderWidth: c === color ? 3 : 0, borderColor: colors.text },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.label, { color: colors.subtext }]}>FREQUENCY</Text>
      <View style={styles.segmented}>
        {(['daily', 'weekdays', 'timesPerWeek'] as FrequencyKind[]).map((kind) => (
          <Pressable
            key={kind}
            onPress={() => setFrequencyKind(kind)}
            style={[
              styles.segment,
              {
                backgroundColor: frequencyKind === kind ? color : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={{ color: frequencyKind === kind ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
              {kind === 'daily' ? 'Daily' : kind === 'weekdays' ? 'Specific Days' : 'X / Week'}
            </Text>
          </Pressable>
        ))}
      </View>

      {frequencyKind === 'weekdays' && (
        <View style={styles.weekdayRow}>
          {WEEKDAY_SHORT.map((label, idx) => (
            <Pressable
              key={label}
              onPress={() => toggleDay(idx)}
              style={[
                styles.weekdayPill,
                {
                  backgroundColor: selectedDays.includes(idx) ? color : colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: selectedDays.includes(idx) ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>
                {label[0]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {frequencyKind === 'timesPerWeek' && (
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => setTimesPerWeek((n) => Math.max(1, n - 1))}
            style={[styles.stepperButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.stepperText, { color: colors.text }]}>−</Text>
          </Pressable>
          <Text style={[styles.stepperValue, { color: colors.text }]}>{timesPerWeek}x per week</Text>
          <Pressable
            onPress={() => setTimesPerWeek((n) => Math.min(7, n + 1))}
            style={[styles.stepperButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.stepperText, { color: colors.text }]}>+</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.reminderRow, { borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.subtext, marginTop: 0 }]}>REMINDER</Text>
        <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
      </View>

      {reminderEnabled && (
        <Pressable
          onPress={() => setShowTimePicker(true)}
          style={[styles.timeButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={{ color: colors.text, fontSize: 16 }}>
            {reminderTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </Pressable>
      )}

      {showTimePicker && (
        <DateTimePicker
          value={reminderTime}
          mode="time"
          display="spinner"
          onChange={(_, date) => {
            setShowTimePicker(false);
            if (date) setReminderTime(date);
          }}
        />
      )}

      <Pressable style={[styles.saveButton, { backgroundColor: color }]} onPress={handleSave}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Create Habit'}</Text>
      </Pressable>

      {isEditing && (
        <Pressable style={[styles.archiveButton, { borderColor: colors.border }]} onPress={handleArchiveToggle}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {existing?.archived ? 'Unarchive Habit' : 'Archive Habit'}
          </Text>
        </Pressable>
      )}

      {isEditing && (
        <Pressable style={[styles.deleteButton, { borderColor: colors.danger }]} onPress={handleDelete}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete Habit</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiOption: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 22 },
  colorOption: { width: 36, height: 36, borderRadius: 18 },
  segmented: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  weekdayRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  weekdayPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 12 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { fontSize: 20, fontWeight: '600' },
  stepperValue: { fontSize: 16, fontWeight: '600', minWidth: 110, textAlign: 'center' },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  timeButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButton: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  archiveButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
});

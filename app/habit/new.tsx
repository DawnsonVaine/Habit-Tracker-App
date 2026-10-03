import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { HABIT_COLORS, HABIT_EMOJIS, WEEKDAY_SHORT } from '../../constants/habitOptions';
import { font, radius, space, useTheme } from '../../hooks/useTheme';
import { useHabitStore } from '../../store/habitStore';
import { Frequency, GoalType, NewHabitInput } from '../../types/habit';
import {
  cancelHabitReminder,
  ensureNotificationPermission,
  getNotificationPermissionStatus,
  scheduleHabitReminder,
} from '../../utils/notifications';

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
  const categories = useHabitStore((s) => s.categories);
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);

  // After "+ New" opens the category editor, select whatever category appears
  // when the user comes back, so they don't have to find and tap it.
  const awaitingNewCategory = useRef<Set<string> | null>(null);
  useEffect(() => {
    const before = awaitingNewCategory.current;
    if (!before) return;
    const created = categories.find((c) => !before.has(c.id));
    if (created) {
      setCategoryId(created.id);
      awaitingNewCategory.current = null;
    }
  }, [categories]);

  function handleNewCategory() {
    awaitingNewCategory.current = new Set(categories.map((c) => c.id));
    router.push('/category-edit');
  }
  const [emoji, setEmoji] = useState(existing?.emoji ?? HABIT_EMOJIS[0]);
  const [color, setColor] = useState(existing?.color ?? HABIT_COLORS[0]);
  const [frequencyKind, setFrequencyKind] = useState<FrequencyKind>(existing?.frequency.type ?? 'daily');
  const [selectedDays, setSelectedDays] = useState<number[]>(
    existing?.frequency.type === 'weekdays' ? existing.frequency.days : [1, 2, 3, 4, 5]
  );
  const [timesPerWeek, setTimesPerWeek] = useState(
    existing?.frequency.type === 'timesPerWeek' ? existing.frequency.count : 3
  );
  const [goalType, setGoalType] = useState<GoalType>(existing?.goalType ?? 'binary');
  const [target, setTarget] = useState(String(existing?.target ?? 1));
  const [unit, setUnit] = useState(existing?.unit ?? '');
  const [step, setStep] = useState(String(existing?.step ?? 1));
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
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  useEffect(() => {
    if (!reminderEnabled) return;
    getNotificationPermissionStatus().then((granted) => setPermissionBlocked(!granted));
  }, [reminderEnabled]);

  async function handleReminderToggle(value: boolean) {
    if (!value) {
      setReminderEnabled(false);
      return;
    }

    const granted = await ensureNotificationPermission();
    if (!granted) {
      setPermissionBlocked(true);
      Alert.alert(
        'Notifications disabled',
        'Enable notifications in Settings to receive habit reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    setPermissionBlocked(false);
    setReminderEnabled(true);
  }

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  /** Switching goal type resets the numbers to sensible defaults for that type. */
  function handleGoalTypeChange(next: GoalType) {
    setGoalType(next);
    if (next === 'binary') {
      setTarget('1');
      setStep('1');
    } else if (next === 'duration') {
      setTarget('30');
      setStep('5');
    } else {
      setTarget('8');
      setStep('1');
    }
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

    const targetValue = goalType === 'binary' ? 1 : Math.floor(Number(target));
    const stepValue = goalType === 'binary' ? 1 : Math.floor(Number(step));
    if (!Number.isFinite(targetValue) || targetValue < 1) {
      Alert.alert('Invalid goal', 'The daily target needs to be a whole number of at least 1.');
      return;
    }
    if (!Number.isFinite(stepValue) || stepValue < 1) {
      Alert.alert('Invalid step', 'The amount added per tap needs to be a whole number of at least 1.');
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
      goalType,
      target: targetValue,
      unit: goalType === 'count' && unit.trim() !== '' ? unit.trim() : null,
      step: stepValue,
      // A category deleted while this form was open falls back to "Other".
      categoryId: categories.some((c) => c.id === categoryId) ? categoryId : null,
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
        await cancelHabitReminder(existing.notificationId, existing.id);
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
        await cancelHabitReminder(existing.notificationId, existing.id);
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
          await cancelHabitReminder(existing.notificationId, existing.id);
          deleteHabit(existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? (existing?.name ?? 'Edit Habit') : 'New Habit' }} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <Text style={[styles.label, { color: colors.subtext }]}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Drink water"
        placeholderTextColor={colors.subtext}
        style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
      />

      <Text style={[styles.label, { color: colors.subtext }]}>Category</Text>
      <View style={styles.categoryChips}>
        {[{ id: null, name: 'None', emoji: '' }, ...categories].map((c) => {
          const selected = c.id === categoryId || (c.id === null && !categories.some((k) => k.id === categoryId));
          return (
            <Pressable
              key={c.id ?? 'none'}
              onPress={() => setCategoryId(c.id)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selected ? color : colors.card,
                  borderColor: selected ? color : colors.border,
                },
              ]}
            >
              <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                {c.emoji ? `${c.emoji} ${c.name}` : c.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={handleNewCategory}
          style={[styles.categoryChip, styles.newCategoryChip, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>+ New</Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { color: colors.subtext }]}>Icon</Text>
      <View style={styles.grid}>
        {HABIT_EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => setEmoji(e)}
            style={[
              styles.emojiOption,
              { borderColor: e === emoji ? color : 'transparent', backgroundColor: colors.card },
            ]}
          >
            <Text style={styles.emojiText}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.subtext }]}>Color</Text>
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

      <Text style={[styles.label, { color: colors.subtext }]}>Goal</Text>
      <View style={styles.segmented}>
        {(['binary', 'count', 'duration'] as GoalType[]).map((kind) => (
          <Pressable
            key={kind}
            onPress={() => handleGoalTypeChange(kind)}
            style={[
              styles.segment,
              {
                backgroundColor: goalType === kind ? color : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={{ color: goalType === kind ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
              {kind === 'binary' ? 'Just Done' : kind === 'count' ? 'Count' : 'Duration'}
            </Text>
          </Pressable>
        ))}
      </View>

      {goalType !== 'binary' && (
        <View style={styles.goalFields}>
          <View style={styles.goalField}>
            <Text style={[styles.goalFieldLabel, { color: colors.subtext }]}>
              {goalType === 'duration' ? 'Target (minutes)' : 'Daily target'}
            </Text>
            <TextInput
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            />
          </View>
          <View style={styles.goalField}>
            <Text style={[styles.goalFieldLabel, { color: colors.subtext }]}>Per tap</Text>
            <TextInput
              value={step}
              onChangeText={setStep}
              keyboardType="number-pad"
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            />
          </View>
        </View>
      )}

      {goalType === 'count' && (
        <TextInput
          value={unit}
          onChangeText={setUnit}
          placeholder="Unit (e.g. glasses, pages)"
          placeholderTextColor={colors.subtext}
          style={[
            styles.input,
            styles.goalUnitInput,
            { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
          ]}
        />
      )}

      <Text style={[styles.label, { color: colors.subtext }]}>Frequency</Text>
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
              {/* Full short names: single letters left two T's and two S's. */}
              <Text style={{ color: selectedDays.includes(idx) ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {frequencyKind === 'timesPerWeek' && (
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => setTimesPerWeek((n) => Math.max(1, n - 1))}
            style={[styles.stepperButton, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.stepperText, { color: colors.text }]}>−</Text>
          </Pressable>
          <Text style={[styles.stepperValue, { color: colors.text }]}>{timesPerWeek}x per week</Text>
          <Pressable
            onPress={() => setTimesPerWeek((n) => Math.min(7, n + 1))}
            style={[styles.stepperButton, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.stepperText, { color: colors.text }]}>+</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.reminderRow, { borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.subtext, marginTop: 0 }]}>Reminder</Text>
        <Switch value={reminderEnabled} onValueChange={handleReminderToggle} />
      </View>

      {reminderEnabled && permissionBlocked && (
        <Pressable onPress={() => Linking.openSettings()} style={styles.permissionWarning}>
          <Text style={{ color: colors.danger, fontSize: 13 }}>
            Notifications are disabled, so this reminder won't fire. Tap to open Settings.
          </Text>
        </Pressable>
      )}

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
        <Pressable style={[styles.archiveButton, { backgroundColor: colors.fill }]} onPress={handleArchiveToggle}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {existing?.archived ? 'Unarchive Habit' : 'Archive Habit'}
          </Text>
        </Pressable>
      )}

      {isEditing && (
        <Pressable style={[styles.deleteButton, { backgroundColor: colors.dangerSoft }]} onPress={handleDelete}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete Habit</Text>
        </Pressable>
      )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: space.xl, paddingBottom: 60 },
  label: { ...font.label, marginTop: 28, marginBottom: 10, marginLeft: space.xs },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // The ring is how the chosen emoji is shown, so it keeps its border.
  emojiOption: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 22 },
  colorOption: { width: 36, height: 36, borderRadius: 18 },
  segmented: { flexDirection: 'row', gap: space.sm },
  segment: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
  },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  categoryChip: { borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  // The dashed outline marks "+ New" as an action rather than a choice.
  newCategoryChip: { borderStyle: 'dashed', borderWidth: 1 },
  weekdayRow: { flexDirection: 'row', gap: 6, marginTop: space.lg },
  weekdayPill: {
    flex: 1,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: space.lg },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { fontSize: 20, fontWeight: '600' },
  stepperValue: { ...font.headline, minWidth: 110, textAlign: 'center' },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.sm,
  },
  timeButton: {
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  permissionWarning: {
    marginTop: space.md,
  },
  goalFields: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.lg,
  },
  goalField: { flex: 1 },
  goalFieldLabel: { ...font.label, marginBottom: 7, marginLeft: space.xs },
  goalUnitInput: { marginTop: space.md },
  saveButton: {
    marginTop: space.xxl,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', ...font.headline },
  archiveButton: {
    marginTop: space.lg,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  deleteButton: {
    marginTop: space.md,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
});

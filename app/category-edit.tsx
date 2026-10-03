import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CATEGORY_EMOJIS } from '../constants/habitOptions';
import { useTheme } from '../hooks/useTheme';
import { useHabitStore } from '../store/habitStore';
import { validateCategoryName } from '../utils/categories';

/** Creates a category, or edits one when given an id. */
export default function CategoryEditScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const categories = useHabitStore((s) => s.categories);
  const habits = useHabitStore((s) => s.habits);
  const addCategory = useHabitStore((s) => s.addCategory);
  const updateCategory = useHabitStore((s) => s.updateCategory);
  const deleteCategory = useHabitStore((s) => s.deleteCategory);

  const existing = useMemo(() => categories.find((c) => c.id === id), [categories, id]);
  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? CATEGORY_EMOJIS[0]);

  function handleSave() {
    const error = validateCategoryName(name, categories, existing?.id);
    if (error) {
      Alert.alert('Check the name', error);
      return;
    }
    if (existing) updateCategory(existing.id, name, emoji);
    else addCategory(name, emoji);
    router.back();
  }

  function handleDelete() {
    if (!existing) return;
    const count = habits.filter((h) => h.categoryId === existing.id).length;
    const fate =
      count === 0
        ? 'No habits are in it.'
        : `Its ${count} ${count === 1 ? 'habit moves' : 'habits move'} to "Other" — nothing is deleted.`;
    Alert.alert(`Delete "${existing.name}"?`, fate, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCategory(existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit Category' : 'New Category' }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: colors.subtext }]}>NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Fitness"
          placeholderTextColor={colors.subtext}
          autoFocus={!existing}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.subtext }]}>ICON</Text>
        <View style={styles.grid}>
          {CATEGORY_EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              style={[
                styles.emojiOption,
                {
                  backgroundColor: colors.card,
                  borderColor: emoji === e ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={[styles.saveButton, { backgroundColor: colors.accent }]} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{existing ? 'Save Changes' : 'Create Category'}</Text>
        </Pressable>

        {existing && (
          <Pressable style={[styles.deleteButton, { borderColor: colors.danger }]} onPress={handleDelete}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete Category</Text>
          </Pressable>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 28, marginBottom: 10 },
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
  saveButton: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
});

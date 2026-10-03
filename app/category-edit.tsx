import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CATEGORY_EMOJIS } from '../constants/habitOptions';
import { font, radius, space, useTheme } from '../hooks/useTheme';
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
        <Text style={[styles.label, { color: colors.subtext }]}>Name</Text>
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

        <Text style={[styles.label, { color: colors.subtext }]}>Icon</Text>
        <View style={styles.grid}>
          {CATEGORY_EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              style={[
                styles.emojiOption,
                {
                  backgroundColor: colors.card,
                  borderColor: emoji === e ? colors.accent : 'transparent',
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
          <Pressable style={[styles.deleteButton, { backgroundColor: colors.dangerSoft }]} onPress={handleDelete}>
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
  label: { ...font.label, marginTop: 28, marginBottom: 10, marginLeft: space.xs },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiOption: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 22 },
  saveButton: {
    marginTop: space.xxl,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', ...font.headline },
  deleteButton: {
    marginTop: space.md,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
});

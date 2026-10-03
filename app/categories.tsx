import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReorderableList, {
  ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { STARTER_CATEGORIES } from '../constants/habitOptions';
import { radius, useTheme } from '../hooks/useTheme';
import { useHabitStore } from '../store/habitStore';
import { Category } from '../types/habit';

function CategoryRow({ category, habitCount }: { category: Category; habitCount: number }) {
  const router = useRouter();
  const { colors, card } = useTheme();
  const drag = useReorderableDrag();

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/category-edit', params: { id: category.id } })}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        drag();
      }}
      delayLongPress={180}
      style={[styles.row, card]}
    >
      <Text style={styles.emoji}>{category.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {category.name}
        </Text>
        <Text style={[styles.count, { color: colors.subtext }]}>
          {habitCount === 0 ? 'No habits yet' : `${habitCount} ${habitCount === 1 ? 'habit' : 'habits'}`}
        </Text>
      </View>
      <Text style={[styles.handle, { color: colors.subtext }]}>≡</Text>
    </Pressable>
  );
}

/** Lists categories; dragging here sets the order their sections appear on Today. */
export default function CategoriesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const categories = useHabitStore((s) => s.categories);
  const habits = useHabitStore((s) => s.habits);
  const addCategory = useHabitStore((s) => s.addCategory);
  const reorderCategories = useHabitStore((s) => s.reorderCategories);

  function handleReorder({ from, to }: ReorderableListReorderEvent) {
    reorderCategories(reorderItems(categories, from, to).map((c) => c.id));
  }

  // Starters already taken by name aren't offered again.
  const taken = new Set(categories.map((c) => c.name.toLowerCase()));
  const starters = STARTER_CATEGORIES.filter((s) => !taken.has(s.name.toLowerCase()));

  const newButton = (
    <Pressable
      onPress={() => router.push('/category-edit')}
      style={[styles.newButton, { backgroundColor: colors.accent }]}
    >
      <Text style={styles.newButtonText}>+ New Category</Text>
    </Pressable>
  );

  const starterChips = starters.length > 0 && (
    <View style={styles.starters}>
      <Text style={[styles.startersLabel, { color: colors.subtext }]}>Quick add</Text>
      <View style={styles.chips}>
        {starters.map((s) => (
          <Pressable
            key={s.name}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              addCategory(s.name, s.emoji);
            }}
            style={[styles.chip, { backgroundColor: colors.fill }]}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              {s.emoji} {s.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (categories.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.emptyEmoji}>🗂️</Text>
        <Text style={[styles.emptyText, { color: colors.subtext }]}>
          Categories group your habits into sections on the Today screen.
        </Text>
        {newButton}
        {starterChips}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ReorderableList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onReorder={handleReorder}
        ListHeaderComponent={
          <Text style={[styles.hint, { color: colors.subtext }]}>
            Tap to edit. Press and hold to drag — this order is the order of sections on Today.
          </Text>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {newButton}
            {starterChips}
          </View>
        }
        renderItem={({ item }) => (
          <CategoryRow
            category={item}
            habitCount={habits.filter((h) => h.categoryId === item.id && !h.archived).length}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 20 },
  hint: { fontSize: 13, marginBottom: 14, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  emoji: { fontSize: 24 },
  name: { fontSize: 16, fontWeight: '600' },
  count: { fontSize: 12, marginTop: 2 },
  handle: { fontSize: 22, fontWeight: '600' },
  footer: { marginTop: 10 },
  newButton: { paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center', alignSelf: 'stretch' },
  newButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  starters: { marginTop: 24, alignSelf: 'stretch' },
  startersLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginLeft: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
});

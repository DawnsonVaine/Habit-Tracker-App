import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useHabitStore } from '../store/habitStore';

export default function ArchiveScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const habits = useHabitStore((s) => s.habits);

  const archivedHabits = useMemo(() => habits.filter((h) => h.archived), [habits]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {archivedHabits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📦</Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>No archived habits.</Text>
        </View>
      ) : (
        <FlatList
          data={archivedHabits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/habit/new', params: { id: item.id } })}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 18 }}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  emoji: { fontSize: 24 },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 15, textAlign: 'center' },
});

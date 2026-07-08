import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Habit } from '../types/habit';

interface Props {
  habit: Habit;
  completed: boolean;
  streak: number;
  onToggle: () => void;
}

export function HabitCard({ habit, completed, streak, onToggle }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Link href={{ pathname: '/habit/[id]', params: { id: habit.id } }} asChild>
        <Pressable style={styles.info}>
          <Text style={styles.emoji}>{habit.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {habit.name}
            </Text>
            <Text style={[styles.streak, { color: colors.subtext }]}>
              {streak > 0 ? `🔥 ${streak} day streak` : 'No streak yet'}
            </Text>
          </View>
        </Pressable>
      </Link>
      <Pressable
        onPress={onToggle}
        style={[
          styles.checkbox,
          {
            backgroundColor: completed ? habit.color : 'transparent',
            borderColor: habit.color,
          },
        ]}
      >
        {completed && <Text style={styles.check}>✓</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  streak: {
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  check: {
    color: '#fff',
    fontWeight: '700',
  },
});

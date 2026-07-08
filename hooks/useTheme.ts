import { useColorScheme } from 'react-native';

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
  danger: string;
}

const light: ThemeColors = {
  background: '#F5F5F7',
  card: '#FFFFFF',
  text: '#111827',
  subtext: '#6B7280',
  border: '#E5E7EB',
  accent: '#4F46E5',
  danger: '#EF4444',
};

const dark: ThemeColors = {
  background: '#0B0B0F',
  card: '#1C1C22',
  text: '#F3F4F6',
  subtext: '#9CA3AF',
  border: '#2C2C34',
  accent: '#818CF8',
  danger: '#F87171',
};

export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  return { colors, isDark: scheme === 'dark' };
}

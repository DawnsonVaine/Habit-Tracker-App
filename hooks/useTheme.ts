import { StyleSheet, TextStyle, useColorScheme, ViewStyle } from 'react-native';

/**
 * The app's design system. Every screen pulls its colours, spacing, corner
 * radii and type from here, so the look can be tuned in one place.
 */
export interface ThemeColors {
  /** Page canvas behind everything. */
  background: string;
  /** Raised surfaces: cards, rows, inputs. */
  card: string;
  /** Recessed neutral fill: progress tracks, inactive chips, segmented controls. */
  fill: string;
  text: string;
  subtext: string;
  /** Hints and placeholders, a step quieter than subtext. */
  muted: string;
  /** Hairline separators, used sparingly. */
  border: string;
  accent: string;
  /** Pale accent wash behind accent-coloured content. */
  accentSoft: string;
  danger: string;
  dangerSoft: string;
}

const light: ThemeColors = {
  background: '#F5F5F7',
  card: '#FFFFFF',
  fill: '#EEEEF2',
  text: '#111827',
  subtext: '#6B7280',
  muted: '#9CA3AF',
  border: '#E5E7EB',
  accent: '#4F46E5',
  accentSoft: '#EEF0FF',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
};

const dark: ThemeColors = {
  background: '#0B0B0F',
  card: '#17171C',
  fill: '#24242B',
  text: '#F3F4F6',
  subtext: '#9CA3AF',
  muted: '#6B7280',
  border: '#2A2A31',
  accent: '#818CF8',
  accentSoft: '#23234A',
  danger: '#F87171',
  dangerSoft: '#3A1D1F',
};

/** Spacing scale. Stick to these rather than one-off numbers. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;

export const font = {
  largeTitle: { fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15 },
  caption: { fontSize: 13 },
  /** Section labels: sentence case, quiet rather than shouty capitals. */
  label: { fontSize: 13, fontWeight: '600' },
  micro: { fontSize: 11, fontWeight: '600' },
} satisfies Record<string, TextStyle>;

/**
 * The raised surface every card sits on. Light mode lifts it with a soft
 * shadow instead of a border; shadows vanish against a dark page, so dark
 * mode outlines it with a hairline instead.
 */
function cardSurface(colors: ThemeColors, isDark: boolean): ViewStyle {
  if (isDark) {
    return {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    };
  }
  return {
    backgroundColor: colors.card,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  };
}

const lightCard = cardSurface(light, false);
const darkCard = cardSurface(dark, true);

export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  return {
    colors: isDark ? dark : light,
    isDark,
    /** Spread into a card's style for its background, depth and outline. */
    card: isDark ? darkCard : lightCard,
  };
}

/**
 * Voya design tokens.
 *
 * Values are extracted from the frozen design (reference/voya-design.html).
 * The board is authored pixel-by-pixel at a 440×956 artboard and contains 132
 * distinct colours, 27 font sizes, 29 radii and 50 spacing values. Those have
 * been NORMALISED into the scales below so the app stays coherent as it grows.
 * Normalisation drifts by 1–3px from the board in places; that is deliberate
 * and recorded in docs/frontend-integration-notes.md.
 *
 * The five brand colours are exact and must never be altered.
 */

export const brand = {
  cream: '#FFF8EE',
  lavender: '#CEBDF3',
  peach: '#FFC87A',
  violet: '#7650AB',
  plum: '#3B2E59',
} as const;

export const colors = {
  brand,

  text: {
    primary: '#3B2E59',   // plum
    secondary: '#7B6F80', // most-used muted text in the board
    tertiary: '#96819E',
    inverse: '#FFF8EE',
    onViolet: '#FFF8EE',
    link: '#7650AB',
  },

  surface: {
    /** App background. */
    base: '#FFF8EE',
    /** Cards and sheets that sit above the base. */
    raised: '#FFFFFF',
    /** Inset rows, inputs, chips. */
    sunken: '#F0EAE6',
    /** Lavender-tinted panels (Up Next, highlights). */
    accent: '#EDE2F7',
    /** Deep plum panels (reverse lockup, map overlays). */
    inverse: '#3B2E59',
    scrim: 'rgba(59,46,89,0.45)',
  },

  border: {
    subtle: '#E9E0DF',
    accent: '#E6DBE3',
    strong: '#DED4DF',
  },

  status: {
    success: '#4F7A5B',
    warning: '#FFC87A',
    danger: '#8E414C',
    dangerSurface: '#F0DFE1',
  },

  /** Non-brand greys observed in the board for dividers and inactive glyphs. */
  neutral: {
    100: '#F0ECE6',
    200: '#E9E0DF',
    300: '#DED4DF',
    400: '#BCB1C9',
    500: '#96819E',
    600: '#7B6F80',
    700: '#69636E',
    800: '#46334F',
    900: '#3B2E59',
  },
} as const;

/** 4pt grid. The board's literal values cluster on 4/8/12/16/20/24. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Normalised from 29 literal radii in the board. */
export const radius = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

/**
 * Type scale normalised from 27 literal sizes.
 *
 * NOTE: the board uses Arial and Georgia as PLACEHOLDERS. The approved identity
 * uses a custom rounded geometric face for the wordmark and a serif for display.
 * `fontFamily` is intentionally left undefined here so the app renders in the
 * platform default until licensed font files are added — see
 * docs/frontend-integration-notes.md. Do not substitute a lookalike.
 */
export const typography = {
  display:   { fontSize: 34, lineHeight: 38, fontWeight: '700' },
  h1:        { fontSize: 26, lineHeight: 31, fontWeight: '700' },
  h2:        { fontSize: 22, lineHeight: 27, fontWeight: '600' },
  title:     { fontSize: 18, lineHeight: 23, fontWeight: '600' },
  subtitle:  { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  bodyLg:    { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  body:      { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  footnote:  { fontSize: 12, lineHeight: 17, fontWeight: '400' },
  caption:   { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  overline:  { fontSize: 10, lineHeight: 13, fontWeight: '600', letterSpacing: 1 },
} as const;

/** Board shadows, translated to RN elevation + iOS shadow. */
export const shadow = {
  card: {
    shadowColor: '#3B2E59',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  floating: {
    shadowColor: '#3B2E59',
    shadowOpacity: 0.16,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  sheet: {
    shadowColor: '#30223E',
    shadowOpacity: 0.19,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -12 },
    elevation: 16,
  },
} as const;

export const layout = {
  /** The frozen design's artboard width. Used only for proportional checks. */
  referenceWidth: 440,
  screenPadding: 20,
  tabBarHeight: 64,
  minTouchTarget: 44,
} as const;

/** Icon sizing. The board uses a 24×24 outline set at stroke-width 1.7. */
export const icon = {
  strokeWidth: 1.7,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radius;
export type TypographyKey = keyof typeof typography;

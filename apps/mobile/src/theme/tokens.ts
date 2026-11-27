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

/**
 * Exact board metrics (440pt artboard) for surfaces the owner asked to match
 * one to one. These are NOT normalised: each value is read from the board CSS.
 */
export const board = {
  /** Approved lockup viewBox aspect (787.36 × 206) and emblem aspect (305 × 293). */
  logoAspect: 787.3623693379791 / 206,
  emblemAspect: 293 / 305,
  screenPaddingX: 27,
  /** Board `small` / `.muted`: 12px at line-height 1.5. */
  small: { fontSize: 12, lineHeight: 18 },
  /** Board `.inline` gap. */
  inlineGap: 10,
  /** Board h2 bottom margin. */
  h2MarginBottom: 8,
  badgeDot: 8,
  /** Shared row/list metrics. */
  listRow: { paddingY: 12, gap: 13, borderColor: '#E9E0DF' },
  thumb: { width: 58, height: 61, radius: 13 },
  photoRadius: 22,
  avatar: {
    size: 36, border: 2, overlap: -7, fontSize: 11, fontWeight: '600',
    tints: ['#DECDF0', '#F6D3A6', '#D9DED2'],
  },
  home: {
    brandMarginTop: 19, brandMarginBottom: 7, brandHeight: 40,
    greetingMarginBottom: 23,
    sectionTitle: { fontSize: 18, lineHeight: 22.5, fontWeight: '600', marginBottom: 7 },
    upNext: {
      padding: 17, radius: 24, background: '#E9DDF4', marginTop: 13, marginBottom: 19,
      photoHeight: 140, photoMarginBottom: 17, titleMarginTop: 10, avatarsMarginTop: 8,
    },
    title: { fontSize: 23, lineHeight: 26.5, letterSpacing: -0.7, fontWeight: '700' },
    eyebrow: { fontSize: 11, letterSpacing: 1.8, fontWeight: '700' },
    rowTitle: { fontSize: 15, marginBottom: 4 },
    recent: { marginTop: 18, titleSize: 16, titleMarginBottom: 4, bodyColor: '#8C7991' },
  },
  /** Board h1: 34px, line-height 1.1, -1.4 tracking, 13 below. */
  h1: { fontSize: 34, lineHeight: 37.5, letterSpacing: -1.4, fontWeight: '700', marginBottom: 13 },
  /** Board `.top` nav row and `.tinycenter` footnote. */
  topBar: { height: 40, marginBottom: 16, fontSize: 12, color: '#716477' },
  tinyCenter: { fontSize: 11, color: '#8A7B8C' },
  subtleControl: { fontSize: 12, paddingY: 8 },
  segment: {
    gap: 3, padding: 4, radius: 13, itemRadius: 10, itemPaddingY: 10, fontSize: 12,
    marginTop: 12, marginBottom: 19, background: '#EDE6E5',
  },
  profile: {
    titleMarginTop: 18,
    avatar: { size: 84, marginTop: 20, marginBottom: 14, fontSize: 27, lineHeight: 33 },
    nameSize: 29,
    statsGap: 44, statsMarginTop: 24, statsMarginBottom: 34, statSize: 23, statLineHeight: 28, statGap: 5,
    tags: { gap: 8, marginTop: 13, marginBottom: 20, paddingY: 9, paddingX: 12, radius: 12, background: '#EDE2F7' },
    link: { gap: 13, paddingY: 22, fontSize: 15, borderColor: '#E6DBE3' },
  },
  create: {
    introMarginTop: 45,
    option: { gap: 16, paddingY: 23, paddingX: 16, radius: 23, marginY: 9, minHeight: 117 },
    optionBackgrounds: ['#F1E9F7', '#F9E8D5', '#F0EAE3'],
    symbol: { size: 47, radius: 15, background: '#E4D6F5', icon: 25 },
    bodySize: 13, bodyMarginTop: 5,
  },
  explore: {
    titleMarginTop: 8, titleMarginBottom: 15,
    location: { radius: 16, background: '#F0E7F6', paddingY: 12, paddingX: 14, gap: 9, minHeight: 50, citySize: 16 },
    note: { fontSize: 11, marginTop: 7, color: '#8B7891' },
    categories: {
      gap: 8, marginTop: 17, marginBottom: 18, minHeight: 40, paddingY: 10, paddingX: 16,
      border: '#E4DAE7', radius: 24, fontSize: 12,
    },
    card: { height: 338, radius: 26, placeholder: '#DDD1C1', marginTop: 2 },
    backing: { inset: { top: -7, x: 9, bottom: 6 }, radius: 27, color: '#D9C7F0', rotate: '2.5deg' },
    match: { top: 16, left: 16, radius: 20, paddingY: 9, paddingX: 12, fontSize: 11, background: '#FFF8EEF0' },
    meta: {
      paddingTop: 70, paddingX: 23, paddingBottom: 22, scrim: '#2D2530', scrimAlphaHex: 'EB',
      nameSize: 31, nameLineHeight: 35.5, nameMarginBottom: 6, lineSize: 13, lineColor: '#F9F1E7', lineGap: 4,
      reasonSize: 11, reasonColor: '#EAE0E3', reasonMarginTop: 10,
    },
    actions: {
      gap: 35, marginTop: 20, marginBottom: 13, size: 59, icon: 27, labelGap: 8, labelSize: 11, labelColor: '#7E6F89',
      skipBackground: '#EADEF5', saveBackground: '#FFF0DC', saveColor: '#95672B',
    },
    learning: { fontSize: 11, color: '#8B7A92', gap: 6, icon: 14, marginTop: 6, marginBottom: 6 },
    mapToggle: { minHeight: 43, radius: 24, paddingY: 11, paddingX: 20, fontSize: 13, gap: 8, icon: 16 },
  },
  saved: {
    filters: { gap: 8, marginTop: 7, marginBottom: 20, minHeight: 39, paddingY: 9, paddingX: 16, radius: 22, border: '#E4DAE7', fontSize: 12 },
    card: {
      marginBottom: 18, gap: 15, paddingBottom: 17, photoWidth: 110, photoHeight: 125, photoRadius: 18,
      titleSize: 18, titleMarginTop: 7, titleMarginBottom: 5, lineSize: 12, lineMarginBottom: 5,
      actionGap: 19, actionPaddingY: 6, actionMarginTop: 3, heart: 17, heartPaddingTop: 8,
    },
  },
  /** Board `.action` buttons. */
  action: {
    minHeight: 50, paddingY: 14, paddingX: 12, radius: 17, fontSize: 15, fontWeight: '600', marginTop: 10,
    secondaryBackground: '#EEE4F7', dangerBackground: '#F0DFE1', dangerText: '#823A47',
  },
  /** Board form fields (`.xp-label` / `.xp-input`). */
  field: {
    labelSize: 12, labelMarginBottom: 7, background: '#F0EAE6', radius: 15, minHeight: 54,
    paddingX: 16, gap: 8, fontSize: 14, placeholder: '#94858F', toggleSize: 11, errorSize: 12,
  },
  form: {
    topMarginBottom: 23, introMarginBottom: 18, introBodySize: 13, fieldsGap: 14, fieldsGapTight: 9, fieldsMarginTop: 8,
    fieldsMarginBottom: 19, legalSize: 11, linkSize: 12, linkPaddingY: 7,
    social: { gap: 8, marginTop: 8, marginBottom: 12, minHeight: 44, fontSize: 13, iconGap: 12, icon: 19 },
    orSize: 11, orColor: '#8A8191',
  },
  /** Board `.xp-state`: confirmation / permission screens. */
  stateHero: {
    paddingTop: 30, symbolSize: 67, symbolRadius: 22, symbolMarginBottom: 27, symbolIcon: 28,
    symbolBackground: '#E4D6F5', bodySize: 14, bodyLineHeight: 23.8, bodyMaxWidth: 330,
  },
  /** Board `.xp-code`: six one-digit boxes. */
  code: { gap: 9, height: 60, radius: 14, border: '#DED4DF', fontSize: 23, marginTop: 26, marginBottom: 20 },
  /** Board `.xp-chips` (onboarding interests). */
  chips: {
    gap: 10, marginTop: 18, marginBottom: 20, paddingY: 12, paddingX: 15, radius: 12, fontSize: 13,
    minHeight: 42, border: '#E2D6E5', selectedBackground: '#EDE2F7',
  },
  /** Board `.xp-photo-edit`. */
  photoEdit: { avatar: 76, avatarFontSize: 25, gap: 18, marginTop: 8, marginBottom: 23 },
  welcome: { emblemSize: 64, bodyMaxWidth: 295, logoWidth: 220, logoMarginBottom: 39, titleSize: 36, titleLineHeight: 42, bodySize: 15, bodyLineHeight: 25.5, paddingBottom: 66 },
  activity: {
    rowPaddingY: 22, rowGap: 14, avatar: 42, titleSize: 15, titleLineHeight: 21, titleMarginBottom: 6,
    bodySize: 12, bodyLineHeight: 19, timeSize: 10, timeColor: '#97879C', dot: 5,
    dayLabelSize: 11, dayLabelTracking: 1.4, dayLabelColor: '#96819E', dayLabelMarginTop: 25,
  },
  search: {
    field: { gap: 12, padding: 17, radius: 17, marginTop: 23, marginBottom: 21, minHeight: 56, background: '#F0E9E6', fontSize: 14 },
    group: { fontSize: 11, tracking: 1.4, color: '#96819E', marginTop: 24, marginBottom: 2 },
    row: { gap: 14, minHeight: 64, paddingY: 17, fontSize: 15, icon: 19, border: '#E6DBE3' },
    resultsHeader: { marginTop: 21, marginBottom: 3 },
    result: { gap: 15, paddingY: 20, photoWidth: 100, photoHeight: 111, titleSize: 17, titleMarginBottom: 5, lineSize: 11, lineMarginBottom: 6 },
  },
  filters: {
    handle: { width: 38, height: 4, radius: 5, color: '#D4C8D7', marginTop: 12, marginBottom: 23 },
    paddingX: 25, headerMarginBottom: 25, sectionMarginBottom: 23, titleSize: 15, titleMarginBottom: 12,
    option: { gap: 8, radius: 12, paddingY: 11, paddingX: 13, minHeight: 40, fontSize: 12, border: '#DED2E2', selectedBackground: '#E5D5F3' },
    switch: { width: 46, height: 28, knob: 22, inset: 3, off: '#E0D5E6' },
    button: { border: '#E2D6E5', radius: 15, minWidth: 49, height: 50, badge: 17, badgeFontSize: 10, badgeOffset: -4 },
  },
  place: {
    top: { gap: 12, marginBottom: 15, buttonPadding: 5, titleSize: 12 },
    heroHeight: 254, heroRadius: 28, heroMarginBottom: 25,
    titleMarginBottom: 9,
    pill: { paddingY: 7, paddingX: 11, radius: 25, background: '#EAE0F5', fontSize: 11 },
    section: { paddingY: 17, border: '#E9DFE5', titleSize: 16, bodySize: 13, bodyLineHeight: 19.5, bodyColor: '#837088' },
    actions: { gap: 10, marginTop: 20, saveWidth: 64, saveRadius: 17, saveBackground: '#EEE1F6' },
  },
  addToPlan: {
    radius: 34, paddingTop: 13, titleSize: 30, eyebrowMarginTop: 22,
    pick: { gap: 14, paddingY: 23, border: '#E9DCE6', titleSize: 17, titleMarginBottom: 4 },
    noteMarginTop: 15,
  },
  location: {
    row: { gap: 16, paddingY: 21, minHeight: 75, border: '#EBDFE7', symbol: 44, symbolBackground: '#EEE4F6', titleSize: 15, titleMarginBottom: 4 },
    dreamMarginTop: 30,
  },
  map: {
    controlsTop: 12, controlsX: 20, controlShadow: '#46334F',
    // boxWidth/boxHeight: fixed marker size; react-native-maps clips flexible custom markers.
    pin: { paddingY: 10, paddingX: 13, radius: 20, gap: 5, fontSize: 12, icon: 17, boxWidth: 104, boxHeight: 56 },
    label: { bottom: 78, paddingY: 12, paddingX: 18, radius: 20, fontSize: 12 },
    toggleBottom: 20,
    preview: {
      x: 18, bottom: 67, radius: 25, padding: 17, thumbWidth: 92, thumbHeight: 84, thumbRadius: 15,
      titleSize: 19, titleMarginBottom: 7, lineSize: 12, lineColor: '#7D6B83', counterSize: 10, counterColor: '#9E8BA6',
      actionsGap: 35, actionsMarginTop: 15, round: 42, roundIcon: 21, labelSize: 10, labelGap: 5,
    },
  },
  /** Board `.sheet` shadow: 0 -20px 30px #392b5717. */
  sheetShadow: { shadowColor: '#392B57', shadowOpacity: 0.09, shadowRadius: 30, shadowOffset: { width: 0, height: -20 }, elevation: 16 },
  settings: {
    row: { gap: 14, minHeight: 64, paddingY: 17, border: '#E6DBE3', titleSize: 15, titleLineHeight: 21, subtitleSize: 12, subtitleMarginTop: 4, icon: 19 },
    toggleRow: { minHeight: 53, paddingY: 13 },
    switch: { width: 42, height: 25, knob: 19, inset: 3, off: '#DED4DF' },
    danger: '#8E414C',
    note: { padding: 18, background: '#EEE5F7', radius: 18, marginY: 16, fontSize: 13, lineHeight: 21.5 },
    check: { gap: 10, fontSize: 12, lineHeight: 19, marginY: 15, box: 18, boxRadius: 4, icon: 14 },
    rangeMarginY: 16,
    about: { marginTop: 65, logoWidth: 166, logoMarginBottom: 25, taglineSize: 19, taglineMarginBottom: 35 },
    sheet: { radius: 30, paddingX: 25, paddingTop: 12, paddingBottom: 33, titleSize: 26, titleLineHeight: 31, bodySize: 13, bodyLineHeight: 21.5, scrim: 'rgba(255,248,238,0.65)' },
    bioMinHeight: 76,
  },
  hangout: {
    templateChip: { gap: 11, radius: 15, paddingY: 18, paddingX: 10, minHeight: 56, fontSize: 14, border: '#DED4DF', selectedBackground: '#E8DCF6', marginTop: 15, marginBottom: 25 },
    formRow: { paddingY: 16, border: '#E8DEDC', fontSize: 15, labelSize: 11, labelMarginBottom: 5 },
    steps: { gap: 9, fontSize: 11, paddingY: 10, paddingX: 8, radius: 12, background: '#EEE6EB', marginTop: 8, marginBottom: 14 },
    cover: { height: 210, marginBottom: 23 },
    stop: { timeWidth: 47, lineWidth: 21, gap: 7, minHeight: 69, timePaddingTop: 3, dotMarginTop: 5, titleMarginBottom: 3, photoMarginTop: 9, timeSize: 12, timeColor: '#7C6A81', dot: 9, lineColor: '#DDCEE4', titleSize: 15, bodySize: 12, bodyColor: '#786B7C', photoHeight: 80, photoRadius: 13 },
    lobbyStop: { minHeight: 85, titleSize: 18, titleMarginBottom: 8, pillPaddingY: 5, pillPaddingX: 9 },
    vote: { radius: 20, paddingY: 9, paddingX: 12, fontSize: 12, background: '#EEE2F6' },
    suggestion: { photoHeight: 112, photoMarginBottom: 11, marginBottom: 18 },
    selection: { padding: 20, background: '#EEE5F7', radius: 20, marginY: 12, gap: 16 },
    invite: { titleSize: 35 },
    lobbyMarginTop: 26, lobbyMarginBottom: 16,
  },
  event: {
    createCover: { height: 176, inset: 13 },
    hostCover: { height: 160, marginBottom: 16 },
    smallTitle: 27,
    hostedBy: { size: 11, marginTop: 7 },
    stats: { gap: 30, marginTop: 13, marginBottom: 10, valueSize: 22, valueMarginBottom: 3, labelSize: 10 },
    statsPanel: { padding: 16, radius: 20, background: '#EEE7EA', marginTop: 6, valueSize: 20, labelSize: 11 },
    scheduleHeading: { size: 17, marginTop: 20, marginBottom: 12 },
    hostStop: { minHeight: 47, titleSize: 13, bodySize: 11 },
    eventStop: { minHeight: 88 },
    pastStop: { minHeight: 63, paddingBottom: 17, titleSize: 16, marginTop: 18 },
    weddingCover: { height: 310, topRadius: 0, bottomRadius: 100, marginTop: -8, marginBottom: 23 },
    invitationTitle: { size: 43, letterSpacing: -1.8, lineHeight: 46, marginY: 7 },
    invitationLine: { size: 15, marginTop: 9 },
    divider: { width: 36, color: '#C8B6D6', marginY: 22 },
    rsvp: { gap: 7, marginTop: 25, marginBottom: 6, radius: 13, paddingY: 15, fontSize: 12, background: '#ECE3F2' },
    agenda: { size: 11, letterSpacing: 1, paddingTop: 11, paddingBottom: 17 },
    editorItem: { paddingY: 19, border: '#E6DCE1', gap: 18, titleSize: 15, titleMarginBottom: 6, dragColor: '#BAAABD' },
    celebrate: { size: 106, marginTop: 33, marginBottom: 26, background: '#E5D7F4', checkSize: 43, sparkSize: 35, sparkRight: -17, sparkTop: -9 },
    confirmCover: { height: 210, marginBottom: 23 },
    confirmTitle: 25,
    miniPill: { background: '#EDE2F7', radius: 20, paddingY: 7, paddingX: 11, fontSize: 11, marginBottom: 14 },
    coverEdit: { height: 126, inset: 12, radius: 11, paddingY: 9, paddingX: 13, fontSize: 12, marginBottom: 18 },
    shareCover: { height: 180, marginBottom: 21 },
    shareThumb: { width: 58, height: 61, radius: 13 },
    hostAvatarGap: 25,
    stopTextMarginBottom: 5,
  },
  trip: {
    dashes: { width: 22, height: 3, gap: 5, off: '#E4D9E6' },
    destCard: { padding: 14, radius: 20, gap: 14, thumb: 48, thumbRadius: 12, marginTop: 22 },
    destPhoto: { height: 165, marginTop: 10, marginBottom: 22 },
    calendar: { cell: 39, rangeFill: '#FFE8C8', headerSize: 17, weekdaySize: 11, daySize: 15, marginTop: 30, rowGap: 6 },
    summary: { padding: 16, radius: 20, titleSize: 22, marginTop: 20 },
    chip: { minHeight: 44, radius: 14, gap: 9, fontSize: 14, border: '#DED4DF', selectedBackground: '#E8DCF6' },
    sectionTitle: { size: 17, marginTop: 22, marginBottom: 10 },
    badge: { size: 26, fontSize: 11 },
    overviewIcon: { size: 38, radius: 12 },
    mustThumb: { width: 52, height: 41, radius: 9, gap: 8 },
    todayCard: { padding: 14, radius: 22, photoHeight: 104, background: '#EFE6F7' },
    mapCard: { padding: 14, radius: 22, thumb: 68 },
    mapMarker: { size: 30, fontSize: 12 },
    countSize: 21,
    rowThumb: { width: 58, height: 61 },
    covers: { overview: 126, join: 270, past: 155 },
    labelSpacing: 0.5,
    routeLine: { width: 2, dash: [6, 6] },
    nextMarginTop: 24,
    requestAvatar: 29,
    emptyDot: 9,
  },
  pastPlans: { introMarginBottom: 18, introBodySize: 13, cardMarginBottom: 24, photoHeight: 120, photoMarginBottom: 11, titleSize: 17 },
  tabBar: {
    height: 88, paddingX: 28, paddingTop: 10, paddingBottom: 24, borderColor: '#E9DFE8',
    itemMinWidth: 88, itemMinHeight: 50, itemRadius: 16, itemGap: 6, iconSize: 22,
    labelSize: 11, inactive: '#9B8AA3', activeBackground: '#EDE3F6',
  },
  fab: { size: 58, right: 18, bottomAboveTabBar: 20 },
} as const;

export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radius;
export type TypographyKey = keyof typeof typography;

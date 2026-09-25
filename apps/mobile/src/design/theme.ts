const ink = {
  strong: '#F7F7F8',
  base: '#C9C9CE',
  muted: '#8A8A91',
};

const surface = {
  ground: '#0B0B0C',
  raised: '#151517',
  sunken: '#09090A',
  line: '#27272B',
  lineStrong: '#3A3A40',
};

export const Theme = {
  colors: {
    ...surface,
    ...ink,
    accent: '#E0B64A',
    accentInk: '#0B0B0C',
    accentSoft: 'rgba(224, 182, 74, 0.14)',
    danger: '#F0857D',
    dangerSoft: 'rgba(240, 133, 125, 0.14)',
    background: surface.ground,
    text: ink.strong,
    textSecondary: ink.base,
    textMuted: ink.muted,
    border: surface.line,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  type: {
    display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.5 },
    title: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.3 },
    heading: { fontSize: 19, lineHeight: 26, fontWeight: '600' as const },
    body: { fontSize: 17, lineHeight: 26, fontWeight: '400' as const },
    bodyStrong: { fontSize: 17, lineHeight: 26, fontWeight: '600' as const },
    label: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
    caption: { fontSize: 13, lineHeight: 19, fontWeight: '500' as const },
    overline: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 1.1 },
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  touchTarget: 56,
  motion: {
    press: 120,
    state: 180,
  },
} as const;

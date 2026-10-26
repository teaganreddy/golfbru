export const colors = {
  bg: '#FFFFFF',
  surface: '#F4F4F5',
  line: '#E8E8EA',
  text: '#0A0A0B',
  muted: '#8A8A8F',
  primary: '#0A0A0B', // buttons
  onPrimary: '#FFFFFF',
  accent: '#12A150', // plays-like, under par, selected
  water: '#2F7DF6',
  sand: '#D9A441',
  danger: '#E5484D',
  warnBg: '#FFF6E5',
  warnText: '#8A5A00',
};

export const radius = { sm: 10, md: 14, lg: 20 };

export const type = {
  title: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.8, color: colors.text },
  heading: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  label: { fontSize: 13, fontWeight: '500' as const, color: colors.muted },
};

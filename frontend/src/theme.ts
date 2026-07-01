export const theme = {
  color: {
    surface: '#121212',
    onSurface: '#F3F3F3',
    surfaceSecondary: '#1E1E1E',
    onSurfaceSecondary: '#A3A3A3',
    surfaceTertiary: '#2A2A2A',
    onSurfaceTertiary: '#C4C4C4',
    brand: '#E55B3C',
    onBrand: '#FFFFFF',
    brandSecondary: '#3A1E16',
    onBrandSecondary: '#E55B3C',
    success: '#34C759',
    warning: '#FF9F0A',
    error: '#FF453A',
    border: '#2A2A2A',
    borderStrong: '#3A3A3A',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    pill: 999,
  },
  font: {
    // Use system fonts; layer monospaced/condensed style for numbers
    body: undefined as undefined | string,
    mono: 'Menlo',
  },
};

// Map raw spreadsheet category strings to a small canonical filter set
// so the chip row stays sane (the sheet has 30+ free-text categories).
export const CATEGORY_BUCKETS: Array<{ id: string; label: string; match: (c: string) => boolean }> = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'food', label: 'Food', match: (c) => /food|bakery|ice cream|crepe|bistro|restaurang|soft drinks|food, art|attraction and food/i.test(c) },
  { id: 'stay', label: 'Stay', match: (c) => /accommodation|hotel|hostel|camping|b&b|cabin/i.test(c) },
  { id: 'grocery', label: 'Grocery', match: (c) => /grocery|farm shop|farm store|gårdsbutik|gardsbutik|farm/i.test(c) },
  { id: 'church', label: 'Church', match: (c) => /church|kyrka|kapell/i.test(c) },
  { id: 'attraction', label: 'Attraction', match: (c) => /attraction|cinema|wine|view/i.test(c) },
  { id: 'angel', label: 'Angel Stations', match: (c) => /angel|protection and energy/i.test(c) },
];

export const categoryIcon = (cat: string): string => {
  const c = (cat || '').toLowerCase();
  if (/food|bakery|crepe|bistro|restaurang/.test(c)) return 'restaurant-outline';
  if (/ice cream/.test(c)) return 'ice-cream-outline';
  if (/accommodation|hotel|hostel|b&b|cabin/.test(c)) return 'bed-outline';
  if (/camping/.test(c)) return 'bonfire-outline';
  if (/grocery/.test(c)) return 'cart-outline';
  if (/farm/.test(c)) return 'leaf-outline';
  if (/water/.test(c)) return 'water-outline';
  if (/church|kyrka|kapell/.test(c)) return 'business-outline';
  if (/cinema/.test(c)) return 'film-outline';
  if (/angel|protection/.test(c)) return 'shield-checkmark-outline';
  if (/attraction|view/.test(c)) return 'compass-outline';
  if (/wine/.test(c)) return 'wine-outline';
  if (/soft drinks/.test(c)) return 'cafe-outline';
  return 'pin-outline';
};

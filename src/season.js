// Seasons by the real date in Darby (or ?season=spring|summer|fall|winter). Changes tree colours, snow cover, critters.
export function seasonOf(date = new Date(), override = '') {
  const o = String(override || '').toLowerCase(); if (['spring', 'summer', 'fall', 'winter'].includes(o)) return o; if (o === 'autumn') return 'fall';
  const m = date.getMonth(); // 0 = Jan
  return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'fall';
}
export const GREENS = [0x5f9a3e, 0x4f8a36, 0x6fae48, 0x3f7a30];
export const SPRING = [0x8cc65a, 0x9fd06a, 0x7bbb4e, 0xb5dc84];
export const BARE = [0x8a7a68, 0x7a6a58, 0x9a8a78, 0x6a5a48];
// pick a canopy palette for a tree whose autumn colours are `fall`
export function canopy(season, fall) { return season === 'fall' ? fall : season === 'summer' ? GREENS : season === 'spring' ? SPRING : BARE; }

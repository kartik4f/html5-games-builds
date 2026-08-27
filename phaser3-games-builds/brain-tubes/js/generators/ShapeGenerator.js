export function generateShape(level, d) {
  const categories =
    level < 5
      ? ['CIRCLE', 'SQUARE', 'TRIANGLE']
      : level < 8
        ? ['CIRCLE', 'SQUARE', 'TRIANGLE', 'DIAMOND']
        : ['CIRCLE', 'SQUARE', 'TRIANGLE', 'DIAMOND', 'STAR'];
  const items = Array.from({ length: d.items }, (_, i) => ({
    value: '',
    shape: categories[i % categories.length],
    category: categories[i % categories.length],
  }));
  return { categories, items, rule: 'Sort each shape into the matching tube.' };
}

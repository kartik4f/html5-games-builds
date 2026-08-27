export function generateWord(level, d) {
  const groups = {
    ANIMAL: ['CAT', 'DOG', 'TIGER', 'HORSE', 'FROG', 'LION'],
    FOOD: ['RICE', 'APPLE', 'BREAD', 'MANGO', 'PIZZA', 'CARROT'],
    PLACE: ['SCHOOL', 'PARK', 'CITY', 'BEACH', 'HOUSE', 'MARKET'],
    OBJECT: ['PEN', 'BOOK', 'CHAIR', 'CLOCK', 'BAG', 'BALL'],
    ACTION: ['RUN', 'JUMP', 'READ', 'WRITE', 'SING', 'SWIM'],
  };
  const categories = Object.keys(groups).slice(
    0,
    level < 4 ? 2 : level < 7 ? 3 : level < 9 ? 4 : 5,
  );
  const pool = categories.flatMap((c) =>
    groups[c].map((value) => ({ value, category: c })),
  );
  const items = [];
  const used = new Set();
  while (items.length < d.items) {
    const x = Phaser.Utils.Array.GetRandom(pool);
    if (used.has(x.value)) continue;
    used.add(x.value);
    items.push({ ...x });
    if (used.size >= pool.length) break;
  }
  while (items.length < d.items) {
    const x = Phaser.Utils.Array.GetRandom(pool);
    items.push({ ...x });
  }
  return {
    categories,
    items,
    rule: 'Sort each word into the correct meaning category.',
  };
}

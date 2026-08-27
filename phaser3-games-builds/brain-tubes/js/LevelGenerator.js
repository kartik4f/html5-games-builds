import { getDifficulty } from './Difficulty.js';
import { generateNumber } from './generators/NumberGenerator.js';
import { generateOrder } from './generators/OrderGenerator.js';
import { generateMath } from './generators/MathGenerator.js';
import { generateShape } from './generators/ShapeGenerator.js';
import { generateWord } from './generators/WordGenerator.js';

const GENERATORS = {
  number: generateNumber,
  order: generateOrder,
  math: generateMath,
  shape: generateShape,
  word: generateWord,
};

export function generateLevel(mode, level) {
  const baseDifficulty = getDifficulty(level);
  const content = GENERATORS[mode](level, baseDifficulty);
  const categories = content.categories.slice(
    0,
    Math.min(content.categories.length, baseDifficulty.tubes - 1),
  );
  // Guarantee at least one target for every category used.
  content.items.forEach(
    (it, i) =>
      (it.category = categories.includes(it.category)
        ? it.category
        : categories[i % categories.length]),
  );
  const bucketSizes = categories.map(
    (category) =>
      content.items.filter((item) => item.category === category).length,
  );
  const capacity = Math.max(baseDifficulty.capacity, ...bucketSizes);
  const d = { ...baseDifficulty, capacity };
  const tubes = Array.from({ length: d.tubes }, (_, i) => ({
    id: i,
    category: i < categories.length ? categories[i] : null,
    items: [],
  }));
  categories.forEach((cat, i) => {
    tubes[i].items = content.items.filter((x) => x.category === cat);
  });
  const shuffled = shuffleSolved(tubes, d);
  return {
    mode,
    level,
    difficulty: d,
    categories,
    items: content.items,
    rule: content.rule,
    tubes: shuffled,
  };
}

function cloneTubes(tubes) {
  return tubes.map((t) => ({ ...t, items: [...t.items] }));
}
function validReverseMove(tubes, from, to, capacity) {
  return (
    from !== to &&
    tubes[from].items.length > 0 &&
    tubes[to].items.length < capacity
  );
}
function shuffleSolved(tubes, d) {
  const state = cloneTubes(tubes);
  const moves = d.scrambleMoves;
  let last = '';
  for (let i = 0; i < moves; i++) {
    const options = [];
    for (let a = 0; a < state.length; a++)
      for (let b = 0; b < state.length; b++)
        if (validReverseMove(state, a, b, d.capacity)) {
          const key = `${a}-${b}`;
          if (key !== last) options.push([a, b]);
        }
    if (!options.length) break;
    const [from, to] = Phaser.Utils.Array.GetRandom(options);
    // Move a top item; reversing these moves always returns to the solved state.
    state[to].items.push(state[from].items.pop());
    last = `${to}-${from}`;
  }
  // Reject trivially solved output by forcing another legal shuffle when possible.
  const solved = state.every(
    (t) =>
      t.items.length === 0 || t.items.every((x) => x.category === t.category),
  );
  if (solved && state.length > 1) {
    for (let a = 0; a < state.length; a++) {
      if (state[a].items.length) {
        const b = state.findIndex(
          (t, i) => i !== a && t.items.length < d.capacity,
        );
        if (b >= 0) {
          state[b].items.push(state[a].items.pop());
          break;
        }
      }
    }
  }
  return state;
}

const TABLE = [
  {tubes:3, items:5,  maxValue:20,  categories:2, empty:1},
  {tubes:3, items:6,  maxValue:30,  categories:2, empty:1},
  {tubes:4, items:7,  maxValue:40,  categories:3, empty:1},
  {tubes:4, items:8,  maxValue:50,  categories:3, empty:1},
  {tubes:5, items:9,  maxValue:70,  categories:3, empty:2},
  {tubes:5, items:10, maxValue:90,  categories:4, empty:1},
  {tubes:5, items:12, maxValue:120, categories:4, empty:1},
  {tubes:6, items:13, maxValue:150, categories:4, empty:2},
  {tubes:6, items:15, maxValue:200, categories:5, empty:1},
  {tubes:7, items:18, maxValue:250, categories:5, empty:2}
];

export function getDifficulty(level){
  const base = TABLE[Math.max(1, Math.min(10, level))-1];
  return {...base, level, scrambleMoves: 10 + level * 4, capacity: 4};
}

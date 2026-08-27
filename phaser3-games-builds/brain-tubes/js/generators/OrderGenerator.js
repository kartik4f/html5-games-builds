export function generateOrder(level,d){
  const max=d.maxValue;
  const categories=level<5?['LOW','HIGH']:level<8?['LOW','MEDIUM','HIGH']:['VERY LOW','LOW','MEDIUM','HIGH','VERY HIGH'];
  const ranges=categories.map((_,i)=>[Math.floor(i*max/categories.length)+1,Math.floor((i+1)*max/categories.length)]);
  const items=[]; const used=new Set();
  while(items.length<d.items){const n=Phaser.Math.Between(1,max);if(used.has(n))continue;used.add(n);let idx=ranges.findIndex(r=>n>=r[0]&&n<=r[1]);idx=Math.max(0,idx);items.push({value:n,category:categories[idx]});}
  return {categories,items,rule:'Sort values by their numerical range.'};
}

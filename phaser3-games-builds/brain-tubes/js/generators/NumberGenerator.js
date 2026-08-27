export function generateNumber(level,d){
  const categories = level<6 ? ['EVEN','ODD'] : ['EVEN','ODD','MULTIPLE OF 3','MULTIPLE OF 5'];
  const items=[];
  const used=new Set();
  while(items.length<d.items){
    const n=Phaser.Math.Between(2,d.maxValue); if(used.has(n))continue;
    const matches=categories.filter(c=>c==='EVEN'?n%2===0:c==='ODD'?n%2!==0:c==='MULTIPLE OF 3'?n%3===0:n%5===0);
    const cat=matches[0] || (n%2===0?'EVEN':'ODD');
    used.add(n); items.push({value:n,category:cat});
  }
  return {categories,items,rule:'Sort each number into the tube matching its property.'};
}

export function generateMath(level,d){
  const categories=level<6?['0–9','10–19']:['0–9','10–19','20–29','30+'];
  const items=[]; const used=new Set();
  while(items.length<d.items){
    const a=Phaser.Math.Between(1,Math.max(5,level*3+3)), b=Phaser.Math.Between(1,Math.max(5,level*3+3));
    const op=level<4?'+':Phaser.Utils.Array.GetRandom(['+','-','×']);
    let r=op==='+'?a+b:op==='-'?Math.max(0,a-b):a*b;
    if(r>50||used.has(r))continue; used.add(r);
    const idx=categories.findIndex(c=>{if(c==='0–9')return r<10;if(c==='10–19')return r<20;if(c==='20–29')return r<30;return r>=30});
    items.push({value:`${a} ${op} ${b}`,category:categories[Math.max(0,idx)]});
  }
  return {categories,items,rule:'Solve each equation mentally, then sort by the result.'};
}

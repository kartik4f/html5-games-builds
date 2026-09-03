export class RewardManager{calculate(a,o){const gain=Object.values(a).reduce((x,v)=>x+Math.max(0,v),0);
return {xp:50+gain*8,stars:gain>=6?3:gain>=3?2:1};}
apply(p,r){p.xp+=r.xp;while(p.xp>=p.level*300)p.level++;if(!p.achievements.includes("first-day"))p.achievements.push("first-day");}}
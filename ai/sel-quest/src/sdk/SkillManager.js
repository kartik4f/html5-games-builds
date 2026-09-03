export const COMPETENCIES={selfAwareness:"Self-Awareness",selfManagement:"Self-Management",
socialAwareness:"Social Awareness",relationshipSkills:"Relationship Skills",responsibleDecisionMaking:"Responsible Decision-Making"};
export class SkillManager{assess(events,reflection){const a={selfAwareness:0,selfManagement:0,socialAwareness:0,relationshipSkills:0,responsibleDecisionMaking:0};
for(const e of events||[])for(const [k,v] of Object.entries(e.skills||{}))if(a[k]!=null)a[k]+=v;
if(reflection?.skill&&a[reflection.skill]!=null)a[reflection.skill]+=2;
return Object.fromEntries(Object.entries(a).map(([k,v])=>[k,Math.max(0,Math.min(10,Math.round(v)))]));}
apply(p,a){for(const[k,v]of Object.entries(a))p.skills[k]=Math.max(0,Math.min(100,p.skills[k]+v));}}
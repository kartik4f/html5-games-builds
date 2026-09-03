export class PlayerModel{constructor(){this.id=crypto.randomUUID();this.name="Alex";this.level=1;this.xp=0;
this.skills={selfAwareness:20,selfManagement:20,socialAwareness:20,relationshipSkills:20,responsibleDecisionMaking:20};
this.characters={Maya:{trust:50,comfort:50,stress:20}};this.history=[];this.achievements=[];this.totalReflections=0;}
fromJSON(d){if(!d)return;Object.assign(this,structuredClone(d));}
toJSON(){return {id:this.id,name:this.name,level:this.level,xp:this.xp,skills:{...this.skills},
characters:structuredClone(this.characters),history:structuredClone(this.history),achievements:[...this.achievements],
totalReflections:this.totalReflections};}}
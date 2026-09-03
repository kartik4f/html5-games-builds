export class ConsequenceEngine{apply(story,choice){
const p=window.selGame.player,c=p.character?c:story.character;const char=p.characters[c]||(p.characters[c]={trust:50,comfort:50,stress:20});
for(const [k,v] of Object.entries(choice.effects||{}))if(char[k]!=null)char[k]=Math.max(0,Math.min(100,char[k]+v));
return {skills:choice.skills||{},effects:choice.effects||{},feedback:choice.feedback};}}
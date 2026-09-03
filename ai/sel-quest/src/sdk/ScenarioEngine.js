export class ScenarioEngine{
validate(s){return !!s&&Array.isArray(s.choices)&&s.choices.length>=2&&s.choices.every(c=>c.text&&c.effects&&c.skills);}
getChoices(story){return story.choices.filter(c=>c.text&&c.effects&&c.skills);}
generate(story){if(!this.validate(story))throw new Error("Invalid scenario package");return this.getChoices(story);}}
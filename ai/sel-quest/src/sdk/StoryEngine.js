const STORIES=[{id:"daily-disappointment",title:"The Team Decision",theme:"Disappointment",character:"Maya",
competencies:["socialAwareness","relationshipSkills","selfManagement"],
beats:[
{type:"dialogue",speaker:"Maya",text:"I can't believe they chose Ravi for the team. I worked really hard too."},
{type:"emotion",speaker:"Maya",emotion:"disappointed"},
{type:"dialogue",speaker:"Maya",text:"Maybe nobody notices what I can do."}],
question:"Maya looks disappointed. What would you do next?",
choices:[
{text:"Ask Maya if she wants to talk about what happened.",effects:{trust:10,comfort:10,stress:-5},
skills:{socialAwareness:3,relationshipSkills:3,selfManagement:1},correct:true,
feedback:"You noticed her emotion and gave her space to express it."},
{text:"Tell Maya to stop being dramatic.",effects:{trust:-12,comfort:-12,stress:8},
skills:{socialAwareness:-2,relationshipSkills:-2},correct:false,
feedback:"Dismissing the emotion can make someone feel less safe sharing."},
{text:"Tell her she should have worked harder.",effects:{trust:-5,comfort:-6},
skills:{socialAwareness:-1,relationshipSkills:-1},correct:false,
feedback:"Advice before understanding the feeling can miss what the person needs."}]
}];
export class StoryEngine{
getDaily(player){return STORIES[Math.floor((Date.now()/86400000)%STORIES.length)];}
get(id){return STORIES.find(s=>s.id===id);}}
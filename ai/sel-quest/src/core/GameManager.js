import {PlayerModel} from "../sdk/PlayerModel.js";
import {ScenarioEngine} from "../sdk/ScenarioEngine.js";
import {StoryEngine} from "../sdk/StoryEngine.js";
import {ConsequenceEngine} from "../sdk/ConsequenceEngine.js";
import {SkillManager} from "../sdk/SkillManager.js";
import {DifficultyEngine} from "../sdk/DifficultyEngine.js";
import {RewardManager} from "../sdk/RewardManager.js";
import {ReflectionEngine} from "../sdk/ReflectionEngine.js";
import {PersistenceManager} from "../sdk/PersistenceManager.js";
export class GameManager{
constructor(){this.player=new PlayerModel();this.scenarios=new ScenarioEngine();this.stories=new StoryEngine();
this.consequences=new ConsequenceEngine();this.skills=new SkillManager();this.difficulty=new DifficultyEngine();
this.rewards=new RewardManager();this.reflection=new ReflectionEngine();this.persistence=new PersistenceManager();
this.session=null;this.load();}
async load(){const d=await this.persistence.load();if(d)this.player.fromJSON(d);}
startDaily(){const story=this.stories.getDaily(this.player);this.session={story,events:[],started:Date.now()};return story;}
event(e){if(this.session)this.session.events.push(e);}
choose(choice){if(!this.session)return null;const c=this.consequences.apply(this.session.story,choice);
this.event({skills:c.skills||{},effects:c.effects||{}});return c;}
complete(reflection){const s=this.session, outcome={total:s.events.length||1,correct:s.events.filter(e=>e.correct).length};
const assessment=this.skills.assess(s.events,reflection),reward=this.rewards.calculate(assessment,outcome);
this.skills.apply(this.player,assessment);this.rewards.apply(this.player,reward);this.player.totalReflections++;
this.player.history.unshift({date:new Date().toISOString(),story:s.story.id,assessment,reward});
this.player.history=this.player.history.slice(0,50);this.persistence.save(this.player.toJSON());
return {assessment,reward,outcome,profile:this.player.toJSON()};}}
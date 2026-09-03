import{header,button,panel}from"../ui.js";import{COMPETENCIES}from"../sdk/SkillManager.js";
export default class ProfileScene extends Phaser.Scene{constructor(){super("ProfileScene");}create(){const w=this.scale.width,p=window.selGame.player;header(this,"MY GROWTH",`Level ${p.level} • ${p.xp} XP • ${p.totalReflections} reflections`);
let y=180;for(const[k,n]of Object.entries(COMPETENCIES)){panel(this,650,y+35,1100,95);this.add.text(120,y,n,{fontSize:"27px",fontStyle:"bold",color:"#263238"});
this.add.rectangle(350,y+35,650,24,0xe0e0e0).setOrigin(0,.5);this.add.rectangle(350,y+35,p.skills[k]*6.5,24,0x648c7a).setOrigin(0,.5);this.add.text(1050,y,`${p.skills[k]}/100`,{fontSize:"25px",color:"#37474f"});y+=125;}
button(this,w/2,900,"BACK HOME",()=>this.scene.start("HomeScene"),330);}}
export class PersistenceManager{key="sel-quest-v3";
async save(d){localStorage.setItem(this.key,JSON.stringify(d));}
async load(){try{const x=localStorage.getItem(this.key);return x?JSON.parse(x):null;}catch{return null;}}}
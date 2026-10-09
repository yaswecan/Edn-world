// One writer per editor. A response acknowledges only the snapshot it sent.
export class DraftWriter {
 constructor({read,write,token,onState=()=>{},delay=1200}){Object.assign(this,{read,write,token,onState,delay});this.saved=JSON.stringify(read());this.timer=null;this.pending=null;this.conflict=false;}
 get dirty(){return JSON.stringify(this.read())!==this.saved;}
 changed(){clearTimeout(this.timer);this.onState(this.dirty?'Modifications en cours':'Enregistré');if(this.dirty&&!this.conflict)this.timer=setTimeout(()=>this.save().catch(()=>{}),this.delay);}
 async save(){clearTimeout(this.timer);if(this.pending){await this.pending;if(this.dirty)return this.save();return;}if(this.conflict)throw Error('Résolvez le conflit avant de réessayer.');if(!this.dirty)return;
  const snapshot=JSON.stringify(this.read()),token=this.token;this.onState('Enregistrement…');
  this.pending=(async()=>{try{const result=await this.write(JSON.parse(snapshot),token);this.token=result.token;this.saved=snapshot;this.onState(this.dirty?'Modifications en cours':'Enregistré',result);return result;}catch(error){this.conflict=error.status===409;this.onState('Échec de l’enregistrement',null,error);throw error;}finally{this.pending=null;}})();
  await this.pending;if(this.dirty)return this.save();
 }
 dispose(){clearTimeout(this.timer);}
}

/* Original Canvas artwork, player and PC drawing extracted from Code Station V6.
 * Source: legacy/pedagolab/public/legacy/code-station-v6.html (CS.Renderer).
 * Generalized camera, maps and declarative effects; no account or lesson code.
 */
(()=>{
  const ink='#102031';
  function rounded(g,x,y,w,h,r,fill,stroke=ink,line=3){g.beginPath();g.roundRect(x,y,w,h,r);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=line;g.stroke();}}
  function polygon(g,points,fill,stroke=ink,width=3){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.lineJoin='round';g.stroke();}}
  function line(g,points,color,width=2){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width;g.lineJoin='round';g.lineCap='round';g.stroke();}
  function label(g,t,x,y,size=12,color='#e7f4fa',align='center',weight=800){g.font=`${weight} ${size}px "Trebuchet MS","Segoe UI",Arial,sans-serif`;g.textAlign=align;g.textBaseline='middle';g.fillStyle=color;g.fillText(t,x,y);}
  function ellipse(g,x,y,rx,ry,fill,stroke=null,width=2){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
  function gradient(g,x,y,w,h,a,b){const gr=g.createLinearGradient(x,y,x+w,y+h);gr.addColorStop(0,a);gr.addColorStop(1,b);return gr;}
  function chamfer(x,y,w,h,c=22){return[[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+h-c],[x+w-c,y+h],[x+c,y+h],[x,y+h-c],[x,y+c]];}
  function shadow(g,x,y,w,h,r=18){rounded(g,x+2,y+15,w,h,r,'#00000046',null);}
  function wall(g,points){
    const below=points.map(([x,y])=>[x,y+12]);line(g,below,'#102031',29);line(g,below,'#3a536a',20);
    line(g,points,'#0e1d2e',29);line(g,points,'#afc2ce',22);line(g,points,'#778d9f',15);line(g,points.map(([x,y])=>[x-2,y-3]),'#d3e1e6',3);
  }
  function tag(g,t,x,y,w=132,accent='#b8d5e3'){shadow(g,x-w/2,y-14,w,29,11);rounded(g,x-w/2,y-15,w,28,11,'#1b3045','#0e1d30',3);line(g,[[x-w/2+13,y-11],[x+w/2-13,y-11]],'#6f879b',1);label(g,t,x,y,12,accent);}
  function floor(g,r,tint){
    const pts=chamfer(r.x,r.y,r.w,r.h,20);
    polygon(g,pts,gradient(g,r.x,r.y,0,r.h,tint,'#748b9f'),null);
    g.save();g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();
    for(let x=Math.floor(r.x/48)*48;x<r.x+r.w;x+=48){line(g,[[x,r.y],[x,r.y+r.h]],'#304c622a',1);line(g,[[x+1,r.y],[x+1,r.y+r.h]],'#def4ff17',1);}
    for(let y=Math.floor(r.y/48)*48;y<r.y+r.h;y+=48){line(g,[[r.x,y],[r.x+r.w,y]],'#304c6236',1);line(g,[[r.x,y+1],[r.x+r.w,y+1]],'#def4ff17',1);}
    for(let k=0;k<20;k++){const x=r.x+24+(k*137)%(r.w-45),y=r.y+25+(k*71)%(r.h-40);rounded(g,x,y,3,1,1,'#304c6226',null);}
    g.restore();
  }
  function plant(g,x,y,s=1){
    g.save();g.translate(x,y);g.scale(s,s);ellipse(g,0,12,23,10,'#15213330');
    polygon(g,[[-15,-4],[15,-4],[11,21],[-11,21]],'#b4c3bf',ink,3);ellipse(g,0,-4,15,7,'#273f41',ink,3);
    const leaves=[[-18,-24,-.8],[-5,-43,-.2],[15,-37,.6],[22,-17,1.05],[1,-27,0]];
    leaves.forEach(([xx,yy,rot],i)=>{line(g,[[0,0],[xx,yy]],'#396b53',4);g.save();g.translate(xx*.72,yy*.8);g.rotate(rot);ellipse(g,0,0,8,18,i%2?'#609d72':'#3b856a',ink,2);line(g,[[0,-11],[0,10]],'#94c298',1);g.restore();});g.restore();
  }
  function crate(g,x,y,w=66,h=55,color='#c6b18d'){
    shadow(g,x,y,w,h,8);rounded(g,x,y,w,h,8,color,ink,4);polygon(g,[[x+5,y],[x+w-5,y],[x+w-5,y+10],[x+5,y+10]],'#e5d3ad',null);
    rounded(g,x+8,y+13,w-16,h-23,4,'#9a9184',ink,2);line(g,[[x+16,y+18],[x+w-16,y+h-16]],'#66747c',4);line(g,[[x+w-16,y+18],[x+16,y+h-16]],'#66747c',4);
    rounded(g,x+w*.37,y-3,w*.26,13,2,'#4a5c68',ink,2);rounded(g,x+w-18,y+h-15,9,4,1,'#f4c779',null);
  }
  function rack(g,x,y,w,h,color='#67d8ed'){
    shadow(g,x,y,w,h,9);rounded(g,x,y,w,h,9,gradient(g,x,y,w,0,'#b0bfcb','#687f94'),ink,4);rounded(g,x+6,y+8,w-12,h-18,5,'#233b50',ink,2);
    for(let yy=y+17;yy<y+h-15;yy+=25){rounded(g,x+12,yy,w-24,17,3,'#3d556a',ink,1.5);rounded(g,x+16,yy+4,4,7,2,color,null);line(g,[[x+25,yy+5],[x+w-16,yy+5]],'#7991a6',2);line(g,[[x+25,yy+10],[x+w-16,yy+10]],'#142c42',2);}
    rounded(g,x+13,y+h-5,w-26,5,2,'#182e43',null);
  }
  function tube(g,x,y){shadow(g,x-16,y,32,91,9);rounded(g,x-15,y,30,87,13,'#193d50',ink,3);rounded(g,x-9,y+8,18,65,8,gradient(g,x,y,18,60,'#65dce7','#347a8c'),ink,2);line(g,[[x-5,y+15],[x-5,y+62]],'#b8fffb',2);rounded(g,x-17,y+69,34,21,5,'#8ba4b4',ink,3);rounded(g,x-16,y-2,32,14,5,'#a4bcc8',ink,3);}
  function sofa(g,x,y,w=48,h=83,color='#619cad'){
    shadow(g,x,y,w,h,12);rounded(g,x,y,w,h,12,color,ink,4);rounded(g,x+9,y+9,w-18,h-18,8,'#477b95',ink,2);line(g,[[x+12,y+h/2],[x+w-11,y+h/2]],'#254862',2);rounded(g,x-2,y+5,10,h-10,5,'#8db9c4',ink,3);rounded(g,x+w-8,y+5,10,h-10,5,'#8db9c4',ink,3);
  }
  function bolt(g,x,y){ellipse(g,x,y,3,3,'#dbe3e7','#384e61',1.5);line(g,[[x-1,y+1],[x+1,y-1]],'#4b5d6c',1);}
  function arrow(g,x,y,right=true,color='#cedce1') {g.save();g.translate(x,y);if(!right)g.scale(-1,1);polygon(g,[[-12,-6],[0,-6],[0,-12],[14,0],[0,12],[0,6],[-12,6]],color,null);g.restore();}
  function screenWall(g,x,y,text,accent,w=126){shadow(g,x-w/2,y-20,w,40,9);rounded(g,x-w/2,y-21,w,41,8,'#758e9f',ink,4);rounded(g,x-w/2+6,y-15,w-12,28,4,'#102d43',ink,2);label(g,text,x,y-1,12,accent);bolt(g,x-w/2+4,y-1);bolt(g,x+w/2-4,y-1);}
  function drawReference(g,D){
    // Une coque commune, puis des pièces ouvertes sur le même couloir.
    shadow(g,90,426,1680,220,35);polygon(g,chamfer(94,426,1686,224,34),'#637e94',ink,7);
    D.rooms.forEach(r=>{shadow(g,r.x-18,r.y-22,r.w+36,r.h+45,28);polygon(g,chamfer(r.x-18,r.y-22,r.w+36,r.h+45,24),'#8ca7b8',ink,6);});
    polygon(g,[[1665,408],[1768,408],[1810,450],[1810,630],[1768,672],[1665,672]],'#8ca3b5',ink,7);
    floor(g,D.hall,'#9aafbc');D.rooms.forEach(r=>floor(g,r,r.floor));
    // Lignes de circulation, seuils et joints.
    line(g,[[150,485],[1660,485]],'#d6e7ea57',2);line(g,[[150,596],[1660,596]],'#d6e7ea57',2);
    for(let x=190;x<1630;x+=175){rounded(g,x,534,47,3,2,'#d0dfe380',null);}
    D.rooms.forEach(r=>{const gy=r.side==='bottom'?r.y+r.h:r.y;
      rounded(g,r.gap[0]+4,gy-21,r.gap[1]-r.gap[0]-8,45,0,r.floor,null);
      for(let xx=r.gap[0]+11;xx<r.gap[1]-8;xx+=12)line(g,[[xx,gy-15],[xx,gy+15]],'#4c627760',2);
      line(g,[[r.gap[0]+10,gy-18],[r.gap[1]-10,gy-18]],'#cce6eb',3);line(g,[[r.gap[0]+10,gy+17],[r.gap[1]-10,gy+17]],'#314c60',3);
    });
    // Murs : aucune ligne ne ferme une entrée praticable.
    const topGaps=D.rooms.filter(r=>r.side==='bottom').map(r=>r.gap);let xx=142;
    topGaps.forEach(([a,b])=>{wall(g,[[xx,450],[a,450]]);xx=b;});wall(g,[[xx,450],[1680,450]]);
    const bottomGaps=D.rooms.filter(r=>r.side==='top').map(r=>r.gap);xx=142;
    bottomGaps.forEach(([a,b])=>{wall(g,[[xx,630],[a,630]]);xx=b;});wall(g,[[xx,630],[1680,630]]);
    wall(g,[[142,450],[115,475],[115,604],[142,630]]);
    D.rooms.forEach(r=>{
      const x=r.x,y=r.y,w=r.w,h=r.h,c=20;
      const pts=r.side==='bottom'?[[r.gap[0],y+h],[x+c,y+h],[x,y+h-c],[x,y+c],[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+h-c],[x+w-c,y+h],[r.gap[1],y+h]]:[[r.gap[0],y],[x+c,y],[x,y+c],[x,y+h-c],[x+c,y+h],[x+w-c,y+h],[x+w,y+h-c],[x+w,y+c],[x+w-c,y],[r.gap[1],y]];
      wall(g,pts);
      const tagy=r.side==='bottom'?y+37:y+h-34;
      tag(g,r.name,x+w/2,tagy,200,r.color);
      label(g,r.code,x+25,r.side==='bottom'?y+h-31:y+37,17,'#476274');
      const l=r.gap[0],right=r.gap[1],gy=r.side==='bottom'?y+h:y;
      rounded(g,l-9,gy-22,12,47,4,'#233c50',ink,2);rounded(g,right-3,gy-22,12,47,4,'#233c50',ink,2);
      rounded(g,l-6,gy-14,5,28,2,r.color,null);rounded(g,right,gy-14,5,28,2,r.color,null);
      // Hublots sur les murs extérieurs.
      const wy=r.side==='bottom'?y-12:y+h+4;
      rounded(g,x+57,wy-8,66,14,5,'#0d2c46',ink,3);line(g,[[x+64,wy-6],[x+115,wy-6]],'#5dabd0',2);line(g,[[x+91,wy-6],[x+91,wy+3]],'#6f95a8',2);
      rounded(g,x+w-123,wy-8,66,14,5,'#0d2c46',ink,3);line(g,[[x+w-115,wy-6],[x+w-65,wy-6]],'#5dabd0',2);line(g,[[x+w-91,wy-6],[x+w-91,wy+3]],'#6f95a8',2);
    });
    // Des objets distincts, avec leurs propres ombres et volumes.
    rack(g,331,196,51,150,'#69dcf6');tube(g,586,222);tube(g,587,310);
    line(g,[[389,343],[420,343],[420,305],[463,305]],'#457c8c',5);line(g,[[389,343],[420,343],[420,305],[463,305]],'#90d6dc',2);
    plant(g,355,397,.77);plant(g,593,399,.73);
    screenWall(g,910,218,({1:'ORDRE → ACTION',2:'PRESSION',3:'MISE EN PAGE',4:'STYLE CIBLÉ'})[D.deck],'#c5b7ff',113);
    rounded(g,773,215,43,98,9,'#758aa3',ink,4);rounded(g,1003,215,43,98,9,'#758aa3',ink,4);
    [[794,'YES','#a1ebc2'],[1024,'NO','#eab4ba']].forEach(([x,t,c])=>{rounded(g,x-14,229,28,55,5,'#293d58',ink,2);label(g,t,x,252,10,c);ellipse(g,x,273,4,4,c,ink,1);});
    line(g,[[820,350],[867,350],[910,313],[953,350],[998,350]],'#5a5480',7);line(g,[[820,350],[867,350],[910,313],[953,350],[998,350]],'#c1ace477',3);
    ellipse(g,910,313,9,9,'#a292ca',ink,3);plant(g,1028,395,.76);
    // Réacteur : socle, tuyaux et colonne centrale (rotor dessiné à chaque frame).
    line(g,[[1270,238],[1243,238],[1243,290],[1357,290]],ink,18);line(g,[[1270,238],[1243,238],[1243,290],[1357,290]],'#6c8890',11);
    ellipse(g,1357,252,65,47,'#344f5d',ink,5);ellipse(g,1357,239,61,48,'#acc2c6',ink,5);ellipse(g,1357,234,46,35,'#243e4d',ink,4);
    rack(g,1217,205,43,73,'#8bebbd');tube(g,1470,212);plant(g,1228,394,.71);
    // Cargo.
    crate(g,356,703,71,58);crate(g,356,806,71,58,'#a9b6c0');crate(g,559,745,81,47);
    rounded(g,569,708,53,19,6,'#7791a1',ink,3);label(g,'TOOLS',596,718,8,'#dce5e9');plant(g,655,825,.97);
    // Espace de repos.
    sofa(g,1117,737,45,89);sofa(g,1391,737,45,89);
    ellipse(g,1275,800,59,26,'#15213333');rounded(g,1265,761,20,49,5,'#516c83',ink,3);ellipse(g,1275,778,59,44,'#477d9c',ink,5);ellipse(g,1275,767,57,41,'#87b6c8',ink,4);ellipse(g,1275,764,43,29,'#669bb3','#a2d0d5',2);
    rounded(g,1267,748,19,23,3,'#e2d6bb',ink,2);line(g,[[1272,754],[1281,754]],'#75969c',2);ellipse(g,1293,774,7,6,'#d4ded4',ink,2);ellipse(g,1293,772,4,3,'#624d4b',null);
    plant(g,1127,846,.78);plant(g,1419,851,.83);
    // Marquages du pont, panneaux, fenêtres et éléments de coque.
    g.save();g.globalAlpha=.42;label(g,'DECK 0'+D.deck,815,567,33,'#294b64','center',900);label(g,'PROPULSION',815,591,6,'#294b64');g.restore();
    arrow(g,385,540,false,'#d2dce16e');arrow(g,1566,540,true,'#ffe0aeaa');label(g,'MAINFRAME',1562,566,10,'#4c6170');
    screenWall(g,225,485,'NOVA // LINK','#8de8cf',122);
    tag(g,'EXPLORE · BUILD · REPEAT',908,658,203,'#8fadbf');
    for(let i=0;i<3;i++){rounded(g,838+i*48,412,31,12,4,'#678393',ink,2);line(g,[[844+i*48,415],[862+i*48,415]],'#b0cbd8',2);}
    // Renforts de coque.
    [[278,225],[659,225],[718,225],[1099,225],[1158,225],[1539,225],[302,759],[717,759],[1060,759],[1489,759]].forEach(([x,y])=>{rounded(g,x-6,y,12,44,3,'#53728b',ink,2);line(g,[[x-2,y+7],[x+2,y+7]],'#adc9d6',2);line(g,[[x-2,y+36],[x+2,y+36]],'#adc9d6',2);});
    // Les étoiles derrière quelques hublots donnent de la profondeur.
    rounded(g,1748,453,27,174,9,'#0d2540',ink,4);line(g,[[1760,465],[1760,615]],'#7ca4b344',2);
  }

class WorldRenderer {
 constructor(canvas,map){
  this.canvas=canvas;this.map=map;this.g=canvas.getContext('2d',{alpha:false});this.t=0;this.zoom=1;
  this.camera={x:map.width/2,y:map.height/2};
  this.stars=Array.from({length:120},(_,i)=>({x:(i*137.507%1000)/1000,y:(i*83.173%1000)/1000,s:i%13===0?1.8:1,a:.2+(i%8)*.075}));
  this.static=document.createElement('canvas');this.static.width=map.width;this.static.height=map.height;
  this.rebuild();this.resize();
 }
 rebuild(){
  const g=this.static.getContext('2d'),D=this.map;
  if(D.reference){drawReference(g,{...D,hall:{x:115,y:450,w:1610,h:180},deck:1});D.scenery.slice(-2).forEach(o=>crate(g,o.x,o.y,o.w,o.h,'#9aabaf'));return;}
  for(const r of D.floors){shadow(g,r.x-12,r.y-12,r.w+24,r.h+24,15);rounded(g,r.x-12,r.y-12,r.w+24,r.h+24,14,'#8ca7b8',ink,5);}
  for(const r of D.floors)floor(g,r,'#95aebb');
  // Only draw union boundaries, so openings never look like closed walls.
  const inside=(x,y)=>D.floors.some(r=>StationModel.inRect(x,y,r));
  for(const r of D.floors)for(const [x,y,dx,dy,len,nx,ny] of [[r.x,r.y,1,0,r.w,0,-1],[r.x,r.y+r.h,1,0,r.w,0,1],[r.x,r.y,0,1,r.h,-1,0],[r.x+r.w,r.y,0,1,r.h,1,0]]){
   let start=null;for(let i=0;i<=len;i+=5){const exposed=i<len&&!inside(x+dx*(i+2.5)+nx,y+dy*(i+2.5)+ny);if(exposed&&start===null)start=i;if(!exposed&&start!==null){wall(g,[[x+dx*start,y+dy*start],[x+dx*i,y+dy*i]]);start=null;}}
  }
  D.rooms.forEach((r,i)=>{tag(g,r.name,r.x+r.w/2,r.y+42,Math.min(270,r.w-30),r.color);label(g,String(i+1).padStart(2,'0'),r.x+44,r.y+r.h-42,20,'#476274');});
  D.scenery.forEach((o,i)=>i%3===0?rack(g,o.x,o.y,o.w,o.h,'#67d8ed'):crate(g,o.x,o.y,o.w,o.h,'#9aabaf'));
 }
 resize(){const r=this.canvas.getBoundingClientRect();this.w=Math.max(1,r.width);this.h=Math.max(1,r.height);this.dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);this.baseScale=Math.max(.5,Math.min((this.w-30)/this.map.width,(this.h-30)/this.map.height));this.scale=this.baseScale*this.zoom;}
 screenToWorld(x,y){return {x:(x-this.w/2)/this.scale+this.camera.x,y:(y-this.h/2)/this.scale+this.camera.y};}
 worldToScreen(x,y){return {x:(x-this.camera.x)*this.scale+this.w/2,y:(y-this.camera.y)*this.scale+this.h/2};}
    space(g,t){
      const bg=g.createLinearGradient(0,0,this.w,this.h);bg.addColorStop(0,'#0a1e34');bg.addColorStop(.5,'#102a43');bg.addColorStop(1,'#061323');g.fillStyle=bg;g.fillRect(0,0,this.w,this.h);
      const gl=g.createRadialGradient(this.w*.2,this.h*.5,0,this.w*.2,this.h*.5,this.w*.65);gl.addColorStop(0,'#143e561e');gl.addColorStop(1,'#12365000');g.fillStyle=gl;g.fillRect(0,0,this.w,this.h);
      this.stars.forEach((s,i)=>{g.globalAlpha=s.a*(.82+.18*Math.sin(t*.6+i));g.fillStyle=i%7===0?'#c6dcdd':'#83bad6';g.fillRect(s.x*this.w,s.y*this.h,s.s,s.s);});g.globalAlpha=1;
      // Arc orbital lointain, discret et sans ressource externe.
      g.save();g.globalAlpha=.2;g.beginPath();g.ellipse(this.w*.88,this.h*.81,this.w*.7,this.h*.43,-.38,0,Math.PI*2);g.strokeStyle='#5a8499';g.lineWidth=1;g.stroke();g.restore();
    }
    drawPC(g,p,game,t){
      const done=game.state.active.includes(p.id),near=game.near===p.id;
      const pulse=.5+.5*Math.sin(t*3);const c=p.color;
      g.save();
      if(near||!done){const glow=g.createRadialGradient(p.x,p.y+9,2,p.x,p.y+9,near?75:44);glow.addColorStop(0,c+(near?'38':'20'));glow.addColorStop(1,c+'00');g.fillStyle=glow;g.fillRect(p.x-80,p.y-65,160,145);}
      ellipse(g,p.x,p.y+24,40,15,'#19334640');
      if(near){g.setLineDash([8,5]);ellipse(g,p.x,p.y+20,47,21,null,c,2);g.setLineDash([]);}
      // Petit bureau-support et PC portable, silhouettes originales.
      rounded(g,p.x-27,p.y+10,54,24,8,'#667d92',ink,4);rounded(g,p.x-23,p.y+8,46,16,5,'#b9cbd2',ink,3);
      rounded(g,p.x-21,p.y+27,9,12,2,'#3c576d',ink,2);rounded(g,p.x+12,p.y+27,9,12,2,'#3c576d',ink,2);
      polygon(g,[[p.x-26,p.y+7],[p.x+26,p.y+7],[p.x+31,p.y+21],[p.x-31,p.y+21]],'#cad9de',ink,3);
      for(let i=0;i<3;i++)line(g,[[p.x-17,p.y+11+i*3],[p.x+17,p.y+11+i*3]],'#718998',1);
      rounded(g,p.x-27,p.y-27,54,37,6,gradient(g,p.x,p.y-25,0,40,'#e6ebdf','#9bb4c4'),ink,4);
      rounded(g,p.x-21,p.y-21,42,25,3,'#133c55',ink,2);
      const fill=g.createLinearGradient(p.x,p.y-20,p.x,p.y+2);fill.addColorStop(0,done?'#8aefca':c);fill.addColorStop(1,done?'#3a9b88':'#36829b');rounded(g,p.x-19,p.y-19,38,21,2,fill,null);
      line(g,[[p.x-16,p.y-17],[p.x-8,p.y-17]],'#d7fffcaa',2);
      if(done){line(g,[[p.x-7,p.y-7],[p.x-2,p.y-2],[p.x+9,p.y-12]],'#124b54',3);}else{label(g,p.id==='archive'?'i':['engine','pressure'].includes(p.id)?'↻':p.id==='interface'?'</>':'{ }',p.x,p.y-8,14,'#e7ffff');}
      ellipse(g,p.x+21,p.y+5,1.5,1.5,done?'#7fe6b9':'#498d9d',null);
      if(!done){ellipse(g,p.x,p.y+55,3,3,c,null);}
      if(near){
        const yy=p.y-65-Math.sin(t*3)*2;
        rounded(g,p.x-66,yy-13,132,26,10,'#0d2638','#b9ede1',2);rounded(g,p.x-59,yy-8,17,17,5,'#c9f6e8',null);label(g,'E',p.x-50,yy+1,10,'#174338');label(g,'UTILISER LE PC',p.x+12,yy+1,8,'#daf4ed');
      }else if(!done){g.globalAlpha=.6+pulse*.2;label(g,p.label,p.x,p.y+70,9,'#264754');g.globalAlpha=1;}
      g.restore();
    }
    drawPlayer(g,p,t){
      const speed=Math.hypot(p.vx,p.vy);const walk=speed>15?Math.sin(p.phase)*3:0;const bounce=speed>15?Math.abs(Math.sin(p.phase))*1.4:Math.sin(t*2)*.45;
      ellipse(g,p.x,p.y+4,22,9,'#172d404a');ellipse(g,p.x,p.y+4,17,6,null,'#def5ed5c',1.5);
      g.save();g.translate(p.x,p.y-bounce);if(p.facing==='left')g.scale(-1,1);
      // Petites bottes séparées et combinaison orange, casque hexagonal : pas de silhouette empruntée.
      rounded(g,-12,-10+walk,10,13,4,'#233b52',ink,3);rounded(g,3,-10-walk,10,13,4,'#233b52',ink,3);
      rounded(g,-14,-34,28,29,10,gradient(g,-14,-34,28,10,'#fac176','#ce895d'),ink,3.5);
      rounded(g,-7,-29,14,11,4,'#f6d79d',ink,2);rounded(g,-4,-26,8,4,1,'#365e6e',null);
      rounded(g,-21,-30-walk*.6,9,19,5,'#c77f5b',ink,3);rounded(g,12,-29+walk*.6,9,19,5,'#e8a66d',ink,3);
      rounded(g,-19,-14-walk*.6,7,6,3,'#92aebe',ink,2);rounded(g,14,-13+walk*.6,7,6,3,'#adc9d4',ink,2);
      polygon(g,[[-20,-55],[-11,-65],[12,-65],[21,-55],[21,-38],[12,-30],[-12,-30],[-20,-38]],gradient(g,-17,-64,35,34,'#f3f3de','#adbfc7'),ink,3.5);
      line(g,[[-13,-59],[-8,-61],[10,-61],[16,-56]],'#ffffffaa',2.5);
      if(p.facing==='up'){
        rounded(g,-12,-54,25,14,5,'#94acb8','#647e92',2);line(g,[[-5,-48],[6,-48]],'#cfdee0',2);ellipse(g,1,-43,2,2,'#708b9d',null);
      }else{
        rounded(g,-13,-55,31,17,7,'#16394c',ink,2.5);rounded(g,-7,-50,5,6,2,'#88f5ec',null);rounded(g,7,-50,5,6,2,'#88f5ec',null);line(g,[[-7,-53],[4,-53]],'#599bb0',1.5);
      }
      rounded(g,-24,-49,6,14,3,'#799baa',ink,2);rounded(g,19,-49,6,14,3,'#adc2c8',ink,2);
      line(g,[[13,-63],[16,-72]],ink,3);ellipse(g,17,-74,3,3,'#f6b778',ink,2);
      g.restore();
    }

 drawDoor(g,d,open){
  const horizontal=d.w>d.h;g.save();g.translate(d.x+d.w/2,d.y+d.h/2);if(horizontal)g.rotate(Math.PI/2);
  const span=horizontal?d.w:d.h;
  rounded(g,-18,-span/2-8,36,span+16,7,'#7f9dae',ink,4);
  rounded(g,-12,-span/2,24,span,2,open?'#164139':'#405c76',ink,2);
  if(!open){for(let y=-span/2+8;y<span/2;y+=18)line(g,[[-10,y],[10,y+10]],'#e4b56e',5);}
  else{line(g,[[-14,-span/2],[-14,span/2]],'#8df1be',3);line(g,[[14,-span/2],[14,span/2]],'#8df1be',3);g.clearRect(-10,-span/2,20,span);}
  ellipse(g,0,-span/2-13,5,4,open?'#9affc9':'#ffc078',ink,2);g.restore();
 }
 drawMachine(g,o,on){
  if(this.map.id==='assault-recovery'){
   // Physical drone bay: standby, charging and deployment have distinct poses.
   for(let i=0;i<3;i++){
    const deployed=on&&(o.mode==='formation'||o.mode==='activeCount'||i===0),charging=on&&(o.mode==='droneAction'||o.mode==='assaultFinal')&&i===1;
    const x=o.x+(i-1)*62+(deployed?Math.sin(this.t*.8+i)*9:0),y=o.y+(deployed?Math.sin(this.t*1.5+i)*5:10);
    ellipse(g,x,y+24,26,12,'#203d5044');rounded(g,x-22,y-14,44,34,12,on&&i!==2?'#b4d9d0':'#7f96a4',ink,3);rounded(g,x-15,y-7,30,15,5,'#1d3f50',ink,2);
    for(const dx of [-7,7])ellipse(g,x+dx,y,3,3,on&&i!==2?'#8cf3d2':'#7a8e96');
    line(g,[[x-25,y+9],[x-31,y+18]],ink,4);line(g,[[x+25,y+9],[x+31,y+18]],ink,4);
    if(charging)line(g,[[x,y+22],[x,y+42],[x+26,y+42]],'#efc574',4);
    label(g,String.fromCharCode(65+i),x,y-25,11,'#284f59');
   }
   label(g,on?o.label:'DRONES EN ATTENTE',o.x,o.y+65,12,on?'#173c32':'#314957');return;
  }
  g.save();g.translate(o.x,o.y);ellipse(g,0,14,43,24,'#365568',ink,4);ellipse(g,0,0,39,29,'#b0c5cb',ink,4);
  g.rotate(this.t*(on?1.6:0));for(let i=0;i<6;i++){g.rotate(Math.PI/3);polygon(g,[[8,-5],[18,-22],[27,-8],[13,7]],on?'#81edbe':'#566f7c',ink,2);}g.restore();
  label(g,on?o.label:'HORS LIGNE',o.x,o.y+47,11,on?'#173c32':'#314957');
 }
 render(game,dt){
  this.t+=game.reduce?0:dt;this.scale=this.baseScale*this.zoom;
  const map=this.map,g=this.g,halfW=this.w/this.scale/2,halfH=this.h/this.scale/2;
  const cx=halfW>=map.width/2?map.width/2:Math.max(halfW,Math.min(map.width-halfW,game.player.x));
  const cy=halfH>=map.height/2?map.height/2:Math.max(halfH,Math.min(map.height-halfH,game.player.y-20));
  const damping=1-Math.exp(-dt*8);this.camera.x+=(cx-this.camera.x)*damping;this.camera.y+=(cy-this.camera.y)*damping;
  g.setTransform(this.dpr,0,0,this.dpr,0,0);this.space(g,this.t);g.save();g.translate(this.w/2,this.h/2);g.scale(this.scale,this.scale);g.translate(-this.camera.x,-this.camera.y);
  g.drawImage(this.static,0,0);
  // Open doors leave the passage visible; only jambs remain.
  for(const d of map.doors){if(game.state.opened.includes(d.id)){const vertical=d.h>d.w;for(const end of [0,1])rounded(g,d.x+(vertical?0:end*d.w)-5,d.y+(vertical?end*d.h:0)-5,vertical?d.w+10:10,vertical?10:d.h+10,3,'#90f0c2',ink,2);}else this.drawDoor(g,d,false);}
  const target=game.targetObject();if(target&&!game.state.won){g.setLineDash([5,7]);ellipse(g,target.nav.x,target.nav.y,26,15,null,'#fff4bd',3);g.setLineDash([]);label(g,'PROCHAIN OBJECTIF',target.nav.x,target.nav.y+29,10,'#294352');}
  const items=[...map.objects,{kind:'player',y:game.player.y}].sort((a,b)=>a.y-b.y);
  for(const o of items){if(o.kind==='player')this.drawPlayer(g,game.player,this.t);else if(o.kind==='machine')this.drawMachine(g,o,game.state.active.includes(o.id));else if(o.kind==='exit'){
    const on=game.state.done.includes('repair');ellipse(g,o.nav.x,o.nav.y,43,24,on?'#88efc877':'#e4b57844',on?'#205c49':'#8b6443',3);arrow(g,o.x,o.y+25,true,on?'#94ffce':'#ffc078');tag(g,o.label,o.x,o.y-14,170,on?'#a5f8d6':'#ffcf97');
   }else this.drawPC(g,o,game,this.t);}
  g.restore();
  if(target){const s=this.worldToScreen(target.nav.x,target.nav.y);if(s.x<28||s.x>this.w-28||s.y<28||s.y>this.h-28){g.save();g.translate(Math.max(24,Math.min(this.w-24,s.x)),Math.max(24,Math.min(this.h-24,s.y)));g.rotate(Math.atan2(s.y-this.h/2,s.x-this.w/2));polygon(g,[[12,0],[-9,-8],[-5,0],[-9,8]],'#ffda96',ink,2);g.restore();}}
 }
 minimap(canvas,game){const g=canvas.getContext('2d'),m=this.map,scale=Math.min(canvas.width/m.width,canvas.height/m.height);g.clearRect(0,0,canvas.width,canvas.height);g.save();g.scale(scale,scale);g.fillStyle='#41647a';m.floors.forEach(r=>g.fillRect(r.x,r.y,r.w,r.h));m.doors.forEach(d=>{g.fillStyle=game.state.opened.includes(d.id)?'#81edbe':'#ffc078';g.fillRect(d.x,d.y,d.w,d.h);});m.objects.filter(o=>o.kind!=='machine').forEach(o=>ellipse(g,o.nav.x,o.nav.y,16,16,game.targetObject()?.id===o.id?'#ffe0a3':'#88d1dd'));ellipse(g,game.player.x,game.player.y,22,22,'#ffae71',ink,3);g.restore();}
}
globalThis.StationRenderer=WorldRenderer;
})();

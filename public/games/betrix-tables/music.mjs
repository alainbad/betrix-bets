// Original Betrix compositions. Independent from game outcomes and sound effects.
// Notes, arrangements and synthesised instruments are authored for this collection.
export const TRACKS={
 vault:{title:'After Midnight',bpm:92,root:45,scale:[0,2,3,5,7,8,10],chords:[0,5,3,4],motif:[0,2,4,6,4,2,1,4],voice:'vibes',feel:'noir'},
 roulette:{title:'Rouge et Or',bpm:84,root:48,scale:[0,2,4,5,7,9,11],chords:[0,5,1,4],motif:[4,2,0,1,3,2,6,4],voice:'piano',feel:'lounge'},
 candy:{title:'Candy Clouds',bpm:112,root:60,scale:[0,2,4,5,7,9,11],chords:[0,3,5,4],motif:[0,4,2,5,4,1,3,2],voice:'bell',feel:'playful'},
 thunder:{title:'Sky of the Ancients',bpm:78,root:38,scale:[0,2,3,5,7,8,10],chords:[0,5,3,6],motif:[0,4,7,6,4,2,3,1],voice:'harp',feel:'epic'},
 sugar:{title:'Sugar Starlight',bpm:118,root:57,scale:[0,2,4,6,7,9,11],chords:[0,4,1,5],motif:[2,4,0,6,5,4,1,3],voice:'marimba',feel:'playful'},
 bass:{title:'Harbour at Sunrise',bpm:96,root:43,scale:[0,2,4,5,7,9,11],chords:[0,4,5,3],motif:[0,1,4,2,4,5,2,1],voice:'guitar',feel:'coastal'},
 paw:{title:'A Royal Walk',bpm:104,root:53,scale:[0,2,4,5,7,9,11],chords:[0,1,4,0],motif:[0,2,1,4,3,5,4,2],voice:'marimba',feel:'playful'},
 grand:{title:'The Spotlight',bpm:108,root:46,scale:[0,2,3,5,7,9,10],chords:[0,3,6,4],motif:[0,4,6,4,2,3,1,4],voice:'vibes',feel:'show'},
 blackjack:{title:'Midnight Twenty One',bpm:86,root:50,scale:[0,2,3,5,7,9,10],chords:[0,3,1,4],motif:[2,4,6,5,3,1,0,2],voice:'piano',feel:'noir'},
 baccarat:{title:'Silk and Silver',bpm:80,root:51,scale:[0,2,4,5,7,9,11],chords:[0,5,3,4],motif:[4,6,5,2,3,1,2,0],voice:'vibes',feel:'lounge'},
 'prive-blackjack':{title:'The Private Hour',bpm:74,root:45,scale:[0,2,3,5,7,9,10],chords:[0,1,3,4],motif:[0,2,6,4,5,3,1,2],voice:'piano',feel:'lounge'},
 'prive-baccarat':{title:'Champagne Nocturne',bpm:72,root:49,scale:[0,2,4,5,7,9,11],chords:[0,3,1,4],motif:[2,0,4,6,5,2,1,3],voice:'harp',feel:'lounge'},
 'prive-roulette':{title:'Golden Orbit',bpm:82,root:46,scale:[0,2,3,5,7,8,10],chords:[0,5,6,4],motif:[4,3,2,0,6,4,5,2],voice:'vibes',feel:'noir'},
 'azure-blackjack':{title:'Blue Hour',bpm:94,root:42,scale:[0,2,3,5,7,9,10],chords:[0,3,5,4],motif:[0,3,4,6,2,5,4,1],voice:'keys',feel:'azure'},
 'azure-roulette':{title:'Sapphire Motion',bpm:100,root:47,scale:[0,2,3,5,7,9,10],chords:[0,6,3,4],motif:[4,0,2,5,6,3,1,4],voice:'keys',feel:'azure'}
};
export function trackKey(path,search=''){
 const query=new URLSearchParams(search).get('table');
 if(query&&TRACKS[query.replace(/^velvet-/,'')])return query.replace(/^velvet-/,'');
 if(/\/vip\/|\/betrix-vip\//.test(path))return 'prive-blackjack';
 const name=path.split('/').pop().replace(/\.html$/,'');return TRACKS[name]?name:null;
}
const hz=n=>440*2**((n-69)/12);
export function degree(cfg,n){return cfg.root+12*Math.floor(n/7)+cfg.scale[((n%7)+7)%7]}
// A stable score: sixteen bars, two complementary eight-bar phrases.
export function scoreFor(key){const c=TRACKS[key],beat=60/c.bpm,notes=[];
 for(let bar=0;bar<16;bar++){
  const chord=c.chords[Math.floor(bar/2)%4],start=bar*4*beat,part=bar<8?0:1;
  notes.push({instrument:'pad',at:start,duration:4*beat,degrees:[chord,chord+2,chord+4,chord+6],level:c.feel==='epic'?.14:.08});
  for(let b=0;b<4;b++)notes.push({instrument:'bass',at:start+b*beat,duration:beat*.78,midi:degree(c,chord+(b%2?4:0))-12,level:.16});
  for(let step=0;step<8;step++){
   if((bar%4===3&&step>4)||(c.feel==='lounge'&&step%3===1))continue;
   const n=c.motif[(step+bar*2)%8]+chord+(part&&step%3===0?2:0)+7;
   notes.push({instrument:c.voice,at:start+(step*.5+(step%2&&['lounge','noir'].includes(c.feel)?.08:0))*beat,duration:beat*(step%4===3?1.5:.8),midi:degree(c,n),level:.095*(step%2?.75:1)});
  }
  if(['epic','coastal','playful'].includes(c.feel))for(let step=0;step<8;step++)notes.push({instrument:c.feel==='coastal'?'guitar':'harp',at:start+step*.5*beat,duration:beat*1.2,midi:degree(c,chord+[0,4,2,6,4,2,6,4][step]+7),level:.035});
  for(let b=0;b<4;b++){
   if(b===0||b===2)notes.push({instrument:'kick',at:start+b*beat,duration:.28,level:c.feel==='epic'?.2:.1});
   if(b===1||b===3)notes.push({instrument:'brush',at:start+b*beat,duration:.15,level:c.feel==='epic'?.025:.045});
   if(!['epic','lounge'].includes(c.feel))for(let sub=0;sub<2;sub++)notes.push({instrument:'hat',at:start+(b+sub*.5)*beat,duration:.06,level:sub?.018:.027});
  }
 }
 return {notes,seconds:64*beat};
}
async function renderLoop(key){
 const cfg=TRACKS[key],score=scoreFor(key),rate=32000,tail=4,ctx=new OfflineAudioContext(2,Math.ceil((score.seconds+tail)*rate),rate);
 const mix=ctx.createGain(),dry=ctx.createGain(),reverb=ctx.createConvolver(),wet=ctx.createGain(),limit=ctx.createDynamicsCompressor();
 dry.gain.value=.8;wet.gain.value=cfg.feel==='epic'?.34:.19;mix.connect(dry);dry.connect(limit);mix.connect(reverb);reverb.connect(wet);wet.connect(limit);limit.connect(ctx.destination);limit.threshold.value=-14;limit.knee.value=15;limit.ratio.value=4;
 let seed=317;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const impulse=ctx.createBuffer(2,rate*2.6,rate);for(let ch=0;ch<2;ch++){const a=impulse.getChannelData(ch);for(let i=0;i<a.length;i++)a[i]=(random()*2-1)*Math.exp(-i/(rate*.5))*.55}reverb.buffer=impulse;
 const noise=ctx.createBuffer(1,rate,rate);for(let a=noise.getChannelData(0),i=0;i<a.length;i++)a[i]=random()*2-1;
 function voice(midi,at,duration,kind,level,pan=0){const gain=ctx.createGain(),panner=ctx.createStereoPanner(),filter=ctx.createBiquadFilter();panner.pan.value=pan;filter.type='lowpass';filter.frequency.value=kind==='pad'?1600:kind==='bass'?700:6000;gain.connect(filter);filter.connect(panner);panner.connect(mix);
  const attack=kind==='pad'?.65:kind==='keys'?.02:.008,release=kind==='pad'?1.5:kind==='bass'?.08:.6,end=at+duration+release;
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+Math.min(attack,duration*.45));gain.gain.exponentialRampToValueAtTime(Math.max(.0001,level*(kind==='pad'?.65:.2)),at+duration);gain.gain.exponentialRampToValueAtTime(.0001,end);
  const partials=kind==='bell'?[[1,1],[2.76,.23],[5.4,.08]]:kind==='marimba'?[[1,1],[4,.14]]:kind==='piano'?[[1,1],[2,.25],[3,.12]]:kind==='guitar'||kind==='harp'?[[1,1],[2,.35],[3,.18],[4,.06]]:kind==='pad'?[[1,.6],[1.003,.4],[2,.08]]:[[1,1],[2,.15]];
  for(const [partial,amp]of partials){const o=ctx.createOscillator(),g=ctx.createGain();o.type=kind==='bass'?'triangle':'sine';o.frequency.value=hz(midi)*partial;g.gain.value=amp;o.connect(g);g.connect(gain);o.start(at);o.stop(end+.02)}
 }
 for(const n of score.notes){if(n.instrument==='pad'){n.degrees.forEach((d,i)=>voice(degree(cfg,d),n.at,n.duration,'pad',n.level/4,(i-1.5)*.35));continue}
 if(['kick','brush','hat'].includes(n.instrument)){const g=ctx.createGain();g.connect(mix);g.gain.setValueAtTime(n.level,n.at);g.gain.exponentialRampToValueAtTime(.0001,n.at+n.duration);if(n.instrument==='kick'){const o=ctx.createOscillator();o.frequency.setValueAtTime(cfg.feel==='epic'?100:85,n.at);o.frequency.exponentialRampToValueAtTime(40,n.at+n.duration);o.connect(g);o.start(n.at);o.stop(n.at+n.duration)}else{const s=ctx.createBufferSource(),f=ctx.createBiquadFilter();s.buffer=noise;f.type='highpass';f.frequency.value=n.instrument==='hat'?6500:2100;s.connect(f);f.connect(g);s.start(n.at,0,n.duration)}continue}
 voice(n.midi,n.at,n.duration,n.instrument,n.level,n.instrument==='bass'?0:Math.sin(n.at)*.22)}
 const rendered=await ctx.startRendering(),length=Math.round(score.seconds*rate),buffer=ctx.createBuffer(2,length,rate);let peak=0;
 for(let ch=0;ch<2;ch++){const src=rendered.getChannelData(ch),dst=buffer.getChannelData(ch);dst.set(src.subarray(0,length));for(let i=length;i<src.length;i++)dst[i-length]+=src[i];for(const v of dst)peak=Math.max(peak,Math.abs(v))}
 const scale=.7/Math.max(peak,.7);for(let ch=0;ch<2;ch++){const a=buffer.getChannelData(ch);for(let i=0;i<a.length;i++)a[i]*=scale;const seam=Math.min(160,a.length);for(let i=0;i<seam;i++){const t=i/seam;a[a.length-seam+i]=a[a.length-seam+i]*(1-t)+a[i]*t}}
 return buffer;
}
export class GameMusic{
 constructor(key){this.key=key;this.ctx=null;this.source=null;this.buffer=null;this.rendering=null;this.enabled=true;this.volume=.24;this.unlocked=false;this.started=0;this.offset=0;this.disposed=false;this.generation=0;
  try{const p=JSON.parse(localStorage.getItem('betrix-music')||'{}');this.enabled=p.enabled!==false;if(Number.isFinite(p.volume))this.volume=Math.max(0,Math.min(1,p.volume))}catch{}
 }
 save(){try{localStorage.setItem('betrix-music',JSON.stringify({enabled:this.enabled,volume:this.volume}))}catch{}}
 async play(){if(!this.unlocked||!this.enabled||document.hidden||this.disposed)return;this.ctx??=new(window.AudioContext||window.webkitAudioContext)();await this.ctx.resume();if(this.source)return;const version=this.generation;
  this.rendering??=renderLoop(this.key);this.buffer??=await this.rendering;if(version!==this.generation||this.source||!this.enabled||document.hidden||this.disposed)return;
  this.output??=this.ctx.createGain();this.output.disconnect();this.output.connect(this.ctx.destination);const t=this.ctx.currentTime;this.output.gain.setValueAtTime(0,t);this.output.gain.linearRampToValueAtTime(this.volume,t+1);
  this.source=this.ctx.createBufferSource();this.source.buffer=this.buffer;this.source.loop=true;this.source.connect(this.output);this.started=t;this.source.start(t,this.offset%this.buffer.duration);
 }
 pause(){this.generation++;if(!this.source)return;this.offset=(this.offset+this.ctx.currentTime-this.started)%this.buffer.duration;this.source.stop();this.source.disconnect();this.source=null;this.ctx.suspend()}
 setEnabled(value){this.enabled=value;this.save();if(value)return this.play();this.pause()}
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));this.save();if(this.output&&this.ctx)this.output.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.08)}
 dispose(){this.pause();this.disposed=true;this.ctx?.close()}
}
function mount(key){if(!key||document.querySelector('#betrix-music'))return;const music=new GameMusic(key),box=document.createElement('details');box.id='betrix-music';box.innerHTML='<summary aria-label="Background music controls">♫ Music</summary><div><strong></strong><label><input type="checkbox"> Background music</label><label>Volume <input type="range" min="0" max="100" aria-label="Music volume"></label><small>Starting automatically…</small></div>';document.body.append(box);
 const style=document.createElement('style');style.textContent='#betrix-music{position:fixed;bottom:12px;left:12px;z-index:150;color:#f8efd8;font:13px system-ui,sans-serif}#betrix-music summary{cursor:pointer;list-style:none;padding:9px 13px;background:#101821ed;border:1px solid #e5c98c66;border-radius:20px;box-shadow:0 3px 18px #0005}#betrix-music>div{position:absolute;bottom:45px;left:0;width:240px;padding:16px;background:#101821fa;border:1px solid #e5c98c66;border-radius:12px;box-shadow:0 8px 35px #0008}#betrix-music strong{display:block;margin-bottom:14px;color:#e9d299}#betrix-music label{display:flex;align-items:center;gap:8px;margin:12px 0}#betrix-music input[type=range]{width:140px;accent-color:#d9bd7f}#betrix-music input[type=checkbox]{accent-color:#d9bd7f}#betrix-music small{display:block;color:#adb9c9;font-size:12px}';document.head.append(style);
 box.querySelector('strong').textContent=TRACKS[key].title;const toggle=box.querySelector('[type=checkbox]'),volume=box.querySelector('[type=range]'),status=box.querySelector('small');toggle.checked=music.enabled;volume.value=music.volume*100;
 const start=()=>{music.unlocked=true;music.play().then(()=>{status.textContent=music.enabled?'Original Betrix soundtrack':'Music muted'}).catch(()=>{status.textContent='Tap Music to retry';music.rendering=null})};
 start();document.addEventListener('pointerdown',start);document.addEventListener('keydown',e=>{if(!e.repeat)start()});toggle.onchange=()=>{music.unlocked=true;music.setEnabled(toggle.checked)?.catch(()=>{status.textContent='Tap Music to retry'});status.textContent=toggle.checked?'Original Betrix soundtrack':'Music muted'};volume.oninput=()=>music.setVolume(Number(volume.value)/100);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)music.pause();else music.play().catch(()=>{})});window.addEventListener('pagehide',()=>music.pause());window.addEventListener('pageshow',()=>music.play().catch(()=>{}));
 window.addEventListener('storage',e=>{if(e.key!=='betrix-music')return;try{const p=JSON.parse(e.newValue||'{}');music.volume=Number.isFinite(p.volume)?Math.max(0,Math.min(1,p.volume)):.24;music.enabled=p.enabled!==false;if(music.output&&music.ctx)music.output.gain.setTargetAtTime(music.volume,music.ctx.currentTime,.08);if(music.enabled)music.play().catch(()=>{});else music.pause();toggle.checked=music.enabled;volume.value=music.volume*100}catch{}});
}
if(typeof document!=='undefined')mount(trackKey(location.pathname,location.search));

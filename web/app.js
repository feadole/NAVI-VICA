/* ===================================================================
   NAVI-VICA v5 — voice-first care companion.
   All vision runs on-device (YOLOv9 ONNX). Nothing leaves the phone
   except map/place lookups and links you deliberately open.
   =================================================================== */
"use strict";

/* ---------- signed-in account (auth.js owns the store) ---------- */
const GLS = (k,d) => { try{ const v=localStorage.getItem(k); return v===null?d:v; }catch(e){ return d; } };
const GSAVE = (k,v) => { try{ localStorage.setItem(k,v); }catch(e){} };
let CURRENT = "";        // active account id
let ACCT = null;         // active account object
const acct = () => ACCT;

/* per-account storage: every key is namespaced by the signed-in person */
const PFX = () => "nv." + (CURRENT || "guest") + ".";
const LS = (k, d) => { try { const v = localStorage.getItem(PFX()+k); return v===null?d:v; } catch(e){ return d; } };
const save = (k,v) => { try{ localStorage.setItem(PFX()+k, v);
  if (window.SYNC && CURRENT) SYNC.noteLocalChange(); }catch(e){} };

const S = {
  lang:(navigator.language||"en").startsWith("ru")?"ru":"en",
  profile:"vision", conf:45, model:"t", verb:"brief", rate:95,
  haptic:true, spatial:true, checkin:0, fall:false, scale:100, flash:false, conditions:[]
};
function loadS(){
  S.lang = LS("nv.lang", S.lang);
  S.profile = LS("nv.profile","vision");
  S.conf = parseInt(LS("nv.conf","45"),10);
  S.model = LS("nv.model","t");
  S.verb = LS("nv.verb","brief");
  S.rate = parseInt(LS("nv.rate","95"),10);
  S.haptic = LS("nv.haptic","1")==="1";
  S.spatial = LS("nv.spatial","1")==="1";
  S.checkin = parseInt(LS("nv.checkin","0"),10);
  S.fall = LS("nv.fall","0")==="1";
  S.scale = parseInt(LS("nv.scale","100"),10);
  S.flash = LS("nv.flash","0")==="1";
  S.conditions = (acct() && acct().conditions) || [];
  if (!I18N[S.lang]) S.lang = "en";
}

const T = (k, vars) => {
  let s = (I18N[S.lang].t && I18N[S.lang].t[k] !== undefined) ? I18N[S.lang].t[k] : I18N.en.t[k];
  if (Array.isArray(s)) s = s[Math.floor(Math.random()*s.length)];
  if (typeof s !== "string") return s;
  for (const [a,b] of Object.entries(vars||{})) s = s.split("{"+a+"}").join(b);
  return s;
};
const TO = (k) => (I18N[S.lang].t && I18N[S.lang].t[k]) || I18N.en.t[k];
const CHAT = (k) => (I18N[S.lang].chat && I18N[S.lang].chat[k]) || I18N.en.chat[k];
const R = (a) => a[Math.floor(Math.random()*a.length)];
const fill = (s,v) => { for (const [a,b] of Object.entries(v||{})) s = s.split("{"+a+"}").join(b); return s; };
const objName = (c) => S.lang === "ru" ? (OBJ_RU[c]||c) : c;
const colourName = (c) => S.lang === "ru" ? (COLOURS_RU[c]||c) : (COLOURS_EN[c]||c);

const $ = (id) => document.getElementById(id);
const el = {};
"langSelect profileSelect greetText statusDot statusText micBtn liveLine barMic barHome barHomeLabel barRepeat barRepeatLabel \
\
detTitle video overlay camIdle profileBadge torchBtn detBtn detBtnLabel detStop detStopLabel detResult confLabel confRange confVal \
verbLabel verbSelect modelLabel modelSelect \
navTitle navQuery navGo navChips map navInfo navStop navStopLabel gmapsLink ymapsLink \
alarmTitle alarmTime alarmLabel alarmAdd alarmAddLabel alarmList apptTitle apptTime apptLabel apptAdd apptList \
sosTitle sosCall sosCallLabel ambCall ambLabel shareLoc shareLocLabel sosList sosName sosPhone sosAdd sosAddLabel \
fallTitle fallLabel fallToggle fallNote \
chatTitle chatLog chatInput chatSend \
readTitle readHint readVideo readIdle readStart readStartLabel readShot readShotLabel readResult \
findTitle findHint findList \
capTitle capHint capStart capStartLabel capStop capStopLabel capBox \
notesTitle noteInput noteAdd noteSpeak noteSpeakLabel noteList \
svcTitle cabTitle cabYandex cabUber cabNote foodTitle foodYandex foodUber pharmTitle pharmFind pharmFindLabel \
scamTitle scamInput scamCheck scamResult \
healthTitle medCard medSpeak medSpeakLabel medEditTitle mcName mcCond mcAllergy mcBlood mcSave mcSaveLabel \
logTitle logSummary logExport logExportLabel \
setTitle rateLabel rateRange rateVal hapticLabel hapticToggle spatialLabel spatialToggle checkinLabel checkinSelect \
battLabel battVal caregiverTitle caregiverNote cfgExport cfgExportLabel cfgImport cfgImportLabel panicBtn panicLabel \
helpTitle rehearseBtn rehearseLabel rehearseBox helpList \
panic panicText panicCall panicClose \
acctBtn \
orientCard orientText aacStrip homeGrid allFeaturesBtn allFeaturesLabel allTitle allGrid greetText \
symTitle symHint symChips vitalName vitalVal vitalAdd vitalAddLabel symList flash \
guideBtn guideBtnLabel guideTitle guideIntro guideList guideSpeak guideSpeakLabel guidePractice guidePracticeLabel profileLabel".split(/\s+/).forEach(id => el[id] = $(id));

/* catalogue of every feature tile (icon + i18n label key + target view) */
const FEATURES = {
  detect:{ico:"👁",k:"tileDetect",cls:"t-detect"}, nav:{ico:"🧭",k:"tileNav",cls:"t-nav"},
  alarms:{ico:"⏰",k:"tileAlarms",cls:"t-alarm"}, sos:{ico:"🆘",k:"tileSos",cls:"t-sos"},
  chat:{ico:"💬",k:"tileChat"}, read:{ico:"📖",k:"tileRead"}, find:{ico:"🔍",k:"tileFind"},
  captions:{ico:"👂",k:"tileCaptions"}, notes:{ico:"📝",k:"tileNotes"}, services:{ico:"🚕",k:"tileServices"},
  health:{ico:"❤️",k:"tileHealth"}, symptoms:{ico:"🩺",k:"symTitle"}, settings:{ico:"⚙️",k:"tileSettings"},
  help:{ico:"🎓",k:"tileHelp"}
};
/* which tiles lead each condition's home (kept short & simple) */
const HOME_FOR = {
  vision:["detect","read","nav","sos"],
  hearing:["captions","alarms","nav","sos"],
  motor:["sos","nav","alarms","chat"],
  cognitive:["chat","alarms","sos","find"],
  speech:["chat","alarms","sos","nav"],
  chronic:["alarms","symptoms","health","sos"],
  mood:["chat","alarms","nav","sos"],
  _default:["detect","nav","alarms","sos"]
};

/* ---------- event log (for the doctor summary) ---------- */
let LOG = JSON.parse(LS("nv.log","[]"));
function logEvent(kind, detail){
  LOG.push({t:Date.now(), kind, detail:detail||""});
  if (LOG.length > 500) LOG = LOG.slice(-500);
  save("nv.log", JSON.stringify(LOG));
}

/* ---------- view routing ---------- */
let currentView = "home";
function openView(id){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const v = $(id); if (!v) return;
  v.classList.add("active"); currentView = id;
  document.body.classList.toggle("on-auth", v.classList.contains("auth"));
  if (id === "nav" && mapObj) setTimeout(()=>mapObj.invalidateSize(), 180);
  if (id === "chat") setTimeout(()=>{ el.chatLog.parentElement.scrollTop = el.chatLog.parentElement.scrollHeight; }, 60);
  if (id === "find") renderFind();
  if (id === "health"){ renderMedCard(); renderLog(); }
  if (id === "symptoms"){ renderSymChips(); renderSym(); }
  if (id === "account" && window.AUTH){ AUTH.renderAccount(); }
  if (id === "help") renderHelp();
  if (id !== "detect" && detecting) stopDetect(false);
  if (id !== "read" && readStream) stopRead();
}
document.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", ()=>openView(b.dataset.open)));
document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", ()=>{
  /* a guest exploring chat or voice from the welcome screen goes back there */
  if (window.AUTH && !AUTH.current()){ AUTH.start(); return; }
  openView("home"); speakAck(T("barHome"));
}));
el.barHome.addEventListener("click", ()=>openView("home"));

/* ---------- haptics & tones ---------- */
function buzz(pattern){ if (S.haptic && navigator.vibrate) try{ navigator.vibrate(pattern); }catch(e){} }
const HAPTIC = { obstacle:[120], person:[80,60,80], danger:[400], ok:[40], alarm:[200,120,200,120,200] };
let audioCtx = null;
function ac(){ if (!audioCtx) { try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return audioCtx; }
function tone(freq, dur, pan){
  const c = ac(); if (!c) return;
  try{
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = freq;
    let node = g;
    if (S.spatial && c.createStereoPanner){ const p = c.createStereoPanner(); p.pan.value = pan||0; g.connect(p); p.connect(c.destination); }
    else g.connect(c.destination);
    o.connect(g);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, c.currentTime+0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+dur);
    o.start(); o.stop(c.currentTime+dur+0.05);
  }catch(e){}
}
function chime(){ tone(523,0.5,0); setTimeout(()=>tone(659,0.6,0),260); buzz(HAPTIC.alarm); if (typeof flashAlert==="function") flashAlert(); }

/* ---------- speech out ---------- */
let voices = [];
const loadVoices = () => { voices = speechSynthesis.getVoices(); populateVoicePicker(); };
loadVoices();
if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = loadVoices;

/* Pick the most natural-sounding voice the device offers for a language.
   Modern systems ship neural/natural voices — prefer those over the old
   robotic defaults. A person can still override per language in Settings. */
const VOICE_QUALITY = [/natural/i, /neural/i, /premium/i, /enhanced/i, /online/i, /google/i, /siri/i, /aria|jenny|guy|sonia|denise|katja|elvira|nanami|xiaoxiao|sunhi|swara|isabella|colette|sofie|zofia|polina|dilara|hamed|salma/i];
function voicesFor(code){
  const short = (code||"en").split("-")[0];
  const exact = voices.filter(v=>v.lang===code || (v.lang||"").replace("_","-")===code);
  const loose = voices.filter(v=>(v.lang||"").replace("_","-").startsWith(short) && !exact.includes(v));
  return exact.concat(loose);
}
function bestVoice(code){
  const cands = voicesFor(code);
  if (!cands.length) return null;
  const saved = GLS("nv.voice." + code.split("-")[0], "");
  if (saved){ const v = cands.find(x=>x.name===saved); if (v) return v; }
  for (const rx of VOICE_QUALITY){ const v = cands.find(x=>rx.test(x.name)); if (v) return v; }
  return cands[0];
}
function populateVoicePicker(){
  const sel = document.getElementById("voiceSelect");
  if (!sel) return;
  const code = (window.I18N && I18N[S.lang] && I18N[S.lang].tts) || "en-US";
  const cands = voicesFor(code);
  sel.innerHTML = "";
  const chosen = bestVoice(code);
  cands.forEach(v=>{
    const o = document.createElement("option");
    o.value = v.name; o.textContent = v.name.replace(/^(Microsoft|Google|Apple)\s*/,"");
    if (chosen && v.name === chosen.name) o.selected = true;
    sel.append(o);
  });
  sel.disabled = !cands.length;
}

let speaking = false, lastSpoken = "";
function setMic(state){
  el.micBtn.className = "mic " + state;
  el.barMic.className = "bar-mic " + state;
  el.statusDot.style.background = state==="listen" ? "var(--green)" : state==="speak" ? "var(--red)" : "var(--blue)";
  el.statusText.textContent = state==="listen" ? T("statusListening") : state==="speak" ? T("statusSpeaking") : T("statusIdle");
}
function utter(text, rate){
  const u = new SpeechSynthesisUtterance(text);
  const code = I18N[S.lang].tts || "en-US";
  u.lang = code; u.rate = (rate||S.rate)/100; u.pitch = 1.02;
  const v = bestVoice(code);
  if (v) u.voice = v;
  return u;
}
/* iPhones mute speech that was not "unlocked" by a screen touch. The very
   first tap anywhere quietly unlocks the voice, so replies to spoken
   commands (which arrive outside any tap) are always audible. */
let ttsUnlocked = false;
function unlockTTS(){
  if (ttsUnlocked) return; ttsUnlocked = true;
  try{
    speechSynthesis.resume();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0; u.rate = 2;
    speechSynthesis.speak(u);
  }catch(e){}
}
document.body.addEventListener("pointerdown", unlockTTS, true);
document.body.addEventListener("touchstart", unlockTTS, true);

function speak(text, opts){
  opts = opts || {};
  if (!text) return;
  lastSpoken = text;
  el.liveLine.textContent = text;
  if (opts.mirror !== false) addBubble("vica", text);
  try{
    speechSynthesis.cancel();
    speechSynthesis.resume();   /* iOS can wedge in a paused state — always clear it */
    /* phones speak sentence by sentence far more naturally — the voice
       breathes between thoughts instead of droning through a paragraph */
    const parts = String(text).match(/[^.!?…]+[.!?…]+["»”)]?\s*|[^.!?…]+$/g) || [text];
    parts.forEach((p, i)=>{
      p = p.trim(); if (!p) return;
      const u = utter(p);
      if (i === 0) u.onstart = () => { speaking = true; pauseListening(); setMic("speak"); startSynthKeepalive(); };
      if (i === parts.length - 1) u.onend = u.onerror = () => { stopSynthKeepalive(); speaking = false; setMic("idle"); setTimeout(resumeListening, 300); };
      speechSynthesis.speak(u);
    });
  }catch(e){ speaking = false; }
}
/* iPhones stop long sentences halfway unless the voice is nudged along */
let synthKeepalive = null;
function startSynthKeepalive(){
  stopSynthKeepalive();
  synthKeepalive = setInterval(()=>{ try{ speechSynthesis.resume(); }catch(e){} }, 5000);
}
function stopSynthKeepalive(){ if (synthKeepalive){ clearInterval(synthKeepalive); synthKeepalive = null; } }
/* short acknowledgement that does NOT stop the microphone */
function speakAck(text){
  lastSpoken = text; el.liveLine.textContent = text; addBubble("vica", text);
  try{ speechSynthesis.resume(); speechSynthesis.speak(utter(text, 105)); }catch(e){}
}
function addBubble(who, text){
  const d = document.createElement("div");
  d.className = "bubble " + who; d.textContent = text;
  el.chatLog.append(d);
  const sc = el.chatLog.parentElement; sc.scrollTop = sc.scrollHeight;
  while (el.chatLog.children.length > 80) el.chatLog.firstChild.remove();
}

/* ---------- listening: wake word + command ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, mode = "off", wantListen = false;
/* every way a microphone mishears her name still wakes her */
const WAKE_RX = /(vica|vika|veca|vicka|veeka|weka|wika|viika|weaker|wicker|wicca|vicar|because a|викк?а|вика|віка|фика|фіка|ヴィカ|ビカ|びか|维卡|薇卡|微卡|비카|비까|वीका|विका|فيكا|ویکا|βίκα)/i;

function killRec(){ if(!rec) return; try{ rec.onresult=rec.onend=rec.onerror=null; }catch(e){} try{ rec.abort(); }catch(e){} rec=null; }
function pauseListening(){ if (mode==="cmd") return; killRec(); mode = wantListen ? "paused" : "off"; }
/* A conversation, not a walkie-talkie: right after VICA answers, the mic
   opens for the reply — no need to say the wake word between turns. If
   the person stays quiet, she settles back to waiting for "Hey VICA". */
let followUp = false;
function resumeListening(){
  if (!(wantListen && !speaking && mode!=="cmd" && !captionsOn)) return;
  if (followUp){ followUp = false; startCommand(true); }
  else startWake();
}

function startWake(){
  if (!SR || captionsOn) return;
  killRec(); mode = "wake"; setMic("idle");
  wakeStarted = Date.now();
  try{
    rec = new SR();
    rec.continuous = true; rec.interimResults = true;
    rec.lang = I18N[S.lang].tts || "en-US";
    rec.onresult = (e) => {
      let txt = "";
      for (let i=e.resultIndex;i<e.results.length;i++) txt += e.results[i][0].transcript + " ";
      if (WAKE_RX.test(txt)){
        const after = txt.split(WAKE_RX).pop().trim();
        killRec();
        if (after && after.length > 3){ addBubble("user", after); handle(after); }
        else { startCommand(); speakAck(T("yes")); }   /* answers AND keeps listening */
      }
    };
    rec.onerror = (e) => { if (e.error === "not-allowed"){ wantListen = false; el.liveLine.textContent = T("micBlocked"); } };
    rec.onend = () => {
      if (mode==="wake" && wantListen && !speaking && !captionsOn){
        /* a session that dies instantly means the mic is being fought over —
           back off instead of spinning the battery (this was the lag) */
        wakeRetryDelay = (Date.now() - wakeStarted < 1500) ? Math.min(wakeRetryDelay * 2, 4000) : 350;
        setTimeout(startWake, wakeRetryDelay);
      }
    };
    rec.start();
  }catch(e){ setTimeout(()=>{ if (wantListen && !speaking) startWake(); }, 1200); }
}
let wakeRetryDelay = 350, wakeStarted = 0;
function startCommand(quiet){
  if (!SR) return;
  killRec(); mode = "cmd"; setMic("listen");
  try{
    rec = new SR();
    rec.continuous = false; rec.interimResults = true;
    rec.lang = I18N[S.lang].tts || "en-US";
    let fin = "", timer = null;
    /* speech adaptation: allow long pauses for slow or tremulous speech */
    const arm = () => { clearTimeout(timer); timer = setTimeout(()=>{ try{ rec.stop(); }catch(e){} }, 7000); };
    rec.onresult = (e) => {
      arm();
      for (let i=e.resultIndex;i<e.results.length;i++){
        el.liveLine.textContent = "“" + e.results[i][0].transcript + "”";
        if (e.results[i].isFinal) fin = e.results[i][0].transcript.trim();
      }
    };
    rec.onerror = () => { setMic("idle"); mode="off"; keepListening(); };
    rec.onend = () => {
      clearTimeout(timer); setMic("idle"); mode = "off";
      if (fin){ addBubble("user", fin); handle(fin); }
      else if (!quiet){ speak(T("didntCatch")); }
      keepListening();
    };
    rec.start(); arm();
  }catch(e){ setMic("idle"); mode="off"; }
}
/* VICA never stops paying attention: after every command, reply or error
   the wake-word ear comes back on its own (unless the mic was blocked). */
function keepListening(){
  setTimeout(()=>{ if (wantListen && !speaking && mode==="off" && !captionsOn) startWake(); }, 500);
}
function micTap(){
  wantListen = true; GSAVE("nv.listen","1"); ac();
  if (speaking){ speechSynthesis.cancel(); speaking = false; }
  if (mode === "cmd") return;
  startCommand();
}
el.micBtn.addEventListener("click", micTap);
el.barMic.addEventListener("click", micTap);
el.barRepeat.addEventListener("click", ()=> speak(lastSpoken || T("repeatNone")));

/* ===================================================================
   VISION — YOLOv9 on-device + profile layer
   =================================================================== */
const YOLO_MODELS = {
  t:"https://huggingface.co/Kalray/yolov9/resolve/main/yolov9t.onnx",
  s:"https://huggingface.co/Kalray/yolov9/resolve/main/yolov9s.onnx",
  c:"https://huggingface.co/Kalray/yolov9/resolve/main/yolov9c.onnx"
};
const COCO80=["person","bicycle","car","motorcycle","airplane","bus","train","truck","boat","traffic light","fire hydrant","stop sign","parking meter","bench","bird","cat","dog","horse","sheep","cow","elephant","bear","zebra","giraffe","backpack","umbrella","handbag","tie","suitcase","frisbee","skis","snowboard","sports ball","kite","baseball bat","baseball glove","skateboard","surfboard","tennis racket","bottle","wine glass","cup","fork","knife","spoon","bowl","banana","apple","sandwich","orange","broccoli","carrot","hot dog","pizza","donut","cake","chair","couch","potted plant","bed","dining table","toilet","tv","laptop","mouse","remote","keyboard","cell phone","microwave","oven","toaster","sink","refrigerator","book","clock","vase","scissors","teddy bear","hair drier","toothbrush"];
const YSIZE=640, RAW_FLOOR=0.22, IOU_T=0.45;
const prep = document.createElement("canvas"); prep.width=YSIZE; prep.height=YSIZE;
let session=null, sessionModel=null, inputName="images", busy=false;

async function loadModel(){
  if (session && sessionModel === S.model) return session;
  speak(T("modelLoading"));
  ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/";
  session = await ort.InferenceSession.create(YOLO_MODELS[S.model], {executionProviders:["wasm"], graphOptimizationLevel:"all"});
  sessionModel = S.model; inputName = session.inputNames[0];
  speak(T("modelReady"));
  return session;
}
let lastLuma = 255;
function letterbox(){
  const vw = el.video.videoWidth, vh = el.video.videoHeight;
  const r = Math.min(YSIZE/vw, YSIZE/vh), nw = Math.round(vw*r), nh = Math.round(vh*r);
  const px = (YSIZE-nw)/2, py = (YSIZE-nh)/2;
  const ctx = prep.getContext("2d",{willReadFrequently:true});
  ctx.fillStyle="#727272"; ctx.fillRect(0,0,YSIZE,YSIZE);
  ctx.drawImage(el.video,px,py,nw,nh);
  const img = ctx.getImageData(0,0,YSIZE,YSIZE), data = img.data;
  /* mean luminance for low-light handling */
  let sum=0; for (let i=0;i<data.length;i+=4*97) sum += (data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114);
  lastLuma = sum / (data.length/(4*97));
  /* gentle auto gain when dark (helps detection, like CLAHE in the thesis) */
  const gain = lastLuma < 60 ? Math.min(2.2, 90/Math.max(lastLuma,12)) : 1;
  const n = YSIZE*YSIZE, x = new Float32Array(3*n);
  for (let i=0;i<n;i++){
    x[i]      = Math.min(255, data[i*4]  *gain)/255;
    x[n+i]    = Math.min(255, data[i*4+1]*gain)/255;
    x[2*n+i]  = Math.min(255, data[i*4+2]*gain)/255;
  }
  return {x,r,px,py};
}
function iou(a,b){
  const x1=Math.max(a[0],b[0]), y1=Math.max(a[1],b[1]);
  const x2=Math.min(a[0]+a[2],b[0]+b[2]), y2=Math.min(a[1]+a[3],b[1]+b[3]);
  const it=Math.max(0,x2-x1)*Math.max(0,y2-y1);
  return it/(a[2]*a[3]+b[2]*b[3]-it);
}
function nms(d,thr){
  d.sort((a,b)=>b.score-a.score); const keep=[];
  for (const x of d){ let ok=true; for (const k of keep) if (k.cls===x.cls && iou(k.box,x.box)>thr){ok=false;break;} if(ok) keep.push(x); }
  return keep;
}
function decodeYolo(data,dims,thr){
  let nc,na,layout;
  if (dims[1]>6 && dims[1]<dims[2]){ nc=dims[1]-4; na=dims[2]; layout="CA"; }
  else if (dims[2]>6){ nc=dims[2]-4; na=dims[1]; layout="AC"; }
  else { const out=[]; for(let k=0;k<dims[1];k++){ const o=k*6,s=data[o+4];
    if(s>=thr) out.push({cls:data[o+5]|0,score:s,box:[data[o],data[o+1],data[o+2]-data[o],data[o+3]-data[o+1]]}); } return out; }
  const cand=[];
  for (let a=0;a<na;a++){
    let best=0,bi=-1;
    for (let c=0;c<nc;c++){ const v = layout==="CA" ? data[(4+c)*na+a] : data[a*(nc+4)+4+c]; if(v>best){best=v;bi=c;} }
    if (best<thr) continue;
    const g=i=> layout==="CA" ? data[i*na+a] : data[a*(nc+4)+i];
    const cx=g(0),cy=g(1),w=g(2),h=g(3);
    cand.push({cls:bi,score:best,box:[cx-w/2,cy-h/2,w,h]});
  }
  return nms(cand,IOU_T);
}
async function yoloDetect(){
  const {x,r,px,py} = letterbox();
  const t = new ort.Tensor("float32", x, [1,3,YSIZE,YSIZE]);
  const out = await session.run({[inputName]:t});
  const o = out[session.outputNames[0]];
  return decodeYolo(o.data,o.dims,RAW_FLOOR).map(d=>({
    cls: COCO80[d.cls] ?? String(d.cls), score:d.score,
    bbox:[(d.box[0]-px)/r,(d.box[1]-py)/r,d.box[2]/r,d.box[3]/r]
  }));
}

/* ---------- profile layer ---------- */
const OBSTACLES=["chair","couch","bed","bench","dining table","toilet","potted plant","suitcase","backpack","bicycle","tv","refrigerator","oven","sink","car","motorcycle"];
const FOODS=["bottle","cup","bowl","spoon","fork","knife","banana","apple","sandwich","orange","broccoli","carrot","pizza","cake","donut","hot dog","wine glass"];
const PROFILES = {
  mobility:{ classes:["chair","bed","couch","bench","dining table","toilet","suitcase","backpack","potted plant","person","bicycle","car","stop sign"],
    boost:(d,p)=> OBSTACLES.includes(d.cls) ? (nearPerson(d,p)?1.18:1.12) : 1.0 },
  vision:{ classes:["person","chair","bed","couch","tv","laptop","cell phone","clock","bottle","cup","dining table","book","dog","cat","car","bicycle","traffic light","bus","bench","stop sign"],
    boost:(d)=> d.cls==="person" ? 1.18 : OBSTACLES.includes(d.cls) ? 1.10 : 1.05 },
  cognitive:{ classes:["person","clock","book","tv","laptop","cell phone","remote","cup","dog","cat"],
    boost:(d)=> ["clock","book","tv","laptop","cell phone","remote"].includes(d.cls) ? 1.18 : 1.0 },
  health:{ classes:["person"].concat(FOODS,["microwave","refrigerator","sink"]),
    boost:(d,p)=> (d.cls!=="person" && nearPerson(d,p)) ? 1.18 : d.cls!=="person" ? 1.08 : 1.0 }
};
function nearPerson(d,persons){
  const [x,y,w,h]=d.bbox, cx=x+w/2, cy=y+h/2;
  return persons.some(p=>{ const [px,py,pw,ph]=p.bbox;
    return cx>px-pw*0.5 && cx<px+pw*1.5 && cy>py-ph*0.25 && cy<py+ph*1.25; });
}
function dirOf(d,W){ const cx=(d.bbox[0]+d.bbox[2]/2)/W; return cx<0.36?"left":cx>0.64?"right":"ahead"; }
const dirWord = (x)=> x==="left"?T("dirLeft"):x==="right"?T("dirRight"):T("dirAhead");
const panOf = (x)=> x==="left"?-0.8:x==="right"?0.8:0;
function metersOf(d,W,H){
  const fr = Math.max(d.bbox[2]/W, d.bbox[3]/H);
  return Math.round(Math.min(12, Math.max(0.3, 0.85/Math.max(fr,0.07)))*10)/10;
}
function distPhrase(m){
  if (m < 0.9) return T("stepsClose",{cm:Math.round(m*100)});
  return T("stepsWord",{m:Math.round(m), s:Math.max(1,Math.round(m/0.75))});
}
/* honest uncertainty */
const leadFor = (score)=> score < 0.58 ? T("maybe") : T("sure");

/* dominant colour inside a box (for clothing / object colour) */
function boxColour(d,W,H){
  try{
    const c = document.createElement("canvas"); c.width=24; c.height=24;
    const x = Math.max(0,d.bbox[0]), y=Math.max(0,d.bbox[1]);
    const w = Math.min(W-x,d.bbox[2]), h=Math.min(H-y,d.bbox[3]);
    if (w<8||h<8) return null;
    c.getContext("2d").drawImage(el.video, x+w*0.25, y+h*0.25, w*0.5, h*0.5, 0,0,24,24);
    const p = c.getContext("2d").getImageData(0,0,24,24).data;
    let r=0,g=0,b=0,n=0;
    for (let i=0;i<p.length;i+=4){ r+=p[i]; g+=p[i+1]; b+=p[i+2]; n++; }
    r/=n; g/=n; b/=n;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b), v=mx/255, sat=mx? (mx-mn)/mx : 0;
    if (v<0.18) return "black";
    if (sat<0.16) return v>0.78 ? "white" : "grey";
    let hue = 0;
    if (mx===r) hue = 60*(((g-b)/(mx-mn))%6);
    else if (mx===g) hue = 60*(((b-r)/(mx-mn))+2);
    else hue = 60*(((r-g)/(mx-mn))+4);
    if (hue<0) hue+=360;
    if (hue<15||hue>=345) return "red";
    if (hue<40) return v<0.55 ? "brown" : "orange";
    if (hue<70) return "yellow";
    if (hue<165) return "green";
    if (hue<255) return "blue";
    if (hue<290) return "purple";
    return "pink";
  }catch(e){ return null; }
}
/* traffic-light state by sampling the brightest third of its box */
function trafficState(d,W,H){
  try{
    const c=document.createElement("canvas"); c.width=12; c.height=30;
    c.getContext("2d").drawImage(el.video, d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3], 0,0,12,30);
    const p=c.getContext("2d").getImageData(0,0,12,30).data;
    let topR=0, botG=0;
    for (let y=0;y<30;y++) for (let x=0;x<12;x++){
      const i=(y*12+x)*4, r=p[i], g=p[i+1], b=p[i+2];
      if (y<12 && r>150 && r>g*1.4 && r>b*1.4) topR++;
      if (y>16 && g>130 && g>r*1.2 && g>b*1.1) botG++;
    }
    if (topR > botG && topR > 6) return "red";
    if (botG > topR && botG > 6) return "green";
  }catch(e){}
  return null;
}
/* remembered item locations */
let ITEMS = JSON.parse(LS("nv.items","{}"));
const MEMORABLE = ["cell phone","book","cup","bottle","remote","scissors","keyboard","laptop","handbag","backpack","umbrella","clock","toothbrush","wine glass","teddy bear","tie"];
function rememberItem(cls, dir){
  ITEMS[cls] = {t:Date.now(), dir};
  save("nv.items", JSON.stringify(ITEMS));
}

/* ---------- build the spoken description (differs per profile) ---------- */
function describe(dets, W, H){
  const P = PROFILES[S.profile];
  const persons = dets.filter(d=>d.cls==="person");
  const rel = dets.map(d=>({...d, b: Math.min(1, d.score * P.boost(d, persons))}))
                  .filter(d=> d.b >= S.conf/100 && P.classes.includes(d.cls))
                  .sort((a,b)=>b.b-a.b);
  const detailed = S.verb === "detailed";
  const maxItems = detailed ? 4 : 2;
  let out = "", urgent = false;

  /* remember everyday items regardless of profile */
  rel.forEach(d=>{ if (MEMORABLE.includes(d.cls)) rememberItem(d.cls, dirOf(d,W)); });

  /* universal safety layer: traffic lights, overhead & low hazards */
  const tl = rel.find(d=>d.cls==="traffic light");
  if (tl){
    const st = trafficState(tl,W,H);
    if (st === "red"){ out += T("trafficRed") + " "; urgent = true; }
    else if (st === "green") out += T("trafficGreen") + " ";
  }
  const closeObs = rel.filter(d=>d.cls!=="person" && metersOf(d,W,H) < 1.6);
  for (const d of closeObs.slice(0,1)){
    const cy = (d.bbox[1] + d.bbox[3]/2)/H;
    if (cy < 0.22){ out += T("overheadWarn",{dir:dirWord(dirOf(d,W))}) + " "; urgent = true; }
    else if (cy > 0.82){ out += T("lowWarn",{dir:dirWord(dirOf(d,W))}) + " "; urgent = true; }
  }
  if (lastLuma < 45 && !darkAsked){ darkAsked = true; out += T("darkScene") + " "; }

  if (!rel.length) return {text: out || TO("detNothing")[S.profile], rel:[], urgent};

  if (S.profile === "mobility"){
    const obs = rel.filter(d=>d.cls!=="person");
    const near = obs[0] && metersOf(obs[0],W,H) < 1.3 ? obs[0] : null;
    if (near){
      const dr = dirOf(near,W);
      out += T("warnClose",{name:objName(near.cls), dir:dirWord(dr), avoid: dr==="left"?T("avoidRight"):T("avoidLeft")}) + " ";
      urgent = true; buzz(HAPTIC.danger); tone(330,0.25,panOf(dr));
    }
    for (const d of obs.slice(near?1:0, (near?1:0)+maxItems)){
      out += T("itemLine",{lead:leadFor(d.b), name:objName(d.cls), dir:dirWord(dirOf(d,W)), dist:distPhrase(metersOf(d,W,H))}) + " ";
      buzz(HAPTIC.obstacle);
    }
    if (!obs.some(d=>dirOf(d,W)==="ahead" && metersOf(d,W,H)<2.5)) out += T("pathClear");
  }
  else if (S.profile === "vision"){
    if (persons.length){
      const p = persons[0], dr = dirOf(p,W);
      out += T("peopleLine",{n:persons.length, ppl: persons.length===1?T("personOne"):T("personMany"), dir:dirWord(dr), dist:distPhrase(metersOf(p,W,H))}) + " ";
      buzz(HAPTIC.person); tone(660,0.14,panOf(dr));
      if (detailed){ const col = boxColour(p,W,H); if (col) out += T("colourOf",{name:objName("person"), colour:colourName(col)}) + " "; }
    }
    for (const d of rel.filter(x=>x.cls!=="person" && x.cls!=="traffic light").slice(0,maxItems)){
      const dr = dirOf(d,W);
      out += T("itemLine",{lead:leadFor(d.b), name:objName(d.cls), dir:dirWord(dr), dist:distPhrase(metersOf(d,W,H))}) + " ";
      tone(520,0.1,panOf(dr));
    }
    const sides={left:0,ahead:0,right:0}; rel.forEach(d=>sides[dirOf(d,W)]++);
    out += T("clearSide",{dir: sides.ahead===0 ? T("clearAhead") : sides.left<=sides.right ? T("clearLeft") : T("clearRight")});
  }
  else if (S.profile === "cognitive"){
    for (const d of rel.slice(0,maxItems))
      out += T("itemLine",{lead:leadFor(d.b), name:objName(d.cls), dir:dirWord(dirOf(d,W)), dist:distPhrase(metersOf(d,W,H))}) + " ";
    out += T("cogTime",{time:nowTime()});
  }
  else { /* health */
    const items = rel.filter(d=>d.cls!=="person").slice(0, maxItems+1);
    items.forEach(d=>{ if (["bottle","cup","wine glass"].includes(d.cls)) noteIntake("drink");
                       if (FOODS.includes(d.cls) && !["bottle","cup","wine glass"].includes(d.cls)) noteIntake("meal"); });
    const list = items.map(d=>`${objName(d.cls)} ${dirWord(dirOf(d,W))}, ${distPhrase(metersOf(d,W,H))}`).join(", ");
    if (!items.length) out += TO("detNothing").health;
    else out += T(persons.length && items.some(d=>nearPerson(d,persons)) ? "healthNear" : "healthPlain", {list});
  }
  return {text: out.trim(), rel, urgent};
}
let darkAsked = false;

/* intake log (hydration / meals) */
function noteIntake(kind){
  const today = new Date().toDateString();
  const last = LS("nv.intake.last","");
  const key = kind + ":" + today;
  if (LS("nv.seen."+key,"") ) return;
  const now = Date.now();
  if (now - parseInt(LS("nv.intake.t","0"),10) < 120000) return; /* debounce 2 min */
  save("nv.intake.t", String(now));
  logEvent(kind);
}

/* ---------- detection loop ---------- */
let stream=null, detTimer=null, detecting=false, lastSaid="", lastSaidAt=0, torchOn=false;
async function startDetect(){
  if (detecting) return;
  try{
    await loadModel();
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
    el.video.srcObject = stream; await el.video.play();
    el.camIdle.hidden = true; detecting = true; darkAsked = false;
    el.detBtn.hidden = true; el.detStop.hidden = false;
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    el.torchBtn.hidden = !("torch" in caps);
    speak(T("detStarted"));
    logEvent("detect_start");
    detTimer = setInterval(frame, 1100);
  }catch(e){ console.warn(e); speak(T("noCamera")); }
}
function stopDetect(announce){
  if (!detecting && !stream) return;
  detecting=false; clearInterval(detTimer);
  if (stream) stream.getTracks().forEach(t=>t.stop());
  stream=null; torchOn=false; el.video.srcObject=null; el.camIdle.hidden=false; el.torchBtn.hidden=true;
  const c = el.overlay.getContext("2d"); c.clearRect(0,0,el.overlay.width,el.overlay.height);
  el.detBtn.hidden=false; el.detStop.hidden=true;
  if (announce !== false) speak(T("detStopped"));
}
async function frame(){
  if (!detecting || el.video.readyState < 2 || busy) return;
  busy = true;
  let dets=[];
  try{ dets = await yoloDetect(); }catch(e){ console.warn("YOLO:",e); }
  busy = false;
  const W = el.video.videoWidth, H = el.video.videoHeight;
  const {text, rel, urgent} = describe(dets, W, H);
  drawBoxes(rel, W, H);
  el.detResult.textContent = text;
  const now = Date.now();
  const gap = urgent ? 2500 : 6000;
  if (text && text !== lastSaid && now-lastSaidAt > gap && !speaking){
    lastSaid = text; lastSaidAt = now;
    speak(text, {mirror:false});
  }
}
function drawBoxes(dets,W,H){
  el.overlay.width=W; el.overlay.height=H;
  const c = el.overlay.getContext("2d");
  c.clearRect(0,0,W,H); c.lineWidth=4; c.font="bold 20px Atkinson Hyperlegible, sans-serif";
  dets.forEach(d=>{
    const [x,y,w,h]=d.bbox;
    c.strokeStyle = d.cls==="person" ? "#2E7CD6" : d.b<0.58 ? "#9AA5AC" : "#E9960C";
    c.fillStyle = c.strokeStyle;
    c.strokeRect(x,y,w,h);
    const lab = `${objName(d.cls)} ${(d.b*100|0)}%`;
    const tw = c.measureText(lab).width+12;
    c.fillRect(x, Math.max(0,y-28), tw, 28);
    c.fillStyle="#fff"; c.fillText(lab, x+6, Math.max(20,y-8));
  });
}
async function setTorch(on){
  if (!stream){ speak(T("torchNo")); return; }
  const track = stream.getVideoTracks()[0];
  try{
    await track.applyConstraints({advanced:[{torch:on}]});
    torchOn = on; speak(on ? T("torchOn") : T("torchOff"));
  }catch(e){ speak(T("torchNo")); }
}
el.detBtn.addEventListener("click", startDetect);
el.detStop.addEventListener("click", ()=>stopDetect(true));
el.torchBtn.addEventListener("click", ()=>setTorch(!torchOn));
el.confRange.addEventListener("input", ()=>{ el.confVal.textContent = el.confRange.value+"%"; });
el.confRange.addEventListener("change", ()=>{ S.conf=parseInt(el.confRange.value,10); save("nv.conf",S.conf); lastSaid=""; speak(T("confSet",{p:S.conf})); });
el.verbSelect.addEventListener("change", ()=>{ S.verb=el.verbSelect.value; save("nv.verb",S.verb); lastSaid="";
  speak(T("verbSet",{v: S.verb==="brief"?T("verbBrief"):T("verbDetailed")})); });
el.modelSelect.addEventListener("change", async ()=>{ S.model=el.modelSelect.value; save("nv.model",S.model);
  session=null; sessionModel=null; if (detecting){ try{ await loadModel(); }catch(e){} } });

/* ===================================================================
   READ ALOUD (OCR)
   =================================================================== */
let readStream = null;
async function startRead(){
  try{
    readStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
    el.readVideo.srcObject = readStream; await el.readVideo.play();
    el.readIdle.hidden = true; el.readStart.hidden = true; el.readShot.hidden = false;
  }catch(e){ speak(T("noCamera")); }
}
function stopRead(){
  if (readStream) readStream.getTracks().forEach(t=>t.stop());
  readStream=null; el.readVideo.srcObject=null; el.readIdle.hidden=false;
  el.readStart.hidden=false; el.readShot.hidden=true;
}
async function readNow(){
  if (!readStream){ await startRead(); return; }
  speak(T("readWorking"));
  const c = document.createElement("canvas");
  c.width = el.readVideo.videoWidth; c.height = el.readVideo.videoHeight;
  c.getContext("2d").drawImage(el.readVideo,0,0);
  try{
    const langs = S.lang==="ru" ? "rus+eng" : "eng";
    const {data} = await Tesseract.recognize(c, langs);
    const txt = (data.text||"").replace(/\s+/g," ").trim();
    if (txt.length < 2){ el.readResult.textContent = T("readNone"); speak(T("readNone")); return; }
    el.readResult.textContent = txt;
    speak(T("readFound",{text: txt.slice(0,600)}));
    logEvent("read");
  }catch(e){ speak(T("readNone")); }
}
el.readStart.addEventListener("click", startRead);
el.readShot.addEventListener("click", readNow);

/* ===================================================================
   NAVIGATION — Overpass + Nominatim search, OSRM route,
   plus Google Maps / Yandex Maps hand-off
   =================================================================== */
let mapObj=null, routeLayer=null, marks=[], meMark=null, navWatch=null,
    navSteps=[], navStepIdx=0, navDest=null, lastNavSay=0, myPos=null;

function ensureMap(lat,lon){
  if (!mapObj){
    mapObj = L.map("map",{zoomControl:true}).setView([lat,lon],15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(mapObj);
  } else mapObj.setView([lat,lon],15);
  if (!meMark) meMark = L.circleMarker([lat,lon],{radius:9,color:"#2E7CD6",fillColor:"#2E7CD6",fillOpacity:.9}).addTo(mapObj);
  else meMark.setLatLng([lat,lon]);
}
function getPos(){
  return new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(
    p=>{ myPos={lat:p.coords.latitude, lon:p.coords.longitude}; res(myPos); }, rej,
    {enableHighAccuracy:true, timeout:12000, maximumAge:8000}));
}
const KIND_Q = {
  hospital:'["amenity"~"hospital|clinic|doctors"]', pharmacy:'["amenity"="pharmacy"]',
  bus:'["highway"="bus_stop"]', taxi:'["amenity"="taxi"]',
  shop:'["shop"~"supermarket|convenience|general"]', food:'["amenity"~"restaurant|cafe|fast_food"]',
  toilet:'["amenity"="toilets"]', bank:'["amenity"~"bank|atm"]'
};
const kindLabel = (k)=> (TO("chips")[k]||k).replace(/^\S+\s/,"");
async function overpass(kind, text, lat, lon, radius){
  const f = kind ? KIND_Q[kind] : `["name"~"${String(text).replace(/["\\]/g,"")}",i]`;
  const q = `[out:json][timeout:20];(node${f}(around:${radius},${lat},${lon});way${f}(around:${radius},${lat},${lon}););out center 30;`;
  const r = await fetch("https://overpass-api.de/api/interpreter",
    {method:"POST", body:"data="+encodeURIComponent(q), headers:{"Content-Type":"application/x-www-form-urlencoded"}});
  const j = await r.json();
  return (j.elements||[]).map(e=>({
    name:(e.tags&&(e.tags.name||e.tags["name:"+S.lang]||e.tags["name:en"])) || (kind?kindLabel(kind):text),
    lat: e.lat ?? (e.center&&e.center.lat), lon: e.lon ?? (e.center&&e.center.lon)
  })).filter(p=>p.lat&&p.lon);
}
/* free-text fallback: real addresses & named places */
async function nominatim(text, lat, lon){
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&accept-language=${S.lang}`
            + `&q=${encodeURIComponent(text)}&viewbox=${lon-0.25},${lat+0.25},${lon+0.25},${lat-0.25}&bounded=0`;
  const r = await fetch(url, {headers:{"Accept":"application/json"}});
  const j = await r.json();
  return (j||[]).map(p=>({name:p.display_name.split(",").slice(0,2).join(","), lat:parseFloat(p.lat), lon:parseFloat(p.lon)}));
}
const RJ=6371000, rad=d=>d*Math.PI/180;
function haversine(a,b){
  const dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon);
  const s=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2*RJ*Math.asin(Math.sqrt(s));
}
function bearingWord(a,b){
  const y=Math.sin(rad(b.lon-a.lon))*Math.cos(rad(b.lat));
  const x=Math.cos(rad(a.lat))*Math.sin(rad(b.lat))-Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(rad(b.lon-a.lon));
  const brg=(Math.atan2(y,x)*180/Math.PI+360)%360;
  const en=["north","north-east","east","south-east","south","south-west","west","north-west"];
  const ru=["север","северо-восток","восток","юго-восток","юг","юго-запад","запад","северо-запад"];
  return (S.lang==="ru"?ru:en)[Math.round(brg/45)%8];
}
const fmtDist = (m)=> m>=1000 ? (m/1000).toFixed(1)+(S.lang==="ru"?" км":" km") : Math.round(m)+(S.lang==="ru"?" м":" m");

function setMapLinks(dest){
  if (!dest) return;
  el.gmapsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}&travelmode=walking`;
  el.ymapsLink.href = myPos
    ? `https://yandex.com/maps/?rtext=${myPos.lat},${myPos.lon}~${dest.lat},${dest.lon}&rtt=pd`
    : `https://yandex.com/maps/?pt=${dest.lon},${dest.lat}&z=17`;
  el.gmapsLink.hidden = false; el.ymapsLink.hidden = false;
}
/* Navigation must never dead-end. If GPS is refused or the free map
   services are down, the person still lands in a working maps app. */
function mapsFallback(query, dest){
  const url = dest
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}&travelmode=walking`
    : `https://www.google.com/maps/search/${encodeURIComponent(query||"")}`;
  el.gmapsLink.href = url; el.gmapsLink.hidden = false;
  el.ymapsLink.href = dest
    ? `https://yandex.com/maps/?rtext=~${dest.lat},${dest.lon}&rtt=pd`
    : `https://yandex.com/maps/?text=${encodeURIComponent(query||"")}`;
  el.ymapsLink.hidden = false;
  try{ window.open(url, "_blank", "noopener"); }catch(e){}
}
async function findPlaces(kind, text){
  const what = kind ? kindLabel(kind) : text;
  openView("nav");
  speak(T("navSearching",{what}));
  let me;
  try{ me = await getPos(); }catch(e){ speak(T("noGeo")); mapsFallback(what); return; }
  ensureMap(me.lat, me.lon);
  marks.forEach(m=>mapObj.removeLayer(m)); marks=[];
  let places=[];
  for (const rr of [1500,5000,12000]){
    try{ places = await overpass(kind, text, me.lat, me.lon, rr); }catch(e){}
    if (places.length) break;
  }
  if (!places.length && text){ try{ places = await nominatim(text, me.lat, me.lon); }catch(e){} }
  if (!places.length){ const m=T("navNone",{what,km:12}); el.navInfo.textContent=m; speak(m); mapsFallback(what); return; }
  places.forEach(p=>p.d = haversine(me,p));
  places.sort((a,b)=>a.d-b.d);
  places.slice(0,8).forEach(p=> marks.push(L.marker([p.lat,p.lon]).addTo(mapObj).bindPopup(p.name)));
  const best = places[0];
  el.navInfo.textContent = places.slice(0,3).map((p,i)=>`${i+1}. ${p.name} — ${fmtDist(p.d)}`).join("\n");
  setMapLinks(best);
  speak(T("navFoundOne",{name:best.name, dist:fmtDist(best.d), steps:Math.round(best.d/0.75), dir:bearingWord(me,best)}));
  logEvent("navigate", best.name);
  routeTo(me, best);
}
function stepInstr(st){
  const t=st.maneuver.type, m=st.maneuver.modifier||"";
  let b;
  if (t==="arrive") b=T("arriveWord");
  else if (t==="depart"||t==="continue"||m==="straight") b=T("goStraight");
  else if (/left/.test(m)) b=T("turnLeft");
  else if (/right/.test(m)) b=T("turnRight");
  else if (/uturn/.test(m)) b=T("uTurn");
  else b=T("goStraight");
  if (st.name) b += T("onStreet",{road:st.name});
  return b;
}
async function routeTo(me, dest){
  try{
    const r = await fetch(`https://router.project-osrm.org/route/v1/foot/${me.lon},${me.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson&steps=true`);
    const j = await r.json();
    if (!j.routes || !j.routes.length) return;
    const route = j.routes[0];
    if (routeLayer) mapObj.removeLayer(routeLayer);
    routeLayer = L.geoJSON(route.geometry,{style:{color:"#0F5B54",weight:6,opacity:.85}}).addTo(mapObj);
    mapObj.fitBounds(routeLayer.getBounds(),{padding:[22,22]});
    navSteps = route.legs[0].steps; navStepIdx=0; navDest=dest;
    const first = navSteps.length ? T("navRouteStep",{instr:stepInstr(navSteps[0]), dist:fmtDist(navSteps[0].distance)}) : "";
    speak(T("navStart",{first}));
    el.navStop.hidden = false;
    liveGuide();
  }catch(e){
    console.warn("route",e);
    /* route service down: hand over to the maps app so guidance continues */
    mapsFallback(dest.name, dest);
  }
}
function liveGuide(){
  if (navWatch !== null) navigator.geolocation.clearWatch(navWatch);
  navWatch = navigator.geolocation.watchPosition(p=>{
    myPos = {lat:p.coords.latitude, lon:p.coords.longitude};
    ensureMap(myPos.lat, myPos.lon);
    if (!navDest) return;
    const left = haversine(myPos, navDest);
    el.navInfo.textContent = `→ ${navDest.name} · ${fmtDist(left)}`;
    if (left < 18){ speak(T("navArrive",{name:navDest.name})); buzz(HAPTIC.ok); stopNav(false); return; }
    if (navSteps[navStepIdx+1]){
      const n = navSteps[navStepIdx+1].maneuver.location;
      if (haversine(myPos,{lat:n[1],lon:n[0]}) < 22){
        navStepIdx++;
        const st = navSteps[navStepIdx];
        const m = st.maneuver.modifier||"";
        buzz(HAPTIC.obstacle);
        tone(600,0.15, /left/.test(m) ? -0.8 : /right/.test(m) ? 0.8 : 0);
        speak(T("navRouteStep",{instr:stepInstr(st), dist:fmtDist(st.distance)}));
        lastNavSay = Date.now(); return;
      }
    }
    if (Date.now()-lastNavSay > 25000){
      lastNavSay = Date.now();
      speak(T("navProgress",{dist:fmtDist(left), dir:bearingWord(myPos,navDest)}));
    }
  }, ()=>{}, {enableHighAccuracy:true, maximumAge:2000});
}
function stopNav(announce){
  if (navWatch !== null) navigator.geolocation.clearWatch(navWatch);
  navWatch=null; navDest=null; navSteps=[];
  if (routeLayer && mapObj){ mapObj.removeLayer(routeLayer); routeLayer=null; }
  el.navStop.hidden = true;
  if (announce !== false) speak(T("navStopped"));
}
el.navGo.addEventListener("click", ()=>{ const q=el.navQuery.value.trim(); if(q) findPlaces(null,q); });
el.navQuery.addEventListener("keydown", e=>{ if(e.key==="Enter"){ const q=el.navQuery.value.trim(); if(q) findPlaces(null,q); }});
el.navStop.addEventListener("click", ()=>stopNav(true));

async function openMaps(which){
  let me = myPos;
  if (!me){ try{ me = await getPos(); }catch(e){} }
  const dest = navDest;
  let url;
  if (which === "g") url = dest ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}&travelmode=walking`
                               : (me ? `https://www.google.com/maps/@${me.lat},${me.lon},17z` : "https://www.google.com/maps");
  else url = dest ? (me ? `https://yandex.com/maps/?rtext=${me.lat},${me.lon}~${dest.lat},${dest.lon}&rtt=pd`
                        : `https://yandex.com/maps/?pt=${dest.lon},${dest.lat}&z=17`)
                  : (me ? `https://yandex.com/maps/?ll=${me.lon},${me.lat}&z=17` : "https://yandex.com/maps");
  speak(which==="g" ? T("openGmaps") : T("openYmaps"));
  window.open(url, "_blank", "noopener");
}

/* ---------- cab / food / pharmacy ---------- */
async function openCab(which){
  if (rehearsing){ speak(T("rehearsePretend")); return; }
  let me = myPos; if (!me){ try{ me = await getPos(); }catch(e){} }
  speak(T("cabOpening"));
  const url = which === "uber"
    ? (me ? `https://m.uber.com/looking?pickup[latitude]=${me.lat}&pickup[longitude]=${me.lon}` : "https://m.uber.com/looking")
    : (me ? `https://3.redirect.appmetrica.yandex.com/route?start-lat=${me.lat}&start-lon=${me.lon}&appmetrica_tracking_id=1178268795219780156`
          : "https://go.yandex/");
  logEvent("cab", which);
  window.open(url, "_blank", "noopener");
}
function openFood(which){
  if (rehearsing){ speak(T("rehearsePretend")); return; }
  speak(T("foodOpening"));
  logEvent("food", which);
  window.open(which==="uber" ? "https://www.ubereats.com/" : "https://eda.yandex/", "_blank", "noopener");
}
el.cabYandex.addEventListener("click", (e)=>{ e.preventDefault(); openCab("yandex"); });
el.cabUber.addEventListener("click", (e)=>{ e.preventDefault(); openCab("uber"); });
el.foodYandex.addEventListener("click", (e)=>{ e.preventDefault(); openFood("yandex"); });
el.foodUber.addEventListener("click", (e)=>{ e.preventDefault(); openFood("uber"); });
el.pharmFind.addEventListener("click", ()=>findPlaces("pharmacy",null));
el.gmapsLink.addEventListener("click",(e)=>{ e.preventDefault(); openMaps("g"); });
el.ymapsLink.addEventListener("click",(e)=>{ e.preventDefault(); openMaps("y"); });

/* ---------- scam check ---------- */
const SCAM_RX = [
  {rx:/(верификац|код из смс|код подтвержд|verification code|one[- ]time code|otp)/i, why:{en:"asking for a code from a text message", ru:"просят код из СМС"}},
  {rx:/(перевед|переведите|отправьте деньги|send money|wire|transfer money|bitcoin|крипт)/i, why:{en:"asking you to send money", ru:"просят перевести деньги"}},
  {rx:/(служба безопасности|банк.{0,12}сотрудник|security department|bank official)/i, why:{en:"pretending to be from your bank", ru:"представляются банком"}},
  {rx:/(срочно|немедленно|urgent|immediately|right now|в течение часа)/i, why:{en:"creating urgency", ru:"создают срочность"}},
  {rx:/(выигр|приз|lottery|you have won|prize|наследств|inheritance)/i, why:{en:"promising a prize or inheritance", ru:"обещают выигрыш или наследство"}},
  {rx:/(пароль|password|пин[- ]?код|pin code|cvv|карт.{0,10}номер|card number)/i, why:{en:"asking for a password or card details", ru:"просят пароль или данные карты"}}
];
function checkScam(text){
  const hits = SCAM_RX.filter(s=>s.rx.test(text));
  if (hits.length >= 2 || (hits.length===1 && /код|code|password|пароль|cvv/i.test(text))){
    const why = hits.map(h=>h.why[S.lang==="ru"?"ru":"en"]).join(", ");
    const msg = T("scamBad",{why});
    el.scamResult.textContent = msg; speak(msg); logEvent("scam_flag");
  } else { const m=T("scamOk"); el.scamResult.textContent=m; speak(m); }
}
el.scamCheck.addEventListener("click", ()=>{ const t=el.scamInput.value.trim(); if(t) checkScam(t); });

/* ===================================================================
   ALARMS & APPOINTMENTS
   =================================================================== */
const nowTime = ()=> new Date().toLocaleTimeString(S.lang==="ru"?"ru-RU":"en-US",{hour:"2-digit",minute:"2-digit"});
const nowDate = ()=> new Date().toLocaleDateString(S.lang==="ru"?"ru-RU":"en-US",{weekday:"long",day:"numeric",month:"long"});

let alarms = JSON.parse(LS("nv.alarms","[]"));
let appts  = JSON.parse(LS("nv.appts","[]"));
const saveAlarms = ()=> save("nv.alarms", JSON.stringify(alarms));
const saveAppts  = ()=> save("nv.appts", JSON.stringify(appts));

function renderAlarms(){
  el.alarmList.innerHTML="";
  alarms.forEach((a,i)=>{
    const d=document.createElement("div"); d.className="item"+(a.taken?" taken":"");
    d.innerHTML=`<div class="main"><div class="t1">⏰ ${a.time}</div><div class="t2">${a.label}</div></div>`;
    const ok=document.createElement("button"); ok.className="ok"; ok.textContent=T("taken");
    ok.addEventListener("click",()=>{ a.taken=true; saveAlarms(); renderAlarms(); logEvent("med_taken",a.label); speak(T("alarmTakenMsg",{label:a.label})); });
    const del=document.createElement("button"); del.className="del"; del.textContent="✕";
    del.addEventListener("click",()=>{ alarms.splice(i,1); saveAlarms(); renderAlarms(); speak(T("alarmDeleted",{label:a.label})); });
    d.append(ok,del); el.alarmList.append(d);
  });
}
function addAlarm(time,label){
  if (!time){ speak(T("alarmNoTime")); return; }
  alarms.push({time,label,taken:false,firedOn:""}); saveAlarms(); renderAlarms();
  logEvent("med_set",label);
  speak(T("alarmSet",{time,label}));
}
el.alarmAdd.addEventListener("click", ()=>{
  addAlarm(el.alarmTime.value, el.alarmLabel.value.trim() || (S.lang==="ru"?"Принять лекарство":"Take my medicine"));
  el.alarmLabel.value="";
});
function renderAppts(){
  el.apptList.innerHTML="";
  appts.forEach((a,i)=>{
    const d=document.createElement("div"); d.className="item";
    const when = new Date(a.when).toLocaleString(S.lang==="ru"?"ru-RU":"en-US",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
    d.innerHTML=`<div class="main"><div class="t1">📅 ${a.label}</div><div class="t2">${when}</div></div>`;
    const del=document.createElement("button"); del.className="del"; del.textContent="✕";
    del.addEventListener("click",()=>{ appts.splice(i,1); saveAppts(); renderAppts(); });
    d.append(del); el.apptList.append(d);
  });
}
el.apptAdd.addEventListener("click", ()=>{
  const w = el.apptTime.value, l = el.apptLabel.value.trim();
  if (!w || !l) return;
  appts.push({when:w, label:l, warned:false}); saveAppts(); renderAppts();
  speak(T("apptSet",{label:l, when:new Date(w).toLocaleString(S.lang==="ru"?"ru-RU":"en-US",{weekday:"long",hour:"2-digit",minute:"2-digit"})}));
});
/* alarm + appointment ticker */
setInterval(()=>{
  const now = new Date(), hhmm = now.toTimeString().slice(0,5), today = now.toDateString();
  alarms.forEach(a=>{
    if (a.time===hhmm && a.firedOn!==today){
      a.firedOn=today; a.taken=false; saveAlarms(); renderAlarms();
      chime(); speak(T("alarmRing",{label:a.label})); logEvent("med_due",a.label);
      setTimeout(()=>{ if(!a.taken){ chime(); speak(T("alarmRing",{label:a.label})); } }, 90000);
    }
  });
  appts.forEach(a=>{
    const dt = new Date(a.when).getTime(), diff = dt - Date.now();
    if (!a.warned && diff > 0 && diff < 3600000){
      a.warned = true; saveAppts(); chime();
      speak(T("apptSoon",{label:a.label}));
    }
  });
}, 15000);

/* ===================================================================
   SOS, FALL DETECTION, CHECK-INS
   =================================================================== */
let sos = JSON.parse(LS("nv.sos","[]"));
const saveSos = ()=> save("nv.sos", JSON.stringify(sos));
function renderSos(){
  el.sosList.innerHTML="";
  sos.forEach((p,i)=>{
    const d=document.createElement("div"); d.className="item";
    d.innerHTML=`<div class="main"><div class="t1">${p.name}</div><div class="t2">${p.phone}</div></div>`;
    const c=document.createElement("a"); c.className="call"; c.textContent="📞 "+T("callWord"); c.href="tel:"+p.phone;
    c.addEventListener("click",(e)=>{ if(rehearsing){ e.preventDefault(); speak(T("rehearsePretend")); } });
    const del=document.createElement("button"); del.className="del"; del.textContent="✕";
    del.addEventListener("click",()=>{ sos.splice(i,1); saveSos(); renderSos(); speak(T("sosRemoved",{name:p.name})); });
    d.append(c,del); el.sosList.append(d);
  });
  el.sosCall.href = "tel:" + (sos[0] ? sos[0].phone : "112");
  el.panicCall.href = el.sosCall.href;
}
function doCall(p){
  if (rehearsing){ speak(T("rehearsePretend")); return; }
  speak(T("sosCalling",{name:p.name})); logEvent("call",p.name);
  setTimeout(()=>{ location.href = "tel:"+p.phone; }, 1300);
}
el.sosAdd.addEventListener("click", ()=>{
  const n=el.sosName.value.trim(), p=el.sosPhone.value.trim();
  if(!n||!p) return;
  sos.push({name:n,phone:p}); saveSos(); renderSos();
  el.sosName.value=""; el.sosPhone.value="";
  speak(T("sosAdded",{name:n}));
});
el.sosCall.addEventListener("click",(e)=>{ if(rehearsing){ e.preventDefault(); speak(T("rehearsePretend")); } });
el.ambCall.addEventListener("click",(e)=>{ if(rehearsing){ e.preventDefault(); speak(T("rehearsePretend")); } });
async function shareLocation(){
  let me = myPos; if (!me){ try{ me = await getPos(); }catch(e){ speak(T("noGeo")); return; } }
  const link = `https://www.google.com/maps?q=${me.lat},${me.lon}`;
  const msg = (S.lang==="ru" ? "Мне нужна помощь. Я здесь: " : "I need help. I am here: ") + link;
  speak(T("locShared")); logEvent("share_location");
  if (navigator.share){ try{ await navigator.share({text:msg}); return; }catch(e){} }
  const to = sos[0] ? sos[0].phone : "";
  location.href = `sms:${to}?&body=${encodeURIComponent(msg)}`;
}
el.shareLoc.addEventListener("click", shareLocation);

/* fall detection */
let fallTimer=null, fallPending=false, lastMag=9.8, fallCooldown=0;
function onMotion(e){
  const a = e.accelerationIncludingGravity; if (!a) return;
  const mag = Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2);
  const jerk = Math.abs(mag - lastMag); lastMag = mag;
  if (jerk > 22 && Date.now() > fallCooldown){
    fallCooldown = Date.now() + 20000;
    triggerFall();
  }
}
function triggerFall(){
  if (fallPending) return;
  fallPending = true; logEvent("fall_suspected");
  chime(); buzz(HAPTIC.danger);
  speak(T("fallAsk"));
  wantListen = true;
  setTimeout(()=>{ if (fallPending) startCommand(); }, 3500);
  fallTimer = setTimeout(()=>{
    if (!fallPending) return;
    fallPending = false;
    speak(T("fallEscalate")); logEvent("fall_escalated");
    openView("sos");
    if (!rehearsing) setTimeout(()=>{ location.href = el.sosCall.href; }, 2500);
  }, 30000);
}
function cancelFall(){
  if (!fallPending) return;
  fallPending = false; clearTimeout(fallTimer);
  speak(T("fallOk")); logEvent("fall_cancelled");
}
async function setFall(on){
  S.fall = on; save("nv.fall", on?"1":"0"); el.fallToggle.checked = on;
  if (on){
    if (typeof DeviceMotionEvent !== "undefined" && DeviceMotionEvent.requestPermission){
      try{ const r = await DeviceMotionEvent.requestPermission(); if (r !== "granted"){ speak(T("fallOff")); return; } }catch(e){}
    }
    window.addEventListener("devicemotion", onMotion);
    speak(T("fallOn"));
  } else {
    window.removeEventListener("devicemotion", onMotion);
    speak(T("fallOff"));
  }
}
el.fallToggle.addEventListener("change", ()=>setFall(el.fallToggle.checked));

/* periodic check-in */
let checkinTimer = null, checkinPending = false;
function armCheckin(){
  if (checkinTimer) clearInterval(checkinTimer);
  if (!S.checkin) return;
  checkinTimer = setInterval(()=>{
    checkinPending = true;
    chime(); speak(T("checkinAsk"));
    wantListen = true;
    setTimeout(()=>{ if (checkinPending) startCommand(); }, 3500);
    setTimeout(()=>{ if (checkinPending){ checkinPending=false; logEvent("checkin_missed"); } }, 300000);
  }, S.checkin*3600000);
}

/* ===================================================================
   NOTES · CAPTIONS · FIND MY THINGS · HEALTH CARD
   =================================================================== */
let notes = JSON.parse(LS("nv.notes","[]"));
const saveNotes = ()=> save("nv.notes", JSON.stringify(notes));
function renderNotes(){
  el.noteList.innerHTML="";
  notes.slice().reverse().forEach((n)=>{
    const idx = notes.indexOf(n);
    const d=document.createElement("div"); d.className="item";
    d.innerHTML=`<div class="main"><div class="t1">${n.text}</div><div class="t2">${new Date(n.t).toLocaleString(S.lang==="ru"?"ru-RU":"en-US")}</div></div>`;
    const play=document.createElement("button"); play.className="ok"; play.textContent="🔊";
    play.addEventListener("click",()=>speak(n.text));
    const del=document.createElement("button"); del.className="del"; del.textContent="✕";
    del.addEventListener("click",()=>{ notes.splice(idx,1); saveNotes(); renderNotes(); });
    d.append(play,del); el.noteList.append(d);
  });
}
function addNote(text){
  if (!text) return;
  notes.push({t:Date.now(), text}); saveNotes(); renderNotes();
  speak(T("noteAdded",{text}));
}
el.noteAdd.addEventListener("click", ()=>{ addNote(el.noteInput.value.trim()); el.noteInput.value=""; });
el.noteInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){ addNote(el.noteInput.value.trim()); el.noteInput.value=""; }});
el.noteSpeak.addEventListener("click", ()=>{ noteCapture = true; micTap(); });
let noteCapture = false;

/* live captions */
let capRec = null, captionsOn = false;
function startCaptions(){
  if (!SR) return;
  captionsOn = true; killRec(); mode = "off";
  el.capStart.hidden = true; el.capStop.hidden = false;
  el.capBox.textContent = "";
  speak(T("capOn"));
  setTimeout(()=>{
    try{
      capRec = new SR(); capRec.continuous = true; capRec.interimResults = true;
      capRec.lang = I18N[S.lang].tts || "en-US";
      capRec.onresult = (e)=>{
        let s = "";
        for (let i=0;i<e.results.length;i++) s += e.results[i][0].transcript + " ";
        el.capBox.textContent = s.trim().slice(-800);
      };
      capRec.onend = ()=>{ if (captionsOn) try{ capRec.start(); }catch(e){} };
      capRec.start();
    }catch(e){}
  }, 1800);
}
function stopCaptions(){
  captionsOn = false;
  if (capRec){ try{ capRec.onend=null; capRec.abort(); }catch(e){} capRec=null; }
  el.capStart.hidden = false; el.capStop.hidden = true;
  speak(T("capOff"));
  setTimeout(resumeListening, 800);
}
el.capStart.addEventListener("click", startCaptions);
el.capStop.addEventListener("click", stopCaptions);

/* find my things */
function agoWord(t){
  const m = Math.round((Date.now()-t)/60000);
  if (m < 2) return T("findJustNow");
  if (m < 60) return T("findMinutes",{n:m});
  return T("findHours",{n:Math.round(m/60)});
}
function renderFind(){
  el.findList.innerHTML="";
  const keys = Object.keys(ITEMS);
  if (!keys.length){ el.findList.innerHTML = `<p class="note">${T("findEmpty")}</p>`; return; }
  keys.sort((a,b)=>ITEMS[b].t-ITEMS[a].t).forEach(k=>{
    const it = ITEMS[k];
    const d=document.createElement("div"); d.className="item";
    d.innerHTML=`<div class="main"><div class="t1">${objName(k)}</div><div class="t2">${agoWord(it.t)} · ${dirWord(it.dir)}</div></div>`;
    const b=document.createElement("button"); b.className="ok"; b.textContent="🔊";
    b.addEventListener("click",()=>speak(T("findAnswer",{name:objName(k), when:agoWord(it.t), dir:dirWord(it.dir)})));
    d.append(b); el.findList.append(d);
  });
}
function answerFind(query){
  const hit = Object.keys(ITEMS).find(k => query.includes(k) || query.includes(objName(k)));
  if (!hit){ speak(T("findNone")); openView("find"); return; }
  const it = ITEMS[hit];
  speak(T("findAnswer",{name:objName(hit), when:agoWord(it.t), dir:dirWord(it.dir)}));
  openView("find");
}

/* health card */
let MC = JSON.parse(LS("nv.mc","{}"));
function renderMedCard(){
  const empty = !MC.name && !MC.cond && !MC.allergy && !MC.blood;
  el.medCard.textContent = empty ? T("mcEmpty") :
    `${MC.name||""}\n${(S.lang==="ru"?"Заболевания: ":"Conditions: ")}${MC.cond||"—"}\n`+
    `${(S.lang==="ru"?"Аллергии: ":"Allergies: ")}${MC.allergy||"—"}\n`+
    `${(S.lang==="ru"?"Группа крови: ":"Blood type: ")}${MC.blood||"—"}\n`+
    `${(S.lang==="ru"?"Лекарства: ":"Medicines: ")}${alarms.map(a=>a.label).join(", ")||"—"}\n`+
    `${(S.lang==="ru"?"Контакт: ":"Contact: ")}${sos[0]?sos[0].name+" "+sos[0].phone:"—"}`;
  el.mcName.value=MC.name||""; el.mcCond.value=MC.cond||""; el.mcAllergy.value=MC.allergy||""; el.mcBlood.value=MC.blood||"";
}
el.mcSave.addEventListener("click", ()=>{
  MC = {name:el.mcName.value.trim(), cond:el.mcCond.value.trim(), allergy:el.mcAllergy.value.trim(), blood:el.mcBlood.value.trim()};
  save("nv.mc", JSON.stringify(MC)); renderMedCard(); speak(T("mcSaved"));
});
el.medSpeak.addEventListener("click", ()=>speak(el.medCard.textContent));

/* weekly summary */
function renderLog(){
  const weekAgo = Date.now() - 7*86400000;
  const rec = LOG.filter(e=>e.t > weekAgo);
  const drinks = rec.filter(e=>e.kind==="drink").length;
  const meals  = rec.filter(e=>e.kind==="meal").length;
  const taken  = rec.filter(e=>e.kind==="med_taken").length;
  const due    = rec.filter(e=>e.kind==="med_due").length;
  const falls  = rec.filter(e=>e.kind==="fall_suspected").length;
  el.logSummary.textContent = T("logLine",{drinks, meals, taken, total: Math.max(due,taken), falls});
}
el.logExport.addEventListener("click", ()=>{
  const weekAgo = Date.now()-7*86400000;
  const lines = LOG.filter(e=>e.t>weekAgo).map(e=>`${new Date(e.t).toLocaleString()}  ${e.kind}  ${e.detail}`);
  const blob = new Blob([el.logSummary.textContent + "\n\n" + lines.join("\n")], {type:"text/plain"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "navi-vica-summary.txt"; a.click();
  speak(T("logSaved"));
});



/* ===================================================================
   HOW TO USE — explained for this person's own profile
   =================================================================== */
function guideTips(){
  const conds = (S.conditions||[]).filter(c=>c!=="carer");
  const G = TO("guideFor") || {};
  let tips = [];
  if (!conds.length) tips = (G._default||[]).slice();
  else conds.forEach(c => (G[c]||[]).forEach(x=>{ if(!tips.includes(x)) tips.push(x); }));
  (TO("guideAlways")||[]).forEach(x=>{ if(!tips.includes(x)) tips.push(x); });
  return tips;
}
function openGuide(){
  openView("guide");
  const name = (ACCT && ACCT.name) ? ACCT.name : "";
  el.guideIntro.textContent = T("guideIntro",{name});
  el.guideList.innerHTML = "";
  guideTips().forEach(txt=>{
    const row = document.createElement("div");
    row.className = "guide-item";
    row.innerHTML = `<span class="g-text">${txt}</span>`;
    const b = document.createElement("button");
    b.className = "g-play"; b.textContent = "🔊";
    b.setAttribute("aria-label", T("guideSpeakLabel"));
    b.addEventListener("click", ()=>speak(txt));
    row.append(b);
    el.guideList.append(row);
  });
  speak(T("guideIntro",{name}));
}
function speakWholeGuide(){
  const all = [T("guideIntro",{name:(ACCT&&ACCT.name)||""})].concat(guideTips()).join(" ");
  speak(all);
}
/* ===================================================================
   UNIFIED COMMAND ROUTER  (Master Spec, Part A1)

   One room, three doorways. A button does not contain logic — it names
   an action. Voice names the same action. Typed text names the same
   action. Everything lands in runAction().
   =================================================================== */
const ACTIONS = {
  /* pages */
  go_home:        ()=> openView("home"),
  open_detect:    ()=> openView("detect"),
  open_nav:       ()=> openView("nav"),
  open_alarms:    ()=> openView("alarms"),
  open_sos:       ()=> openView("sos"),
  open_chat:      ()=> openView("chat"),
  open_read:      ()=> openView("read"),
  open_find:      ()=> openView("find"),
  open_captions:  ()=> openView("captions"),
  open_notes:     ()=> openView("notes"),
  open_services:  ()=> openView("services"),
  open_health:    ()=> openView("health"),
  open_symptoms:  ()=> openView("symptoms"),
  open_settings:  ()=> openView("settings"),
  open_help:      ()=> openView("help"),
  open_account:   ()=> { openView("account"); if (window.AUTH) AUTH.renderAccount(); },
  open_guide:     ()=> openGuide(),
  open_all:       ()=> openView("allfeatures"),

  /* vision */
  eyes_look:      ()=> { openView("detect"); startDetect(); },
  eyes_stop:      ()=> stopDetect(true),
  torch_on:       ()=> setTorch(true),
  torch_off:      ()=> setTorch(false),

  /* reading */
  read_document:  ()=> { openView("read"); if (readStream) readNow(); else startRead().then(()=>setTimeout(readNow,1200)); },

  /* captions */
  captions_start: ()=> { openView("captions"); if (!captionsOn) startCaptions(); },
  captions_stop:  ()=> { if (captionsOn) stopCaptions(); },

  /* navigation */
  navigate_home:  ()=> goHomeAddress(),
  navigate_stop:  ()=> stopNav(true),
  maps_google:    ()=> openMaps("g"),
  maps_yandex:    ()=> openMaps("y"),

  /* medication */
  meds_taken:     ()=> markTakenLatest(),

  /* services */
  cab_order:      (a)=> { openView("services"); openCab((a&&a.which)||"yandex"); },
  food_order:     (a)=> { openView("services"); openFood((a&&a.which)||"yandex"); },
  find_pharmacy:  ()=> findPlaces("pharmacy", null),

  /* safety */
  sos:            ()=> { openView("sos"); if (sos.length) doCall(sos[0]); else speak(T("sosNone")); },
  im_okay:        ()=> { if (fallPending) cancelFall(); else if (checkinPending){ checkinPending=false; logEvent("checkin_ok"); speak(R(CHAT("imfine"))); } else speak(R(CHAT("imfine"))); },
  share_location: ()=> shareLocation(),
  panic_screen:   ()=> setPanic(true),

  /* speech & system — must work on every page */
  repeat_last:    ()=> speak(lastSpoken || T("repeatNone")),
  speak_slower:   ()=> { S.rate=Math.max(60,S.rate-15); save("nv.rate",S.rate); syncSettings(); speak(T("slower")); },
  speak_faster:   ()=> { S.rate=Math.min(130,S.rate+15); save("nv.rate",S.rate); syncSettings(); speak(T("faster")); },
  text_bigger:    ()=> { S.scale=Math.min(160,S.scale+10); save("nv.scale",S.scale); applyScale(); syncSettings(); speak(T("textBigger")); },
  text_smaller:   ()=> { S.scale=Math.max(90,S.scale-10); save("nv.scale",S.scale); applyScale(); syncSettings(); speak(T("textSmaller")); },
  verbose_brief:  ()=> { S.verb="brief"; save("nv.verb","brief"); syncSettings(); speak(T("verbSet",{v:T("verbBrief")})); },
  verbose_detail: ()=> { S.verb="detailed"; save("nv.verb","detailed"); syncSettings(); speak(T("verbSet",{v:T("verbDetailed")})); },
  stop_everything:()=> { stopDetect(false); stopNav(false); if (captionsOn) stopCaptions();
                         speechSynthesis.cancel(); speaking=false; speak(T("stopped")); },
  listen_off:     ()=> { wantListen=false; followUp=false; GSAVE("nv.listen","0"); killRec(); mode="off"; setMic("idle"); speak(T("stopped")); }
};

/* A readable phrase for each action, so a tap produces the same
   transcript line a spoken command would. */
const PHRASE_FOR = {
  open_detect:"tileDetect", open_nav:"tileNav", open_alarms:"tileAlarms", open_sos:"tileSos",
  open_chat:"tileChat", open_read:"tileRead", open_find:"tileFind", open_captions:"tileCaptions",
  open_notes:"tileNotes", open_services:"tileServices", open_health:"tileHealth",
  open_symptoms:"symTitle", open_settings:"tileSettings", open_help:"tileHelp",
  open_guide:"guideBtnLabel", open_all:"allFeaturesLabel", go_home:"barHome"
};




/* Ambiguous words get a choice, never a guess (Master Spec A1).
   A bare "help" may mean an emergency or "how do I use this" —
   calling emergency services by mistake is as harmful as missing one. */
const AMBIGUOUS = [
  {rx:/^(help|help please|помощь|помоги|помогите пожалуйста)$/,
   ask:"askHelpMeaning",
   options:[{label:"askHelpSos", action:"sos"}, {label:"askHelpGuide", action:"open_guide"}]}
];
function disambiguate(entry){
  speak(T(entry.ask));
  const wrap = document.createElement("div");
  wrap.className = "choice-row";
  entry.options.forEach(o=>{
    const b = document.createElement("button");
    b.className = "choice";
    b.textContent = T(o.label);
    b.addEventListener("click", ()=>{ wrap.remove(); press(o.action); });
    wrap.append(b);
  });
  el.chatLog.append(wrap);
  const sc = el.chatLog.parentElement; if (sc) sc.scrollTop = sc.scrollHeight;
  if (currentView !== "chat") openView("chat");
}
/* ---- intents that carry a value (a place, a time, a person) ---- */
function matchSlotIntent(c){
  /* cab / food with a provider */
  if (/(cab|taxi|uber|такси)/.test(c) && /(order|book|call|get me|вызов|вызови|закаж)/.test(c))
    return {action:"cab_order", args:{which:/uber/.test(c)?"uber":"yandex"}};
  if (/(food|meal|eat|delivery|еда|еду|поесть|доставк)/.test(c) && /(order|book|закаж|достав)/.test(c))
    return {action:"food_order", args:{which:/uber/.test(c)?"uber":"yandex"}};
  return null;
}
/* ---- intent table: every phrase maps to an action in ACTIONS ---- */
const INTENTS = [
  ["listen_off",      /(stop listening|don'?t listen|go to sleep|перестань слушать|не слушай|усни)/],
  ["stop_everything", /^(stop|стоп|хватит|останови|прекрати|отмена)/],
  ["im_okay",        /(i'?m ok|i am ok|i'?m fine|all good|я в порядке|всё хорошо|все хорошо|я цел)/],
  ["sos",            /(help me|call for help|emergency|i'?ve fallen|помогите|спасите|вызови помощь|мне плохо срочно)/],
  ["repeat_last",    /(say that again|repeat|what did you say|повтори|что ты сказала|ещё раз|еще раз)/],
  ["speak_slower",   /(slower|speak slow|медленн)/],
  ["speak_faster",   /(faster|speak fast|быстрее)/],
  ["text_bigger",    /(bigger text|larger text|text bigger|крупнее|больше шрифт|увеличь текст)/],
  ["text_smaller",   /(smaller text|text smaller|мельче|меньше шрифт|уменьши текст)/],
  ["verbose_brief",  /(be brief|keep it short|кратко|коротко)/],
  ["verbose_detail", /(more detail|be detailed|подробн)/],
  ["torch_on",       /(light on|torch on|turn on the light|flashlight on|включи свет|включи фонар)/],
  ["torch_off",      /(light off|torch off|выключи свет|выключи фонар)/],
  ["captions_stop",  /(captions off|stop captions|subtitles off|выключи субтитр|останови субтитр)/],
  ["captions_start", /(transcribe|write down what|captions|subtitle|i can'?t hear them|субтитр|запиши что говорят)/],
  ["read_document",  /(read this|read it|read the|what does (this|it) say|прочит|что здесь написано|что тут написано)/],
  ["eyes_stop",      /(stop looking|stop detecting|перестань смотреть|останови осмотр)/],
  ["eyes_look",      /(what'?s in front|what.{0,12}(around|see)|describe|look|detect|scan|take a picture|осмотр|осмотрись|посмотри|что вокруг|что ты видишь|опиши|сфотографируй)/],
  ["navigate_home",  /(take me home|go home|walk me home|i'?m lost|i want to go home|отвед\w* меня домой|как добраться домой|я потерял|домой)/],
  ["navigate_stop",  /(stop guiding|stop navigation|cancel route|останови навигацию|прекрати вести)/],
  ["maps_google",    /(google map|гугл карт)/],
  ["maps_yandex",    /(yandex map|яндекс карт)/],
  ["meds_taken",     /^(taken|i took it|принято|принял|принялa|выпил)/],
  ["find_pharmacy",  /(find a pharmacy|nearest pharmacy|найди аптеку|ближайшая аптека)/],
  ["share_location", /(share my location|send my location|отправь.{0,14}(геолокац|местополож)|где я нахожусь)/],
  ["panic_screen",   /(big screen|panic screen|большой экран)/],
  ["open_guide",     /(how do i use|how to use|show me how|teach me|как пользоваться|как это работает|научи меня|инструкц)/],
  ["open_all",       /(all features|everything you can|show all|все функции|все возможности)/],
  ["open_account",   /(my account|my profile|my details|мой аккаунт|мой профиль|мои данные)/],
  ["open_symptoms",  /(symptom|vitals|blood pressure|log how i feel|симптом|показател|давление|как я себя чувствую)/],
  ["open_notes",     /(my notes|read my notes|note|заметк)/],
  ["open_find",      /(find my things|my things|мои вещи|найти вещи)/],
  ["open_health",    /(health card|medical card|медицинск|мед.?карт)/],
  ["open_services",  /(services|cab|taxi|food|delivery|такси|еда|доставк)/],
  ["open_settings",  /(settings|preferences|настройк)/],
  ["open_help",      /(what can you do|what can i say|что ты умеешь|что ты можешь|что можно сказать)/],
  ["open_alarms",    /(alarm|reminder|medicine|pills|будильник|напомин|лекарств|таблетк)/],
  ["open_captions",  /(listen page|captions page)/],
  ["open_chat",      /(let'?s talk|open chat|поговорим|открой чат)/],
  ["open_detect",    /(eyes page|detect page)/],
  ["open_nav",       /(navigate page|map page|карта)/],
  ["go_home",        /^(home|go home page|главная|на главную|домашний экран)$/]
];
function matchIntent(c){
  for (const [action, rx] of INTENTS) if (rx.test(c)) return action;
  /* language packs carry native spoken phrases for every action, so all
     18 languages command the app exactly like English */
  const kw = (I18N[S.lang] && I18N[S.lang].kw) || null;
  if (kw) for (const [action, phrases] of Object.entries(kw))
    for (const p of phrases) if (c.includes(p)) return action;
  return null;
}

/* Single entry point. source: 'voice' | 'chat' | 'touch' */
function runAction(name, args, source){
  const fn = ACTIONS[name];
  if (!fn) return false;
  if (source === "touch" && PHRASE_FOR[name]) addBubble("user", T(PHRASE_FOR[name]));
  /* every doorway announces itself out loud (pages that greet on their own,
     like the guide, are left to do their talking) */
  if (PHRASE_FOR[name] && name !== "open_guide") speakAck(T(PHRASE_FOR[name]));
  try{ fn(args||{}); }
  catch(e){ console.warn("action",name,e); speak(T("actionFailed")); }
  return true;
}
/* Buttons are thin wrappers — they never duplicate logic. */
function press(name, args){ buzz(HAPTIC.ok); return runAction(name, args, "touch"); }

/* ===================================================================
   VOICE-DRIVEN ACCOUNTS — "create an account" / "log in", spoken or typed,
   in any of the app's languages
   =================================================================== */
let pendingAsk = null;
const SIGNUP_RX = /(create (an |my |a )?account|sign ?up|register me|new account|создай (мне )?аккаунт|зарегистрируй|cr[ée]e[rz]? (un |mon )?compte|inscri[sv]|crear (una )?cuenta|reg[íi]strame|criar (uma )?conta|crea(re)? un account|registrami|konto erstellen|registrier|maak een account|registreren|skapa (ett )?konto|utw[óo]rz konto|za[łl][óo][żz] konto|hesap oluştur|kayıt ol|أنشئ حساب|انشئ حساب|إنشاء حساب|حساب بساز|ثبت نام|खाता बनाओ|नया खाता|注册|创建账户|開設|アカウント(を)?作|계정 만들|가입|створи (мені )?акаунт|зареєструй)/;
const SIGNIN_RX = /(\blog ?in\b|\bsign ?in\b|войди|войти|connecte[- ]moi|me connecter|iniciar sesi[óo]n|entrar na (minha )?conta|accedi al|fammi accedere|melde mich an|anmelden|log mij in|inloggen|logga in|zaloguj|giriş yap|سجل دخول|تسجيل الدخول|وارد شو|ورود کن|लॉग इन|लॉगिन करो|登录|ログイン|로그인|увійди|увійти)/;

function startVoiceSignup(){
  pendingAsk = {type:"signup_name"};
  speak(T("vsAskName"));
}
async function doVoiceSignup(raw){
  const name = String(raw||"").replace(/[.?!,]/g,"").trim();
  if (!name || name.length < 2){ speak(T("vsNoName")); pendingAsk = {type:"signup_name"}; return; }
  if (!window.AUTH || !AUTH.voiceSignup){ speak(T("actionFailed")); return; }
  try{
    const a = await AUTH.voiceSignup(name);
    if (!a){ speak(T("actionFailed")); return; }
    pendingAsk = {type:"setup_condition"}; followUp = true;
    speak(T("vsWelcome",{name}) + " " + T("vsAskCondition"));
  }catch(e){ speak(T("actionFailed")); }
}
function startVoiceSignin(){
  if (!window.AUTH){ speak(T("actionFailed")); return; }
  const accounts = AUTH.list();
  if (!accounts.length){ startVoiceSignup(); return; }
  if (accounts.length === 1){ doVoiceSignin(accounts[0].name); return; }
  pendingAsk = {type:"signin_name"};
  speak(T("vsAskWho"));
}
function doVoiceSignin(raw){
  const r = AUTH.voiceSignin(String(raw||"").replace(/[.?!,]/g,"").trim());
  if (!r){ speak(T("vsNotFound")); pendingAsk = {type:"signin_name"}; return; }
  if (r.needsPassword){ speak(T("vsNeedPw",{name:r.name})); }
}
/* first spoken setup: the person names their difficulty, VICA shapes the app */
function applyVoiceCondition(c){
  const conds = TO("conditions") || {};
  const picked = [];
  for (const [key,label] of Object.entries(conds)){
    const words = String(label).toLowerCase().replace(/[^\p{L}\s]/gu," ").split(/\s+/).filter(w=>w.length>3);
    if (words.some(w=>c.includes(w))) picked.push(key);
  }
  const extra = [
    ["vision",   /(see|sight|eye|blind|зрен|глаз|вижу|voir|vue|yeux|vista|ojos|olhos|augen|sehen|ogen|syn|ögon|wzrok|göz|بصر|عين|چشم|बिनाई|आंख|视力|目|시력|зір)/],
    ["hearing",  /(hear|deaf|слыш|слух|entend|sourd|o[íi]do|escut|ouvi|h[öo]r|geh[öo]r|s[łl]ysz|duy|سمع|شنو|सुन|听|耳|청각|чую)/],
    ["motor",    /(walk|move|wheelchair|leg|ход|двига|коляс|ноги|march|jamb|camin|pierna|andar|perna|geh|lauf|lopen|g[åa]|chodz|y[üu]r[üu]|مشي|حرك|راه رفتن|चल|走|歩|걷|ходити)/],
    ["cognitive",/(memory|forget|памят|забыв|m[ée]moire|oubli|memoria|olvid|mem[óo]ria|esquec|ged[äa]cht|vergess|geheugen|minne|pami[ęe][ćc]|haf[ıi]za|unut|ذاكرة|نسي|حافظه|فراموش|याद|भूल|记忆|忘|기억|пам)/],
    ["chronic",  /(health|pressure|diabet|heart|болезн|давлен|сердц|диабет|sant[ée]|tension|c[œo]ur|salud|coraz[óo]n|sa[úu]de|cora[çc][ãa]o|gesundheit|herz|gezondheid|hart|h[äa]lsa|hj[äa]rta|zdrowi|serc|sa[ğg]l[ıi]k|kalp|صحة|قلب|سلامتی|سکر|सेहत|दिल|健康|心脏|心臓|건강|심장|тиск|серц)/],
    ["speech",   /(speak|talk|voice trouble|говор|речь|parle|habla|fala|sprech|spreken|tala|m[óo]wi|konu[şs]|كلام|نطق|صحبت|बोल|说话|話す|말하|мовлен)/],
    ["mood",     /(lonely|sad|alone|одинок|грустн|seul|triste|solo|sozinho|einsam|traurig|eenzaam|ensam|samotn|yaln[ıi]z|وحيد|حزين|تنها|अकेल|उदास|孤独|寂し|외로|самотн)/]
  ];
  for (const [k,rx] of extra) if (rx.test(c) && !picked.includes(k)) picked.push(k);
  if (!picked.length){ pendingAsk = {type:"setup_condition"}; speak(T("vsCondUnknown")); return; }
  tailorFromConditions(picked, false);
  if (window.AUTH && AUTH.saveConditions) AUTH.saveConditions(picked);
  speak(T("vsCondSet"));
}

/* ===================================================================
   THE BRAIN — every feature reachable by speech or text
   =================================================================== */
let rehearsing = false;
function handle(raw){
  const c = String(raw||"").toLowerCase().trim();
  const say = (s)=>speak(s);
  followUp = true;   /* after the reply, the mic reopens by itself */

  /* dictating a note takes priority */
  if (noteCapture){ noteCapture = false; addNote(raw.trim()); openView("notes"); return; }

  /* VICA asked a question — this is the answer */
  if (pendingAsk){
    const ask = pendingAsk; pendingAsk = null;
    if (ask.type === "signup_name"){ doVoiceSignup(raw); return; }
    if (ask.type === "signin_name"){ doVoiceSignin(raw); return; }
    if (ask.type === "setup_condition"){ applyVoiceCondition(c); return; }
  }

  /* she can open the door herself: spoken or typed account creation/login */
  if (SIGNUP_RX.test(c)){ startVoiceSignup(); return; }
  if (!/(sign out|log out|выйти|выход)/.test(c) && SIGNIN_RX.test(c)){ startVoiceSignin(); return; }

  /* ---- unified router: typed, spoken and tapped all land here ---- */
  for (const amb of AMBIGUOUS){ if (amb.rx.test(c)){ disambiguate(amb); return; } }
  const slotted = matchSlotIntent(c);
  if (slotted){ runAction(slotted.action, slotted.args, "voice"); return; }
  const direct = matchIntent(c);
  if (direct){ runAction(direct, {}, "voice"); return; }

  /* answering a fall check or a check-in */
  if (/(i'?m ok|i am ok|i'?m fine|all good|я в порядке|всё хорошо|все хорошо|нормально|я цела|я цел)/.test(c)){
    if (fallPending){ cancelFall(); return; }
    if (checkinPending){ checkinPending=false; logEvent("checkin_ok"); say(R(CHAT("imfine"))); return; }
  }
  if (/(help me|call for help|помогите|спасите|вызови помощь)/.test(c)){
    openView("sos");
    if (sos.length) doCall(sos[0]); else { say(T("sosNone")); }
    return;
  }

  /* rehearsal mode */
  if (/(practice|practise|rehears|тренировк|потренир)/.test(c)){ setRehearse(!rehearsing); return; }
  if (/(stop practising|stop practice|закончить тренировку|хватит тренир)/.test(c)){ setRehearse(false); return; }

  /* global stop */
  if (/^(stop|стоп|хватит|останови|прекрати|отмена)/.test(c)){
    stopDetect(false); stopNav(false); if (captionsOn) stopCaptions();
    speechSynthesis.cancel(); speaking=false; say(T("stopped")); return;
  }
  /* repeat */
  if (/(say that again|repeat|what did you say|повтори|что ты сказала|ещё раз|еще раз)/.test(c)){ say(lastSpoken || T("repeatNone")); return; }

  /* language */
  const langHit = matchLangSwitch(c);
  if (langHit && langHit !== S.lang){ setLang(langHit); return; }
  if (/(по-английски|на англ)/.test(c)){ setLang("en"); return; }

  /* speech settings */
  if (/(slower|speak slow|медленн)/.test(c)){ S.rate=Math.max(60,S.rate-15); save("nv.rate",S.rate); syncSettings(); say(T("slower")); return; }
  if (/(faster|speak fast|быстрее)/.test(c)){ S.rate=Math.min(130,S.rate+15); save("nv.rate",S.rate); syncSettings(); say(T("faster")); return; }
  if (/(brief|short|кратко|коротко)/.test(c)){ S.verb="brief"; save("nv.verb","brief"); syncSettings(); say(T("verbSet",{v:T("verbBrief")})); return; }
  if (/(more detail|detailed|подробн)/.test(c)){ S.verb="detailed"; save("nv.verb","detailed"); syncSettings(); say(T("verbSet",{v:T("verbDetailed")})); return; }

  /* torch */
  if (/(light on|torch on|turn on the light|flashlight|включи свет|включи фонар)/.test(c)){ setTorch(true); return; }
  if (/(light off|torch off|выключи свет|выключи фонар)/.test(c)){ setTorch(false); return; }

  /* profiles */
  if (/(mobility|подвижн)/.test(c) && /(profile|mode|профиль|режим)/.test(c)){ setProfile("mobility"); return; }
  if (/(vision|зрени)/.test(c) && /(profile|mode|профиль|режим)/.test(c)){ setProfile("vision"); return; }
  if (/(cognitive|когнитив|память)/.test(c) && /(profile|mode|профиль|режим)/.test(c)){ setProfile("cognitive"); return; }
  if (/(health|здоров)/.test(c) && /(profile|mode|monitor|профиль|режим|контрол)/.test(c)){ setProfile("health"); return; }

  /* reading (OCR) */
  if (/(read this|read it|read the|what does (this|it) say|прочит|что здесь написано|что тут написано)/.test(c)){
    openView("read"); if (readStream) readNow(); else startRead().then(()=>setTimeout(readNow,1200)); return;
  }
  /* captions */
  if (/(caption|subtitle|субтитр)/.test(c)){ openView("captions"); if (!captionsOn) startCaptions(); return; }

  /* find my things */
  const fq = c.match(/(?:where (?:are|is) my |где (?:мои|моя|мой|мое|моё) )(.+)/);
  if (fq){ answerFind(fq[1].trim()); return; }

  /* notes */
  if (/(make a note|write.*note|заметк|запиши)/.test(c)){
    const m = c.match(/(?:note|заметку|запиши)[:\s]+(.+)/);
    if (m){ addNote(m[1].trim()); openView("notes"); } else { openView("notes"); noteCapture=true; speak(T("notePh")); setTimeout(micTap,1200); }
    return;
  }
  if (/(read my notes|my notes|мои заметки|прочитай заметки)/.test(c)){
    openView("notes");
    say(notes.length ? T("noteList",{list:notes.slice(-5).map(n=>n.text).join(". ")}) : T("noteEmpty")); return;
  }

  /* health card */
  if (/(health card|medical card|my details|медицинск|мед.?карт)/.test(c)){ openView("health"); renderMedCard(); speak(el.medCard.textContent); return; }

  /* detection */
  if (/(detect|look around|scan|what.{0,12}(around|see)|describe|take a picture|осмотр|осмотрись|посмотри|что вокруг|что ты видишь|опиши|сфотографируй)/.test(c)){
    openView("detect"); startDetect(); return;
  }

  /* cab & food */
  if (/(cab|taxi|uber|такси)/.test(c) && /(order|book|call|вызов|вызови|закаж)/.test(c)){ openView("services"); openCab(/uber/.test(c)?"uber":"yandex"); return; }
  if (/(food|meal|eat|delivery|еда|еду|поесть|доставк)/.test(c) && /(order|book|закаж|достав)/.test(c)){ openView("services"); openFood(/uber/.test(c)?"uber":"yandex"); return; }

  /* maps hand-off */
  if (/(google map|гугл карт)/.test(c)){ openMaps("g"); return; }
  if (/(yandex map|яндекс карт)/.test(c)){ openMaps("y"); return; }

  /* alarms */
  if (/(taken|принял|принято|выпил|сделал)/.test(c) && alarms.length){
    const a = alarms.find(x=>!x.taken);
    if (a){ a.taken=true; saveAlarms(); renderAlarms(); logEvent("med_taken",a.label); say(T("alarmTakenMsg",{label:a.label})); return; }
  }
  if (/(delete|remove|убери|удали)/.test(c) && /(alarm|reminder|будильник|напомин)/.test(c)){
    let i = alarms.findIndex(a=>c.includes(a.label.toLowerCase()));
    if (i<0) i = alarms.length-1;
    if (i>=0){ const [a]=alarms.splice(i,1); saveAlarms(); renderAlarms(); say(T("alarmDeleted",{label:a.label})); }
    openView("alarms"); return;
  }
  const am = c.match(/(?:alarm|remind|будильник|напомни(?:ть)?)[^\d]*(\d{1,2})(?:[:.\s](\d{2}))?/);
  if (am){
    let h=parseInt(am[1],10), m=am[2]?parseInt(am[2],10):0;
    if (/p\.?m|вечера|дня/.test(c) && h<12) h+=12;
    const lm = c.match(/(?:to |для |чтобы )(.+)$/);
    const label = lm ? lm[1].trim() : (el.alarmLabel.value.trim() || (S.lang==="ru"?"Принять лекарство":"Take my medicine"));
    openView("alarms");
    addAlarm(String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"), label);
    return;
  }

  /* calls */
  const cm = c.match(/(?:call|звони|позвони(?:ть)?)\s+(.+)/);
  if (cm){
    const who = cm[1].trim();
    if (/emergency|ambulance|скорую|скорая|экстрен|112|911|103/.test(who)){ openView("sos"); doCall({name:S.lang==="ru"?"скорую":"emergency", phone:/скор|ambulance|103/.test(who)?"103":"112"}); return; }
    const hit = sos.find(p=>who.includes(p.name.toLowerCase())||p.name.toLowerCase().includes(who));
    if (hit){ doCall(hit); return; }
    if (sos.length){ doCall(sos[0]); return; }
    openView("sos"); say(T("sosNone")); return;
  }
  if (/(share my location|send my location|отправь.{0,12}(геолокац|местополож)|где я нахожусь)/.test(c)){ shareLocation(); return; }

  /* take me home (uses the saved home address) */
  if (/(take me home|go home|walk me home|отвед[иь] меня домой|как добраться домой|домой)/.test(c)){ goHomeAddress(); return; }

  /* my account */
  if (/(my account|my profile|my details|мой аккаунт|мой профиль|мои данные)/.test(c)){ openView("account"); if (window.AUTH) AUTH.renderAccount(); return; }
  if (/(sign out|log out|выйти из аккаунта|выход)/.test(c)){ openView("account"); return; }

  /* navigation */
  const kinds=[
    {k:"pharmacy",rx:/pharmac|аптек|drugstore/},{k:"hospital",rx:/hospital|больниц|клиник|поликлин/},
    {k:"bus",rx:/bus|автобус|останов/},{k:"taxi",rx:/taxi rank|стоянк.{0,10}такси/},
    {k:"shop",rx:/shop|store|grocer|магазин|продукт/},{k:"food",rx:/restaurant|cafe|кафе|ресторан/},
    {k:"toilet",rx:/toilet|restroom|туалет/},{k:"bank",rx:/bank|atm|банк|банкомат/}
  ];
  const navVerb=/(find|nearest|navigate|take me|guide|go to|where is the|walk me|найди|ближайш|отведи|доведи|как пройти|как добраться)/.test(c);
  for (const kd of kinds) if (kd.rx.test(c) && navVerb){ findPlaces(kd.k,null); return; }
  const fm = c.match(/(?:find|take me to|go to|navigate to|найди|отведи меня|доведи до|как пройти к|как добраться до)\s+(?:a |the |nearest |ближайш\w+ )?(.+)/);
  if (fm){ findPlaces(null, fm[1].trim()); return; }

  /* open a page by name */
  const pages = {detect:/detect|осмотр/, nav:/navigat|map|навигац|карт/, alarms:/alarm|reminder|будильник|напомин/,
    sos:/sos|emergency|экстрен|помощь/, chat:/chat|общен|поболта/, read:/read|прочит/, find:/find my|мои вещи/,
    captions:/caption|субтитр/, notes:/note|заметк/, services:/service|cab|food|такси|еда/, health:/health card|мед/,
    settings:/setting|настройк/, help:/help|what can you|что ты умеешь|обучен|подсказк/};
  for (const [id,rx] of Object.entries(pages)) if (new RegExp("^(open|show|go to|открой|покажи|перейди)").test(c) && rx.test(c)){ openView(id); return; }
  if (/(help|what can you do|что ты умеешь|что ты можешь|подскажи что)/.test(c)){ openView("help"); say(T("helpIntro")+" "+TO("helpItems").slice(0,6).join(". ")); return; }

  /* ------ small talk ------ */
  if (/(^|\s)(hello|hi|hey|good morning|good evening|здравств|привет|добрый|доброе)/.test(c)){ say(R(CHAT("hello"))); return; }
  if (/(how are you|how do you feel|как( у тебя| твои)? дела|как ты|как поживаешь)/.test(c)){ say(R(CHAT("howareyou"))); return; }
  if (/(i'?m (fine|good|great|well)|у меня (все|всё) хорошо|хорошо себя)/.test(c)){ say(R(CHAT("imfine"))); return; }
  if (/(i'?m (sad|tired|sick|bad|unwell|lonely|hurt)|мне (плохо|грустно|больно)|устал|болит|нехорошо)/.test(c)){ say(R(CHAT("imbad"))); return; }
  if (/(thank|спасибо|благодар)/.test(c)){ say(R(CHAT("thanks"))); return; }
  if (/(your name|who are you|кто ты|как тебя зовут)/.test(c)){ say(R(CHAT("name"))); return; }
  if (/(how old|сколько тебе лет|твой возраст)/.test(c)){ say(R(CHAT("age"))); return; }
  if (/(joke|funny|шутк|анекдот|рассмеши)/.test(c)){ say(R(CHAT("joke"))); return; }
  if (/(love you|люблю тебя|ты мне нрав)/.test(c)){ say(R(CHAT("love"))); return; }
  if (/(bored|скучно|скука)/.test(c)){ say(R(CHAT("bored"))); return; }
  if (/(lonely|alone|одинок|один дома|одна дома)/.test(c)){ say(R(CHAT("lonely"))); return; }
  if (/(my (son|daughter|wife|husband|family|grandchild)|моя (дочь|жена|семья)|мой (сын|муж|внук))/.test(c)){ say(R(CHAT("family"))); return; }
  if (/(i remember|when i was young|я помню|когда я был|когда я была)/.test(c)){ say(R(CHAT("memory"))); return; }
  if (/\btime\b|который час|сколько времени/.test(c)){ say(fill(R(CHAT("time")),{time:nowTime()})); return; }
  if (/(what day|date|какое.*число|какой.*день|какое сегодня)/.test(c)){ say(fill(R(CHAT("date")),{date:nowDate()})); return; }
  if (/(weather|погод)/.test(c)){ say(R(CHAT("weather"))); return; }

  aiChat(raw, ()=>say(R(CHAT("fallback"))));
}

/* Gemini small talk through the optional NAVI-VICA backend. The cloud is an
   enhancement, never a dependency: with no BACKEND_URL (or offline) the
   built-in reply is spoken instead. */
const AI_ACTION_VIEW = { open_camera:"detect", open_meds:"alarms", open_settings:"settings", show_help:"help" };
function aiChat(text, fallback){
  const base = String((window.VICA_CONFIG && window.VICA_CONFIG.BACKEND_URL) || "").replace(/\/+$/,"");
  if (!base || navigator.onLine === false){ fallback(); return; }
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), 12000);
  fetch(base + "/api/process-voice", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ text:String(text||""), context:"NAVI-VICA web app, user language: " + S.lang }),
    signal: ctrl.signal
  }).then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP "+r.status)))
    .then(d => {
      clearTimeout(timer);
      if (d && d.response_text) speak(d.response_text); else fallback();
      const v = d && AI_ACTION_VIEW[d.action]; if (v) openView(v);
    })
    .catch(()=>{ clearTimeout(timer); fallback(); });
}
function sendChat(){
  const t = el.chatInput.value.trim(); if (!t) return;
  el.chatInput.value = ""; addBubble("user", t); handle(t);
}
el.chatSend.addEventListener("click", sendChat);
el.chatInput.addEventListener("keydown", e=>{ if(e.key==="Enter") sendChat(); });

/* ---------- rehearsal ---------- */
function setRehearse(on){
  rehearsing = on;
  el.rehearseBox.textContent = on ? T("rehearseOn") : "";
  speak(on ? T("rehearseOn") : T("rehearseOff"));
}
el.rehearseBtn.addEventListener("click", ()=>setRehearse(!rehearsing));
function renderHelp(){
  el.helpList.innerHTML = "";
  TO("helpItems").forEach(t=>{
    const d=document.createElement("div"); d.className="item";
    d.innerHTML = `<div class="main"><div class="t1">${t}</div></div>`;
    const b=document.createElement("button"); b.className="ok"; b.textContent="🔊";
    b.addEventListener("click",()=>speak(t));
    d.append(b); el.helpList.append(d);
  });
}
/* ---------- panic screen ---------- */
function setPanic(on){
  el.panic.hidden = !on;
  if (on){ el.panicText.textContent = T("panicText"); speak(T("panicText")); buzz(HAPTIC.danger); }
}
el.panicBtn.addEventListener("click", ()=>setPanic(true));
el.panicClose.addEventListener("click", ()=>setPanic(false));
el.panicCall.addEventListener("click",(e)=>{ if(rehearsing){ e.preventDefault(); speak(T("rehearsePretend")); } });

/* ---------- settings ---------- */
function syncSettings(){
  el.confRange.value=S.conf; el.confVal.textContent=S.conf+"%";
  el.verbSelect.value=S.verb; el.modelSelect.value=S.model;
  el.rateRange.value=S.rate; el.rateVal.textContent=S.rate+"%";
  el.hapticToggle.checked=S.haptic; el.spatialToggle.checked=S.spatial;
  el.checkinSelect.value=String(S.checkin); el.fallToggle.checked=S.fall;
}
el.rateRange.addEventListener("input", ()=>{ el.rateVal.textContent = el.rateRange.value+"%"; });
el.rateRange.addEventListener("change", ()=>{ S.rate=parseInt(el.rateRange.value,10); save("nv.rate",S.rate); speak(T("rateSet")); });
el.hapticToggle.addEventListener("change", ()=>{ S.haptic=el.hapticToggle.checked; save("nv.haptic",S.haptic?"1":"0"); buzz(HAPTIC.ok); });
el.spatialToggle.addEventListener("change", ()=>{ S.spatial=el.spatialToggle.checked; save("nv.spatial",S.spatial?"1":"0"); tone(600,0.15,-0.8); });
el.checkinSelect.addEventListener("change", ()=>{ S.checkin=parseInt(el.checkinSelect.value,10); save("nv.checkin",S.checkin); armCheckin(); });

/* caregiver setup code */
el.cfgExport.addEventListener("click", async ()=>{
  const cfg = {S, sos, alarms, appts, MC};
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  try{ await navigator.clipboard.writeText(code); }catch(e){ prompt("Setup code:", code); }
  speak(T("cfgCopied"));
});
el.cfgImport.addEventListener("click", ()=>{
  const code = prompt(T("cfgImportLabel"));
  if (!code) return;
  try{
    const cfg = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    Object.assign(S, cfg.S||{});
    sos = cfg.sos||sos; alarms = cfg.alarms||alarms; appts = cfg.appts||appts; MC = cfg.MC||MC;
    save("nv.sos",JSON.stringify(sos)); saveAlarms(); saveAppts(); save("nv.mc",JSON.stringify(MC));
    ["lang","profile","conf","model","verb","rate","checkin"].forEach(k=>save("nv."+k,S[k]));
    applyLang(); syncSettings(); renderSos(); renderAlarms(); renderAppts(); renderMedCard();
    speak(T("cfgImported"));
  }catch(e){ speak(T("cfgBad")); }
});

/* battery awareness */
async function watchBattery(){
  if (!navigator.getBattery) return;
  try{
    const b = await navigator.getBattery();
    const upd = ()=>{
      const p = Math.round(b.level*100);
      el.battVal.textContent = p + "%";
      if (p <= 15 && !b.charging && S.model !== "t"){
        S.model = "t"; save("nv.model","t"); session=null; sessionModel=null; syncSettings();
        speak(T("battLow",{p}));
      }
    };
    upd(); b.addEventListener("levelchange", upd); b.addEventListener("chargingchange", upd);
  }catch(e){}
}

/* ---------- profile & language ---------- */
function setProfile(p, announce){
  S.profile = p; save("nv.profile", p);
  el.profileSelect.value = p; el.profileBadge.textContent = TO("profiles")[p];
  lastSaid = "";
  if (announce !== false) speak(TO("profileSet")[p]);
}
/* Full translation packs: en+ru live in i18n.js, every other language
   loads its pack on demand so each one speaks, reads and obeys commands
   exactly like English. */
const PACKS = ["ar","de","es","fa","fr","hi","it","ja","ko","nl","pl","pt","sv","tr","uk","zh"];
function loadLangPack(code, done){
  if (!PACKS.includes(code) || (I18N[code] && I18N[code]._packed)){ if (done) done(); return; }
  const s = document.createElement("script");
  s.src = "lang/" + code + ".js";
  s.onload = ()=>{ I18N[code]._packed = true; if (done) done(); };
  s.onerror = ()=>{ if (done) done(); };
  document.head.append(s);
}
function setLang(code, announce){
  if (!I18N[code]) return;
  S.lang = code; save("nv.lang", code);
  loadLangPack(code, ()=>{
    applyLang();
    if (announce !== false) speak(T("langChanged"));
    if (mode === "wake") startWake();
  });
}
/* every language can be asked for by name, in that language or English */
const LANG_NAMES = {
  en:["english"], ru:["russian","русск","по-русски"], tr:["turkish","türkçe","turkce"],
  ar:["arabic","العربية","عربي"], fr:["french","français","francais"], de:["german","deutsch"],
  es:["spanish","español","espanol"], pt:["portuguese","português","portugues"],
  zh:["chinese","中文","汉语","普通话"], ja:["japanese","日本語","にほんご"], ko:["korean","한국어"],
  hi:["hindi","हिन्दी","हिंदी"], it:["italian","italiano"], nl:["dutch","nederlands"],
  sv:["swedish","svenska"], pl:["polish","polski","po polsku"], uk:["ukrainian","українськ","украинск"],
  fa:["farsi","persian","فارسی"]
};
function matchLangSwitch(c){
  const wantsSwitch = /(speak|talk|switch|language|говори|перейди|язык|мова|parle|sprich|habla|parla|fala|说|話して|말해|बोलो|spreek|prata|mów|розмовляй|حرف بزن|تكلم)/.test(c);
  for (const [code, names] of Object.entries(LANG_NAMES))
    for (const n of names)
      if (c.includes(n) && (wantsSwitch || c.length < 26)) return code;
  return null;
}
function buildGreeting(){
  const h = new Date().getHours();
  const dp = h<12 ? T("daypartMorning") : h<18 ? T("daypartAfternoon") : T("daypartEvening");
  return T("greeting",{daypart:dp});
}
function applyLang(){
  document.documentElement.lang = S.lang;
  document.documentElement.dir = (S.lang==="ar"||S.lang==="fa") ? "rtl" : "ltr";
  el.langSelect.value = S.lang;
  const set = (id,k)=>{ if (el[id]) el[id].textContent = T(k); };
  set("statusText","statusIdle");
  set("barHomeLabel","barHome"); set("barRepeatLabel","barRepeat");
  set("allFeaturesLabel","allFeaturesLabel"); set("allTitle","allTitle");
  set("guideBtnLabel","guideBtnLabel"); set("guideTitle","guideTitle");
  set("guideSpeakLabel","guideSpeakLabel"); set("guidePracticeLabel","guidePracticeLabel");
  set("profileLabel","profileLabel");
  set("symTitle","symTitle"); set("symHint","symHint"); set("vitalAddLabel","vitalAddLabel");
  el.vitalName.placeholder = T("vitalNamePh"); el.vitalVal.placeholder = T("vitalValPh");
  renderHome(); renderAllFeatures(); renderAAC(); renderSymChips();
  if (window.AUTH) AUTH.applyAuthLang();
  set("detTitle","detTitle"); set("detBtnLabel","detBtn"); set("detStopLabel","detStop");
  set("confLabel","confLabel"); set("verbLabel","verbLabel"); set("modelLabel","modelLabel");
  el.verbSelect.options[0].textContent=T("verbBrief"); el.verbSelect.options[1].textContent=T("verbDetailed");
  set("navTitle","navTitle"); set("navStopLabel","navStopBtn"); el.navQuery.placeholder=T("navPh");
  set("alarmTitle","alarmTitle"); set("alarmAddLabel","alarmAdd"); el.alarmLabel.placeholder=T("alarmPh");
  set("apptTitle","apptTitle"); el.apptLabel.placeholder=T("apptPh");
  set("sosTitle","sosTitle"); set("sosCallLabel","sosCall"); set("ambLabel","ambLabel");
  set("shareLocLabel","shareLocLabel"); set("sosAddLabel","sosAdd");
  el.sosName.placeholder=T("sosNamePh"); el.sosPhone.placeholder=T("sosPhonePh");
  set("fallTitle","fallTitle"); set("fallLabel","fallLabel"); set("fallNote","fallNote");
  set("chatTitle","chatTitle"); el.chatInput.placeholder=T("chatPh");
  set("readTitle","readTitle"); set("readHint","readHint"); set("readStartLabel","readStartLabel"); set("readShotLabel","readShotLabel");
  set("findTitle","findTitle"); set("findHint","findHint");
  set("capTitle","capTitle"); set("capHint","capHint"); set("capStartLabel","capStartLabel"); set("capStopLabel","capStopLabel");
  set("notesTitle","notesTitle"); set("noteSpeakLabel","noteSpeakLabel"); el.noteInput.placeholder=T("notePh");
  set("svcTitle","svcTitle"); set("cabTitle","cabTitle"); set("cabNote","cabNote"); set("foodTitle","foodTitle");
  set("pharmTitle","pharmTitle"); set("pharmFindLabel","pharmFindLabel"); set("scamTitle","scamTitle");
  el.scamInput.placeholder=T("scamPh");
  set("healthTitle","healthTitle"); set("medSpeakLabel","medSpeakLabel"); set("medEditTitle","medEditTitle");
  el.mcName.placeholder=T("mcNamePh"); el.mcCond.placeholder=T("mcCondPh");
  el.mcAllergy.placeholder=T("mcAllergyPh"); el.mcBlood.placeholder=T("mcBloodPh");
  set("mcSaveLabel","mcSaveLabel"); set("logTitle","logTitle"); set("logExportLabel","logExportLabel");
  set("setTitle","setTitle"); set("rateLabel","rateLabel"); set("hapticLabel","hapticLabel");
  const vl = document.getElementById("voiceLabel"); if (vl) vl.textContent = T("voiceLabel");
  populateVoicePicker();
  set("spatialLabel","spatialLabel"); set("checkinLabel","checkinLabel"); set("battLabel","battLabel");
  set("caregiverTitle","caregiverTitle"); set("caregiverNote","caregiverNote");
  set("cfgExportLabel","cfgExportLabel"); set("cfgImportLabel","cfgImportLabel"); set("panicLabel","panicLabel");
  set("helpTitle","helpTitle"); set("rehearseLabel","rehearseLabel");
  el.checkinSelect.options[0].textContent=T("checkinOff");
  [4,8,12].forEach((n,i)=> el.checkinSelect.options[i+1].textContent = T("checkinH",{n}));
  el.greetText.textContent = buildGreeting();
  /* profile dropdown */
  const profs = TO("profiles");
  el.profileSelect.innerHTML="";
  for (const [k,v] of Object.entries(profs)){ const o=document.createElement("option"); o.value=k; o.textContent=v; el.profileSelect.append(o); }
  el.profileSelect.value = S.profile; el.profileBadge.textContent = profs[S.profile];
  /* nav chips */
  el.navChips.innerHTML="";
  for (const [k,v] of Object.entries(TO("chips"))){
    const b=document.createElement("button"); b.className="chip"; b.textContent=v;
    b.addEventListener("click",()=>findPlaces(k,null)); el.navChips.append(b);
  }
  renderAlarms(); renderAppts(); renderSos(); renderNotes(); renderMedCard(); renderLog(); renderHelp();
}

/* ===================================================================
   ADAPTIVE HOME · AAC · ORIENTATION · SYMPTOMS
   =================================================================== */
const VIEW_ACTION = {detect:"open_detect", nav:"open_nav", alarms:"open_alarms", sos:"open_sos",
  chat:"open_chat", read:"open_read", find:"open_find", captions:"open_captions", notes:"open_notes",
  services:"open_services", health:"open_health", symptoms:"open_symptoms", settings:"open_settings",
  help:"open_help"};
function tileButton(id, big){
  const f = FEATURES[id]; if (!f) return null;
  const b = document.createElement("button");
  b.className = big ? ("tile " + (f.cls||"")) : "mini";
  b.innerHTML = `<span class="ico">${f.ico}</span><span>${T(f.k)}</span>`;
  b.addEventListener("click", ()=> press(VIEW_ACTION[id] || "go_home"));
  return b;
}
function homeTileIds(){
  const conds = S.conditions.filter(c=>c!=="carer");
  let ids = [];
  if (!conds.length) ids = HOME_FOR._default.slice();
  else conds.forEach(c => (HOME_FOR[c]||[]).forEach(t=>{ if(!ids.includes(t)) ids.push(t); }));
  // always keep SOS reachable on the home screen
  if (!ids.includes("sos")) ids.push("sos");
  return ids.slice(0, 6);
}
function renderHome(){
  if (!el.homeGrid) return;
  el.homeGrid.innerHTML = "";
  homeTileIds().forEach(id => { const b = tileButton(id, true); if (b) el.homeGrid.append(b); });
  // orientation card only for memory support
  const showOrient = S.conditions.includes("cognitive");
  el.orientCard.hidden = !showOrient;
  if (showOrient) updateOrient();
  // AAC strip only for speech
  el.aacStrip.hidden = !S.conditions.includes("speech");
}
function renderAllFeatures(){
  if (!el.allGrid) return;
  el.allGrid.innerHTML = "";
  Object.keys(FEATURES).forEach(id => { const b = tileButton(id, false); if (b) el.allGrid.append(b); });
}
function updateOrient(){
  const d = new Date();
  const day = d.toLocaleDateString(S.lang==="ru"?"ru-RU":"en-US",{weekday:"long",day:"numeric",month:"long"});
  el.orientText.textContent = T("orientTemplate",{day, time:nowTime()});
}
setInterval(()=>{ if (S.conditions && S.conditions.includes("cognitive") && !el.orientCard.hidden) updateOrient(); }, 60000);

function renderAAC(){
  if (!el.aacStrip) return;
  el.aacStrip.innerHTML = "";
  (TO("aacPhrases")||[]).forEach(ph=>{
    const b=document.createElement("button"); b.className="aac"; b.textContent=ph;
    b.addEventListener("click", ()=>{ speak(ph); });   /* speaks for the user; no spoken confirm forced */
    el.aacStrip.append(b);
  });
}
/* symptom & vitals log */
let SYM = JSON.parse(LS("nv.sym","[]"));
function renderSymChips(){
  if (!el.symChips) return;
  el.symChips.innerHTML = "";
  (TO("symChips")||[]).forEach(s=>{
    const b=document.createElement("button"); b.className="chip"; b.textContent=s;
    b.addEventListener("click", ()=>logSymptom(s));
    el.symChips.append(b);
  });
}
function renderSym(){
  if (!el.symList) return;
  el.symList.innerHTML="";
  SYM.slice().reverse().slice(0,20).forEach(s=>{
    const d=document.createElement("div"); d.className="item";
    d.innerHTML=`<div class="main"><div class="t1">${s.what}</div><div class="t2">${new Date(s.t).toLocaleString(S.lang==="ru"?"ru-RU":"en-US")}</div></div>`;
    el.symList.append(d);
  });
}
function logSymptom(what){
  SYM.push({t:Date.now(), what}); save("nv.sym", JSON.stringify(SYM)); renderSym();
  logEvent("symptom", what);
  speak(T("symLogged",{what}));
}
if (el.vitalAdd) el.vitalAdd.addEventListener("click", ()=>{
  const n=el.vitalName.value.trim(), v=el.vitalVal.value.trim();
  if(!n||!v) return;
  SYM.push({t:Date.now(), what:`${n}: ${v}`}); save("nv.sym", JSON.stringify(SYM)); renderSym();
  logEvent("vital", `${n} ${v}`);
  el.vitalName.value=""; el.vitalVal.value="";
  speak(T("vitalLogged",{name:n, val:v}));
});

/* visual flash alert for hearing loss (used alongside chime/vibration) */
function flashAlert(){
  if (!S.flash || !el.flash) return;
  el.flash.hidden = false; el.flash.classList.add("on");
  setTimeout(()=>{ el.flash.classList.remove("on"); el.flash.hidden = true; }, 3000);
}

/* ===================================================================
   TAILORING — condition profile drives the whole experience
   =================================================================== */
function applyTailoring(conds){
  // sensible defaults, then let each condition raise the needs
  let p = {profile:"vision", verb:"brief", scale:110, spatial:true, haptic:true, flash:false, fall:false, checkin:0};
  const has = (c)=>conds.includes(c);
  if (has("vision")){ p.profile="vision"; p.verb="detailed"; p.scale=Math.max(p.scale,125); p.spatial=true; }
  if (has("hearing")){ p.flash=true; p.haptic=true; }
  if (has("motor")){ p.scale=Math.max(p.scale,120); p.fall=true; }
  if (has("cognitive")){ p.verb="brief"; p.scale=Math.max(p.scale,115); p.checkin=p.checkin||8; if(!has("vision")) p.profile="cognitive"; }
  if (has("speech")){ /* text-first, AAC; nothing forced */ }
  if (has("chronic")){ if(!has("vision")&&!has("cognitive")) p.profile="health"; }
  if (has("mood")){ p.checkin=p.checkin||8; }
  return p;
}
function tailorFromConditions(conds, announce){
  const p = applyTailoring(conds);
  S.conditions = conds;
  S.profile = p.profile; S.verb = p.verb; S.scale = p.scale;
  S.spatial = p.spatial; S.haptic = p.haptic; S.flash = p.flash; S.fall = p.fall; S.checkin = p.checkin;
  ["profile","verb","scale","checkin"].forEach(k=>save("nv."+k, S[k]));
  save("nv.spatial", S.spatial?"1":"0"); save("nv.haptic", S.haptic?"1":"0");
  save("nv.flash", S.flash?"1":"0"); save("nv.fall", S.fall?"1":"0");
  applyScale();
  syncSettings();
  if (S.fall) setFall(true);
  armCheckin();
  renderHome(); renderAAC();
  if (announce) setProfile(S.profile, true);
}
function applyScale(){
  document.documentElement.style.fontSize = (20 * S.scale/100) + "px";
}

/* ===================================================================
   SIGN-IN HOOK — auth.js calls this once a person is authenticated
   =================================================================== */
let greeted = false, greetHeard = false;
function greetNow(text){
  if (greeted) return; greeted = true;
  const g = text || buildGreeting(); addBubble("vica", g); lastSpoken = g;
  const attempt = ()=>{ try{
    speechSynthesis.cancel();
    const u = utter(g);
    u.onstart = ()=>{ greetHeard=true; speaking=true; setMic("speak"); };
    u.onend = u.onerror = ()=>{ speaking=false; setMic("idle"); wantListen=true; startWake(); };
    speechSynthesis.speak(u);
  }catch(e){ wantListen=true; startWake(); } };
  attempt();
  setTimeout(()=>{ if (!speaking && !wantListen){ wantListen=true; startWake(); } }, 2500);
  /* phones block speech until the person touches the screen once — so the
     spoken hello simply waits for that very first touch */
  setTimeout(()=>{
    if (greetHeard) return;
    document.body.addEventListener("pointerdown", function retry(ev){
      document.body.removeEventListener("pointerdown", retry);
      if (!greetHeard && !speaking && !ev.target.closest("button,a,input,select,textarea")) attempt();
    });
  }, 700);
}

/* called by auth.js */
window.vicaSignIn = function(account, isNew){
  ACCT = account; CURRENT = account.id;
  if (window.SYNC && account.cloud) SYNC.attach(account.id);
  loadS();
  if (isNew) tailorFromConditions(account.conditions || [], false);
  else { S.conditions = account.conditions || []; applyScale(); }
  /* details saved at sign-up flow into the app itself */
  seedFromAccount(account, isNew);
  el.acctBtn.hidden = false;
  applyLang(); syncSettings(); watchBattery(); armCheckin();
  if (S.fall) setFall(true);
  openView("home");
  greeted = false;
  greetNow(isNew ? buildGreeting() : T("welcomeBack",{name: account.name}));
};
window.vicaSignOut = function(){
  ACCT = null; CURRENT = "";
  stopDetect(false); stopNav(false); if (captionsOn) stopCaptions();
  speechSynthesis.cancel(); speaking=false; wantListen=false; killRec();
  el.acctBtn.hidden = true;
  greeted = false;
};
window.vicaRetailor = function(conds){ tailorFromConditions(conds, true); };

/* saved details become live app data */
function seedFromAccount(a, isNew){
  const d = a.details || {};
  /* medical card */
  const mc = JSON.parse(LS("nv.mc","{}"));
  let touched = false;
  if (!mc.name && a.name){ mc.name = a.name; touched = true; }
  if (!mc.blood && d.blood){ mc.blood = d.blood; touched = true; }
  if (!mc.allergy && d.allergy){ mc.allergy = d.allergy; touched = true; }
  if (!mc.cond && d.meds){ mc.cond = d.meds; touched = true; }
  if (touched){ save("nv.mc", JSON.stringify(mc)); MC = mc; }
  /* emergency contact becomes the first SOS contact */
  if (a.emergency && a.emergency.name && a.emergency.phone){
    if (!sos.some(x=>x.phone === a.emergency.phone)){
      sos.unshift({name:a.emergency.name, phone:a.emergency.phone});
      save("nv.sos", JSON.stringify(sos));
    }
  }
  renderSos(); renderMedCard();
}

/* "take me home" uses the saved home address */
function goHomeAddress(){
  const d = (ACCT && ACCT.details) || {};
  if (d.home) findPlaces(null, d.home);
  else { openView("account"); speak(T("noHomeAddress")); }
}

/* ---------- boot ---------- */
(function(){
  for (const [code,l] of Object.entries(I18N)){
    const o=document.createElement("option"); o.value=code; o.textContent=l.label; el.langSelect.append(o);
  }
})();
el.langSelect.addEventListener("change", ()=>setLang(el.langSelect.value));
const voiceSel = document.getElementById("voiceSelect");
if (voiceSel) voiceSel.addEventListener("change", ()=>{
  const code = (I18N[S.lang].tts || "en-US").split("-")[0];
  GSAVE("nv.voice." + code, voiceSel.value);
  speak(T("voiceSet"));
});
el.profileSelect.addEventListener("change", ()=>setProfile(el.profileSelect.value));
el.acctBtn.addEventListener("click", ()=>press("open_account"));
const floatMic = document.getElementById("floatMic"), floatChat = document.getElementById("floatChat");
if (floatMic) floatMic.addEventListener("click", ()=>micTap());
if (floatChat) floatChat.addEventListener("click", ()=>{ openView("chat"); speakAck(T("tileChat")); });
el.guideBtn.addEventListener("click", ()=>press("open_guide"));
el.allFeaturesBtn.addEventListener("click", ()=>press("open_all"));
el.guideSpeak.addEventListener("click", speakWholeGuide);
el.guidePractice.addEventListener("click", ()=>{ openView("help"); setRehearse(true); });

loadS(); applyLang(); applyScale(); syncSettings(); setMic("idle");
/* the active language's full pack loads immediately, then texts refresh */
loadLangPack(S.lang, ()=>{ applyLang(); });
/* VICA remembers she was listening: resume the wake-word ear on return.
   (Speech output still needs one tap — browsers require it — so the mic
   comes back silently and the first reply follows the first touch.) */
if (GLS("nv.listen","") === "1" && SR){
  wantListen = true;
  setTimeout(()=>{ if (mode === "off") startWake(); }, 800);
}

window.addEventListener("load", ()=>{ setTimeout(()=>{ if (window.AUTH) AUTH.start(); }, 300); });
document.body.addEventListener("pointerdown", function once(){ ac(); document.body.removeEventListener("pointerdown", once); });
window.addEventListener("online",  ()=>{ if (window.AUTH){ AUTH.renderCloudBadges(); AUTH.renderCloudStatus(); } });
window.addEventListener("offline", ()=>{ if (window.AUTH){ AUTH.renderCloudBadges(); AUTH.renderCloudStatus(); } });
/* updates install themselves: when a new version is ready the page reloads
   once, so nobody has to know what a cache is */
if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").then(reg => {
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "activated" && navigator.serviceWorker.controller &&
            !sessionStorage.getItem("nv.reloaded")){
          sessionStorage.setItem("nv.reloaded", "1");
          location.reload();
        }
      });
    });
  }).catch(()=>{});
}

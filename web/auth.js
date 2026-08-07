/* ===================================================================
   NAVI-VICA auth.js — accounts, sign-up, sign-in (email OR phone),
   password recovery via security questions.

   Passwords are NEVER stored. We store PBKDF2-SHA256 hashes with a
   random per-account salt (150,000 iterations). Security answers are
   hashed the same way. Everything stays on this device.
   =================================================================== */
"use strict";

const AUTH = (function(){

/* ---------- store ---------- */
const KEY = "nv.accounts.v2";
let list = [];
try{ list = JSON.parse(localStorage.getItem(KEY) || "[]"); }catch(e){ list = []; }
const persist = () => { try{ localStorage.setItem(KEY, JSON.stringify(list)); }catch(e){} };

/* ---------- crypto ---------- */
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
function randSalt(){
  const a = new Uint8Array(16);
  (crypto.getRandomValues ? crypto : window.msCrypto).getRandomValues(a);
  return b64(a);
}
async function hash(text, salt){
  if (!crypto.subtle){ /* very old browser fallback: still not plaintext */
    let h = 0; const s = salt + "|" + text;
    for (let i=0;i<s.length;i++){ h = ((h<<5)-h) + s.charCodeAt(i); h |= 0; }
    return "w" + String(h);
  }
  const key = await crypto.subtle.importKey("raw", enc.encode(text), {name:"PBKDF2"}, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {name:"PBKDF2", salt: enc.encode(salt), iterations:150000, hash:"SHA-256"}, key, 256);
  return b64(bits);
}
const normAnswer = (a) => String(a||"").trim().toLowerCase().replace(/\s+/g," ");

/* ---------- validation ---------- */
const normEmail = (e) => String(e||"").trim().toLowerCase();
const normPhone = (p) => { const d = String(p||"").replace(/[^\d+]/g,""); return d.replace(/(?!^)\+/g,""); };
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail(e));
const validPhone = (p) => normPhone(p).replace(/\D/g,"").length >= 7;
function pwScore(pw){
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0-4
}
/* Phone formats vary (+7… vs 8…). Compare the last 9 digits so a person
   isn't locked out for typing their own number a different way. */
const phoneTail = (p) => { const d = normPhone(p).replace(/\D/g,""); return d.length >= 9 ? d.slice(-9) : d; };
function findBy(identifier){
  const v = String(identifier||"").trim();
  if (!v) return null;
  const e = normEmail(v), tail = phoneTail(v);
  return list.find(a =>
    (a.email && a.email === e) ||
    (a.phone && tail && tail.length >= 7 && phoneTail(a.phone) === tail)
  ) || null;
}

/* ---------- helpers into the app ---------- */
const $ = (id) => document.getElementById(id);
const say = (t) => { try{ if (typeof speak === "function") speak(t); }catch(e){} };
const t   = (k,v) => (typeof T === "function") ? T(k,v) : k;
const tobj= (k)   => (typeof TO === "function") ? TO(k) : {};
function show(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  const v = $(id); if (v) v.classList.add("active");
  document.body.classList.toggle("on-auth", !!(v && v.classList.contains("auth")));
}
function err(elId, msg){
  const e = $(elId); if(!e) return;
  if (!msg){ e.hidden = true; e.textContent=""; return; }
  e.hidden = false; e.textContent = msg; say(msg);
}


/* ---------- cloud helpers ---------- */
function setBusy(on){
  const b = document.getElementById("authBusy");
  if (b) b.hidden = !on;
}
/* Bring a cloud user (and their saved profile) onto this device so the
   app can keep working offline afterwards. */
function adoptCloudAccount(user, prof, identifier, pw){
  let a = list.find(x=>x.id === user.id);
  if (!a){
    a = { id:user.id, cloud:true, salt:randSalt(), pwHash:"",
          q1:"q_pet", a1Hash:"", q2:"q_city", a2Hash:"",
          conditions:[], details:{}, emergency:{}, av:"🙂", created:Date.now() };
    list.push(a);
  }
  a.cloud = true;
  a.email = user.email || (CLOUD.isEmail(identifier) ? String(identifier).trim().toLowerCase() : (a.email||""));
  a.phone = user.phone || (!CLOUD.isEmail(identifier) ? normPhone(identifier) : (a.phone||""));
  if (prof){
    a.name = prof.name || a.name || (user.user_metadata && user.user_metadata.name) || "Friend";
    a.conditions = prof.conditions || a.conditions || [];
    a.details = prof.details || a.details || {};
    a.emergency = prof.emergency || a.emergency || {};
  } else {
    a.name = a.name || (user.user_metadata && user.user_metadata.name) || "Friend";
  }
  a.av = (a.conditions||[]).includes("carer") ? "👨‍👩‍👧" : "🙂";
  persist();
  /* cache the password hash so this device can sign in offline next time */
  if (pw) hash(pw, a.salt).then(h=>{ a.pwHash = h; persist(); });
  return a;
}
/* If the person arrived from a reset-password email, let them set a new one. */
async function handleRecoveryLink(){
  if (!(window.CLOUD && CLOUD.available() && CLOUD.isRecoveryLink())) return false;
  show("forgot");
  fgStep = 3; fgAcct = null; fgCloudRecovery = true;
  fgRender();
  $("fgHint3").textContent = t("fgHint3Cloud");
  return true;
}

/* ---------- security questions ---------- */
const QKEYS = ["q_pet","q_city","q_mother","q_school","q_food","q_nickname"];
function fillQuestionSelects(){
  const Q = tobj("securityQuestions") || {};
  [$("suQ1"), $("suQ2")].forEach((sel,i)=>{
    if (!sel) return;
    sel.innerHTML = "";
    QKEYS.forEach(k=>{
      const o = document.createElement("option"); o.value=k; o.textContent=Q[k]||k; sel.append(o);
    });
    sel.selectedIndex = i === 0 ? 0 : 1;
  });
}

/* ===================================================================
   SIGN-UP  (7 steps)
   =================================================================== */
const SU_STEPS = 7;
let suStep = 1;
let draft = {};

function suRender(){
  document.querySelectorAll('#signup .wstep').forEach(w=>{ w.hidden = (parseInt(w.dataset.step,10) !== suStep); });
  const dots = $("suDots");
  if (dots){
    dots.innerHTML = "";
    for (let i=1;i<=SU_STEPS;i++){
      const d = document.createElement("span");
      d.className = "dot-step" + (i===suStep?" on":"") + (i<suStep?" done":"");
      dots.append(d);
    }
  }
  const titles = tobj("suTitles") || {};
  const hints  = tobj("suHints")  || {};
  $("suTitle").textContent = titles[suStep] || "";
  $("suHint").textContent  = hints[suStep]  || "";
  $("suNextLabel").textContent = suStep === SU_STEPS ? t("suFinish") : t("suNextLabel");
  $("suSkip").hidden = !(suStep === 6 || suStep === 7);
  $("suSkip").textContent = t("suSkip");
  err("suErr","");
  if (suStep === 4) fillQuestionSelects();
  if (suStep === 5) renderCondPicker($("suCondGrid"), draft.conditions || [], (c)=>{ draft.conditions = c; });
  const focusMap = {1:"suName",2:"suEmail",3:"suPw",4:"suA1",6:"suDob",7:"suEcName"};
  const f = $(focusMap[suStep]); if (f) setTimeout(()=>{ try{ f.focus(); }catch(e){} }, 120);
  const spoken = (titles[suStep]||"") + ". " + (hints[suStep]||"");
  say(spoken);
}
function renderCondPicker(grid, selected, onChange){
  if (!grid) return;
  const C = tobj("conditions") || {};
  grid.innerHTML = "";
  const cur = selected.slice();
  Object.keys(C).forEach(id=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cond" + (cur.includes(id) ? " on" : "");
    const parts = String(C[id]).split(" ");
    b.innerHTML = `<span class="ico">${parts[0]}</span><span>${parts.slice(1).join(" ")}</span>`;
    b.addEventListener("click", ()=>{
      const i = cur.indexOf(id);
      if (i>=0) cur.splice(i,1); else cur.push(id);
      b.classList.toggle("on");
      onChange(cur.slice());
    });
    grid.append(b);
  });
}
async function suValidateAndAdvance(){
  if (suStep === 1){
    const n = $("suName").value.trim();
    if (n.length < 2) return err("suErr", t("errName"));
    draft.name = n;
  }
  if (suStep === 2){
    const e = $("suEmail").value.trim(), p = $("suPhone").value.trim();
    if (!e && !p) return err("suErr", t("errContact"));
    if (e && !validEmail(e)) return err("suErr", t("errEmail"));
    if (p && !validPhone(p)) return err("suErr", t("errPhone"));
    if (e && list.some(a=>a.email === normEmail(e))) return err("suErr", t("errEmailTaken"));
    if (p && list.some(a=>a.phone && phoneTail(a.phone) === phoneTail(p))) return err("suErr", t("errPhoneTaken"));
    draft.email = e ? normEmail(e) : "";
    draft.phone = p ? normPhone(p) : "";
  }
  if (suStep === 3){
    const pw = $("suPw").value, pw2 = $("suPw2").value;
    if (pw.length < 6) return err("suErr", t("errPwShort"));
    if (pw !== pw2)   return err("suErr", t("errPwMatch"));
    draft.pw = pw;
  }
  if (suStep === 4){
    const q1=$("suQ1").value, a1=$("suA1").value.trim(), q2=$("suQ2").value, a2=$("suA2").value.trim();
    if (!a1 || !a2)  return err("suErr", t("errAnswers"));
    if (q1 === q2)   return err("suErr", t("errSameQ"));
    draft.q1=q1; draft.a1=a1; draft.q2=q2; draft.a2=a2;
  }
  if (suStep === 5){
    draft.conditions = draft.conditions || [];
  }
  if (suStep === 6){
    draft.details = {
      dob: $("suDob").value || "", home: $("suHome").value.trim(),
      blood: $("suBlood").value.trim(), allergy: $("suAllergy").value.trim(),
      meds: $("suMeds").value.trim()
    };
  }
  if (suStep === 7){
    draft.emergency = { name:$("suEcName").value.trim(), phone:normPhone($("suEcPhone").value), rel:$("suEcRel").value.trim() };
    return finishSignup();
  }
  suStep++; suRender();
}
async function finishSignup(){
  const btn = $("suNext"); btn.disabled = true;
  try{
    /* --- try the cloud first, so the account works on any device --- */
    let cloudId = "", needsConfirm = false;
    if (window.CLOUD && CLOUD.available() && CLOUD.online()){
      const identifier = draft.email || draft.phone;
      const r = await CLOUD.signUp(identifier, draft.pw, {name:draft.name});
      if (r.ok){
        cloudId = r.user ? r.user.id : "";
        needsConfirm = !!r.needsConfirm;
      } else if (r.code === "auth" && /already|registered|exists/i.test(r.message||"")){
        err("suErr", t("errEmailTaken")); btn.disabled = false; return;
      }
      /* any other cloud failure: fall through and create a device account */
    }
    const salt = randSalt();
    const a = {
      id: cloudId || ("u" + Date.now().toString(36) + Math.random().toString(36).slice(2,6)),
      cloud: !!cloudId,
      name: draft.name, email: draft.email || "", phone: draft.phone || "",
      salt, pwHash: await hash(draft.pw, salt),
      q1: draft.q1, a1Hash: await hash(normAnswer(draft.a1), salt),
      q2: draft.q2, a2Hash: await hash(normAnswer(draft.a2), salt),
      conditions: draft.conditions || [],
      details: draft.details || {},
      emergency: draft.emergency || {},
      av: (draft.conditions||[]).includes("carer") ? "👨‍👩‍👧" : "🙂",
      created: Date.now()
    };
    list.push(a); persist();
    localStorage.setItem("nv.current", a.id);
    draft = {};
    if (cloudId && window.SYNC){ SYNC.attach(a.id); SYNC.schedule(1500); }
    if (needsConfirm){
      say(t("confirmEmailSent"));
      err("suErr", t("confirmEmailSent"));
    }
    window.vicaSignIn(a, true);
  }catch(e){
    console.warn(e); err("suErr", t("errGeneric"));
  }finally{ btn.disabled = false; }
}

/* ===================================================================
   SIGN-IN
   =================================================================== */
function renderQuickAccounts(){
  const box = $("siQuick"); if (!box) return;
  box.innerHTML = "";
  list.slice(0,4).forEach(a=>{
    const b = document.createElement("button");
    b.type="button"; b.className="acct-item";
    const who = a.email || a.phone || "";
    b.innerHTML = `<span class="av">${a.av||"🙂"}</span><span class="who">${a.name}<small>${who}</small></span><span>›</span>`;
    b.addEventListener("click", ()=>{ $("siId").value = who; $("siPw").focus(); });
    box.append(b);
  });
}
async function doSignIn(){
  err("siErr","");
  const id = $("siId").value.trim(), pw = $("siPw").value;
  if (!id) return err("siErr", t("errNeedId"));
  if (!pw) return err("siErr", t("errNeedPw"));
  const btn = $("siGo"); btn.disabled = true;
  setBusy(true);
  try{
    let a = findBy(id);

    /* --- cloud sign-in: works even on a brand-new device --- */
    if (window.CLOUD && CLOUD.available() && CLOUD.online()){
      const r = await CLOUD.signIn(id, pw);
      if (r.ok && r.user){
        const prof = await CLOUD.pullProfile(r.user.id);
        a = adoptCloudAccount(r.user, prof, id, pw);
        if ($("siRemember").checked) localStorage.setItem("nv.current", a.id);
        else localStorage.removeItem("nv.current");
        if (window.SYNC){ SYNC.attach(a.id); if (prof) await SYNC.pull(prof); }
        window.vicaSignIn(a, false);
        return;
      }
      if (r.ok === false && r.code === "auth" && a === null){
        return err("siErr", t("errBadPw"));
      }
      /* offline or unreachable → fall back to the device account below */
    }

    if (!a) return err("siErr", t("errNoAccount"));
    if (!a.pwHash) return err("siErr", t("errCloudNeeded"));
    const h = await hash(pw, a.salt);
    if (h !== a.pwHash) return err("siErr", t("errBadPw"));
    if ($("siRemember").checked) localStorage.setItem("nv.current", a.id);
    else localStorage.removeItem("nv.current");
    if (window.SYNC && a.cloud) SYNC.attach(a.id);
    window.vicaSignIn(a, false);
  } finally { btn.disabled = false; setBusy(false); }
}

/* ===================================================================
   FORGOT PASSWORD
   =================================================================== */
let fgStep = 1, fgAcct = null, fgCloudRecovery = false;
function fgRender(){
  document.querySelectorAll('#forgot .wstep').forEach(w=>{ w.hidden = (parseInt(w.dataset.fstep,10) !== fgStep); });
  $("fgNextLabel").textContent = fgStep === 3 ? t("fgSave") : t("suNextLabel");
  err("fgErr","");
  const titles = tobj("fgTitles") || {};
  $("fgTitle").textContent = titles[fgStep] || t("fgTitle");
  say($("fgTitle").textContent);
}
async function fgAdvance(){
  if (fgStep === 1){
    const idv = $("fgId").value.trim();
    /* Cloud accounts get a real reset email. */
    if (window.CLOUD && CLOUD.available() && CLOUD.online() && CLOUD.isEmail(idv)){
      const btn = $("fgNext"); btn.disabled = true; setBusy(true);
      try{
        const r = await CLOUD.sendReset(idv);
        if (r.ok){
          err("fgErr","");
          $("fgSent").hidden = false;
          $("fgSent").textContent = t("resetEmailSent",{email:idv});
          say(t("resetEmailSent",{email:idv}));
          return;
        }
      } finally { btn.disabled = false; setBusy(false); }
      /* if the email could not be sent we quietly continue with questions */
    }
    const a = findBy(idv);
    if (!a) return err("fgErr", t("errNoAccount"));
    if (!a.a1Hash) return err("fgErr", t("errNoQuestions"));
    fgAcct = a;
    const Q = tobj("securityQuestions") || {};
    $("fgQ1Label").textContent = Q[a.q1] || a.q1;
    $("fgQ2Label").textContent = Q[a.q2] || a.q2;
    $("fgA1").value = ""; $("fgA2").value = "";
    fgStep = 2; return fgRender();
  }
  if (fgStep === 2){
    const btn = $("fgNext"); btn.disabled = true;
    try{
      const h1 = await hash(normAnswer($("fgA1").value), fgAcct.salt);
      const h2 = await hash(normAnswer($("fgA2").value), fgAcct.salt);
      if (h1 !== fgAcct.a1Hash || h2 !== fgAcct.a2Hash) return err("fgErr", t("errAnswersWrong"));
      fgStep = 3; return fgRender();
    } finally { btn.disabled = false; }
  }
  if (fgStep === 3){
    const pw = $("fgPw").value, pw2 = $("fgPw2").value;
    if (pw.length < 6) return err("fgErr", t("errPwShort"));
    if (pw !== pw2)   return err("fgErr", t("errPwMatch"));
    const btn = $("fgNext"); btn.disabled = true;
    try{
      if (fgCloudRecovery){
        const r = await CLOUD.completeReset(pw);
        if (!r.ok) return err("fgErr", t("errGeneric"));
        fgCloudRecovery = false;
        say(t("pwReset")); openSignin(); return;
      }
      fgAcct.salt = randSalt();
      fgAcct.pwHash = await hash(pw, fgAcct.salt);
      fgAcct.a1Hash = await hash(normAnswer($("fgA1").value), fgAcct.salt);
      fgAcct.a2Hash = await hash(normAnswer($("fgA2").value), fgAcct.salt);
      persist();
      say(t("pwReset"));
      openSignin();
    } finally { btn.disabled = false; }
  }
}

/* ===================================================================
   ACCOUNT PANEL
   =================================================================== */
function renderAccount(){
  const a = list.find(x=>x.id === localStorage.getItem("nv.current")) || (typeof acct === "function" ? acct() : null);
  if (!a) return;
  const d = a.details || {}, e = a.emergency || {};
  $("acAvatar").textContent = a.av || "🙂";
  $("acName").textContent = a.name;
  $("acContact").textContent = [a.email, a.phone].filter(Boolean).join(" · ");
  $("acFName").value = a.name || ""; $("acEmail").value = a.email || ""; $("acPhone").value = a.phone || "";
  $("acDob").value = d.dob || ""; $("acHome").value = d.home || "";
  $("acEcName").value = e.name || ""; $("acEcPhone").value = e.phone || "";
  renderCondPicker($("acCondGrid"), a.conditions || [], (c)=>{ a._pendingConds = c; });
  renderCloudStatus();
}
function renderCloudStatus(){
  const box = $("acCloudStatus"); if (!box) return;
  const a = current();
  let msg;
  if (!window.CLOUD || !CLOUD.configured()) msg = t("cloudNotSetUp");
  else if (!CLOUD.online())                 msg = t("cloudOffline");
  else if (a && a.cloud)                    msg = t("cloudOn");
  else                                      msg = t("cloudDeviceOnly");
  box.textContent = msg;
  box.className = "cloud-badge " + ((a&&a.cloud&&CLOUD.online()) ? "ok" : "warn");
  const sb = $("acSyncNow"); if (sb) sb.hidden = !(a && a.cloud);
}
function saveAccountDetails(){
  const a = current(); if (!a) return;
  const email = $("acEmail").value.trim(), phone = $("acPhone").value.trim();
  if (email && !validEmail(email)) return err("acErr", t("errEmail"));
  if (phone && !validPhone(phone)) return err("acErr", t("errPhone"));
  if (!email && !phone) return err("acErr", t("errContact"));
  const clashE = email && list.some(x=>x.id!==a.id && x.email===normEmail(email));
  const clashP = phone && list.some(x=>x.id!==a.id && x.phone && phoneTail(x.phone)===phoneTail(phone));
  if (clashE) return err("acErr", t("errEmailTaken"));
  if (clashP) return err("acErr", t("errPhoneTaken"));
  a.name = $("acFName").value.trim() || a.name;
  a.email = email ? normEmail(email) : "";
  a.phone = phone ? normPhone(phone) : "";
  a.details = Object.assign(a.details||{}, {dob:$("acDob").value||"", home:$("acHome").value.trim()});
  persist(); err("acErr","");
  if (window.SYNC) SYNC.noteLocalChange();
  renderAccount(); say(t("acSaved"));
}
const current = () => list.find(x=>x.id === localStorage.getItem("nv.current")) || null;

/* ===================================================================
   WIRING
   =================================================================== */
function wire(){
  /* password eyes */
  document.querySelectorAll("[data-eye]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const f = $(b.dataset.eye); if(!f) return;
      f.type = f.type === "password" ? "text" : "password";
      b.textContent = f.type === "password" ? "👁" : "🙈";
    });
  });
  /* landing */
  $("goSignup").addEventListener("click", openSignup);
  $("goSignin").addEventListener("click", openSignin);
  /* signup */
  $("suNext").addEventListener("click", suValidateAndAdvance);
  $("suBack").addEventListener("click", ()=>{ if (suStep>1){ suStep--; suRender(); } else show("landing"); });
  $("suSkip").addEventListener("click", ()=>{
    if (suStep === 6){ draft.details = {dob:"",home:"",blood:"",allergy:"",meds:""}; suStep=7; suRender(); }
    else { draft.emergency = {}; finishSignup(); }
  });
  $("suToSignin").addEventListener("click", openSignin);
  $("suPw").addEventListener("input", ()=>{
    const s = pwScore($("suPw").value), bar = $("pwBar");
    bar.style.width = (s*25) + "%";
    bar.style.background = s<=1 ? "var(--red)" : s===2 ? "#E9960C" : "var(--green)";
  });
  ["suName","suEmail","suPhone","suPw2","suA2"].forEach(id=>{
    const f = $(id); if (f) f.addEventListener("keydown", e=>{ if(e.key==="Enter") suValidateAndAdvance(); });
  });
  /* signin */
  $("siGo").addEventListener("click", doSignIn);
  $("siPw").addEventListener("keydown", e=>{ if(e.key==="Enter") doSignIn(); });
  $("siId").addEventListener("keydown", e=>{ if(e.key==="Enter") $("siPw").focus(); });
  $("siBack").addEventListener("click", ()=>show("landing"));
  $("siForgot").addEventListener("click", openForgot);
  $("siToSignup").addEventListener("click", openSignup);
  /* forgot */
  $("fgNext").addEventListener("click", fgAdvance);
  $("fgBack").addEventListener("click", ()=>{ if (fgStep>1){ fgStep--; fgRender(); } else openSignin(); });
  $("fgToSignin").addEventListener("click", openSignin);
  $("fgId").addEventListener("keydown", e=>{ if(e.key==="Enter") fgAdvance(); });
  /* account panel */
  $("acSave").addEventListener("click", saveAccountDetails);
  $("acCondSave").addEventListener("click", ()=>{
    const a = current(); if(!a) return;
    a.conditions = a._pendingConds || a.conditions || [];
    a.av = a.conditions.includes("carer") ? "👨‍👩‍👧" : "🙂";
    delete a._pendingConds; persist();
    if (window.SYNC) SYNC.noteLocalChange();
    if (window.vicaRetailor) window.vicaRetailor(a.conditions);
    say(t("acCondSaved"));
  });
  $("acEcSave").addEventListener("click", ()=>{
    const a = current(); if(!a) return;
    a.emergency = {name:$("acEcName").value.trim(), phone:normPhone($("acEcPhone").value), rel:(a.emergency&&a.emergency.rel)||""};
    persist(); if (window.SYNC) SYNC.noteLocalChange(); say(t("acSaved"));
  });
  $("acPwSave").addEventListener("click", async ()=>{
    const a = current(); if(!a) return;
    const oldPw = $("acOldPw").value, newPw = $("acNewPw").value;
    if (newPw.length < 6) return err("acErr", t("errPwShort"));
    const h = await hash(oldPw, a.salt);
    if (h !== a.pwHash) return err("acErr", t("errBadPw"));
    if (a.cloud && window.CLOUD && CLOUD.available() && CLOUD.online()){
      const r = await CLOUD.changePassword(newPw);
      if (!r.ok) return err("acErr", t("errGeneric"));
    }
    a.salt = randSalt(); a.pwHash = await hash(newPw, a.salt);
    persist(); err("acErr",""); $("acOldPw").value=""; $("acNewPw").value="";
    say(t("acPwChanged"));
  });
  $("acSignout").addEventListener("click", async ()=>{
    if (window.CLOUD && CLOUD.available()) await CLOUD.signOut();
    localStorage.removeItem("nv.current");
    if (window.vicaSignOut) window.vicaSignOut();
    openSignin();
  });
  $("acDelete").addEventListener("click", ()=>{
    const a = current(); if(!a) return;
    if (!confirm(t("acDeleteConfirm"))) return;
    Object.keys(localStorage).filter(k=>k.startsWith("nv."+a.id+".")).forEach(k=>localStorage.removeItem(k));
    list = list.filter(x=>x.id!==a.id); persist();
    localStorage.removeItem("nv.current");
    if (window.vicaSignOut) window.vicaSignOut();
    start();
  });
  const syncBtn = $("acSyncNow");
  if (syncBtn) syncBtn.addEventListener("click", async ()=>{
    if (!(window.CLOUD && CLOUD.available())) { say(t("cloudOff")); return; }
    if (!CLOUD.online()) { say(t("cloudOffline")); return; }
    say(t("syncing"));
    const r = await SYNC.push();
    say(r && r.ok ? t("syncDone") : t("cloudOffline"));
    renderCloudStatus();
  });
  $("acExport").addEventListener("click", async ()=>{
    const a = current(); if(!a) return;
    const bundle = {a, data:{}};
    Object.keys(localStorage).filter(k=>k.startsWith("nv."+a.id+".")).forEach(k=>{ bundle.data[k.replace("nv."+a.id+".","")] = localStorage.getItem(k); });
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(bundle))));
    try{ await navigator.clipboard.writeText(code); }catch(e){ prompt(t("acExportLabel"), code); }
    say(t("acExported"));
  });
  $("acImport").addEventListener("click", ()=>{
    const code = prompt(t("acImportLabel"));
    if (!code) return;
    try{
      const b = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      if (!b.a || !b.a.id) throw new Error("bad");
      if (!list.some(x=>x.id===b.a.id)) list.push(b.a);
      persist();
      Object.entries(b.data||{}).forEach(([k,v])=> localStorage.setItem("nv."+b.a.id+"."+k, v));
      say(t("acImported"));
      openSignin();
    }catch(e){ say(t("errGeneric")); }
  });
}

/* ---------- view openers ---------- */
function openSignup(){ suStep = 1; draft = {}; ["suName","suEmail","suPhone","suPw","suPw2","suA1","suA2","suDob","suHome","suBlood","suAllergy","suMeds","suEcName","suEcPhone","suEcRel"].forEach(id=>{ const f=$(id); if(f) f.value=""; }); $("pwBar").style.width="0%"; show("signup"); suRender(); }
function openSignin(){ err("siErr",""); $("siPw").value=""; renderQuickAccounts(); show("signin"); say(t("siTitle")); }
function openForgot(){ fgStep=1; fgAcct=null; $("fgId").value = $("siId").value || ""; show("forgot"); fgRender(); }

/* ---------- entry point ---------- */
async function start(){
  wire();
  applyAuthLang();
  if (window.CLOUD) CLOUD.init();
  renderCloudBadges();

  /* arriving from a "reset your password" email */
  if (await handleRecoveryLink()) return;

  /* an existing cloud session signs straight in, on any device */
  if (window.CLOUD && CLOUD.available() && CLOUD.online()){
    try{
      const u = await CLOUD.currentUser();
      if (u){
        const prof = await CLOUD.pullProfile(u.id);
        const a = adoptCloudAccount(u, prof, u.email || u.phone || "", "");
        localStorage.setItem("nv.current", a.id);
        if (window.SYNC){ SYNC.attach(a.id); if (prof) await SYNC.pull(prof); }
        window.vicaSignIn(a, false);
        return;
      }
    }catch(e){}
  }
  const remembered = localStorage.getItem("nv.current");
  const a = remembered ? list.find(x=>x.id===remembered) : null;
  if (a){
    if (window.SYNC && a.cloud) SYNC.attach(a.id);
    window.vicaSignIn(a, false);
  }
  else if (list.length) openSignin();
  else { show("landing"); say(t("hTagline")); }
}
function renderCloudBadges(){
  const on = !!(window.CLOUD && CLOUD.configured());
  document.querySelectorAll(".cloud-note").forEach(n=>{
    n.textContent = on ? t("cloudBadgeOn") : t("cloudBadgeOff");
    n.className = "cloud-note " + (on ? "ok" : "");
  });
}

/* ---------- language for auth screens ---------- */
function applyAuthLang(){
  const set = (id,k)=>{ const e=$(id); if(e) e.textContent = t(k); };
  set("hTagline","hTagline"); set("goSignupLabel","goSignupLabel"); set("goSigninLabel","goSigninLabel");
  set("privacyNote","privacyNote");
  const hl = $("heroList");
  if (hl){ hl.innerHTML=""; (tobj("heroPoints")||[]).forEach(p=>{ const li=document.createElement("li"); li.textContent=p; hl.append(li); }); }
  set("lbName","lbName"); set("lbEmail","lbEmail"); set("lbPhone","lbPhone"); set("suContactNote","suContactNote");
  set("lbPw","lbPw"); set("lbPw2","lbPw2"); set("lbQ1","lbQ1"); set("lbQ2","lbQ2");
  set("lbDob","lbDob"); set("lbHome","lbHome"); set("lbBlood","lbBlood"); set("lbAllergy","lbAllergy"); set("lbMeds","lbMeds");
  set("lbEcName","lbEcName"); set("lbEcPhone","lbEcPhone"); set("lbEcRel","lbEcRel");
  set("suToSignin","suToSignin");
  set("siTitle","siTitle"); set("siHint","siHint"); set("lbSiId","lbSiId"); set("lbSiPw","lbSiPw");
  set("lbRemember","lbRemember"); set("siGoLabel","siGoLabel"); set("siForgot","siForgot"); set("siToSignup","siToSignup");
  set("fgTitle","fgTitle"); set("fgHint1","fgHint1"); set("fgHint2","fgHint2"); set("fgHint3","fgHint3");
  set("lbFgId","lbFgId"); set("lbFgPw","lbFgPw"); set("lbFgPw2","lbFgPw2"); set("fgToSignin","fgToSignin");
  set("acTitle","acTitle"); set("acDetailsTitle","acDetailsTitle"); set("acSaveLabel","acSaveLabel");
  set("acCondTitle","acCondTitle"); set("acCondHint","acCondHint"); set("acCondSaveLabel","acCondSaveLabel");
  set("acEcTitle","acEcTitle"); set("acEcSaveLabel","acEcSaveLabel");
  set("acPwTitle","acPwTitle"); set("acPwSaveLabel","acPwSaveLabel");
  set("lbAcName","lbName"); set("lbAcEmail","lbEmail"); set("lbAcPhone","lbPhone"); set("lbAcDob","lbDob"); set("lbAcHome","lbHome");
  set("lbAcEcName","lbEcName"); set("lbAcEcPhone","lbEcPhone");
  set("lbAcOldPw","lbAcOldPw"); set("lbAcNewPw","lbAcNewPw");
  set("acTransferTitle","acTransferTitle"); set("acTransferNote","acTransferNote");
  set("acExportLabel","acExportLabel"); set("acImportLabel","acImportLabel");
  set("acSignoutLabel","acSignoutLabel"); set("acDeleteLabel","acDeleteLabel");
  /* dynamic notes must follow the language too, not stay in English */
  renderCloudBadges(); renderCloudStatus();
}

return { start, renderAccount, applyAuthLang, renderCloudStatus, renderCloudBadges, list: ()=>list, current };
})();
window.AUTH = AUTH;

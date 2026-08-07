/* ===================================================================
   NAVI-VICA sync.js — keeps a person's data mirrored to the cloud.

   Everything works offline. Changes are queued and pushed when signal
   returns. On sign-in we merge: whichever side was edited most recently
   wins, so a person can use their phone and a tablet without losing work.
   =================================================================== */
"use strict";

const SYNC = (function(){

/* keys under nv.<userId>. that belong to the person, not the device */
const KEYS = ["nv.alarms","nv.appts","nv.sos","nv.notes","nv.mc","nv.sym","nv.items","nv.log",
              "nv.lang","nv.profile","nv.conf","nv.model","nv.verb","nv.rate","nv.haptic",
              "nv.spatial","nv.checkin","nv.fall","nv.scale","nv.flash"];

let uid = "", timer = null, busy = false, lastPush = 0;
const stamp = () => "nv."+uid+".__stamp";

function collect(){
  const out = {};
  KEYS.forEach(k=>{ const v = localStorage.getItem("nv."+uid+"."+k); if (v !== null) out[k] = v; });
  return out;
}
function apply(bundle){
  if (!bundle) return;
  Object.entries(bundle).forEach(([k,v])=>{
    if (KEYS.includes(k) && typeof v === "string") localStorage.setItem("nv."+uid+"."+k, v);
  });
}
function localStamp(){ return parseInt(localStorage.getItem(stamp()) || "0", 10); }
function touch(){ localStorage.setItem(stamp(), String(Date.now())); }

/* ---------- public ---------- */
function attach(userId){ uid = userId; }

/* pull cloud → device, newest wins */
async function pull(profile){
  if (!uid || !profile) return {applied:false};
  const cloudTime = profile.updated_at ? new Date(profile.updated_at).getTime() : 0;
  const localTime = localStamp();
  const hasLocal = !!localStorage.getItem("nv."+uid+".nv.alarms") || localTime > 0;
  if (profile.data && (cloudTime > localTime || !hasLocal)){
    apply(profile.data);
    localStorage.setItem(stamp(), String(cloudTime || Date.now()));
    return {applied:true, direction:"down"};
  }
  return {applied:false};
}

/* device → cloud, debounced so we never hammer the network */
function schedule(delay){
  if (!uid || !window.CLOUD || !CLOUD.available()) return;
  clearTimeout(timer);
  timer = setTimeout(push, delay === undefined ? 4000 : delay);
}
async function push(){
  if (!uid || busy || !window.CLOUD || !CLOUD.available()) return {ok:false};
  if (!CLOUD.online()){ localStorage.setItem("nv."+uid+".__pending","1"); return {ok:false, code:"offline"}; }
  busy = true;
  try{
    const a = (typeof AUTH !== "undefined" && AUTH.current) ? AUTH.current() : null;
    const row = {
      data: collect(),
      name: a ? a.name : undefined,
      phone: a ? (a.phone || null) : undefined,
      conditions: a ? (a.conditions || []) : undefined,
      details: a ? (a.details || {}) : undefined,
      emergency: a ? (a.emergency || {}) : undefined
    };
    Object.keys(row).forEach(k=>{ if (row[k] === undefined) delete row[k]; });
    const r = await CLOUD.pushProfile(uid, row);
    if (r.ok){ touch(); localStorage.removeItem("nv."+uid+".__pending"); lastPush = Date.now(); }
    return r;
  } finally { busy = false; }
}
const pending = () => !!(uid && localStorage.getItem("nv."+uid+".__pending"));
const lastPushedAt = () => lastPush;

/* flush anything queued as soon as we are back online */
window.addEventListener("online", ()=>{ if (pending()) schedule(1200); });

/* mark local edits so the newest side wins on the next merge */
function noteLocalChange(){ if (uid){ touch(); schedule(); } }

return { attach, pull, push, schedule, pending, noteLocalChange, lastPushedAt, KEYS };
})();
window.SYNC = SYNC;

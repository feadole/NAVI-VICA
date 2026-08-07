/* ===================================================================
   NAVI-VICA cloud.js — Supabase-backed accounts & sync.

   Design rule: the cloud is an ENHANCEMENT, never a dependency.
   If it is unconfigured, unreachable, or the person is offline, every
   feature still works from device storage and syncs when signal returns.
   =================================================================== */
"use strict";

const CLOUD = (function(){

const CFG = window.VICA_CONFIG || {};
let sb = null, ready = false, lastError = "";

function configured(){
  return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
            /^https:\/\//.test(CFG.SUPABASE_URL));
}
function init(){
  if (ready || !configured()) return ready;
  try{
    if (!window.supabase || !window.supabase.createClient) return false;
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth:{ persistSession:true, autoRefreshToken:true, storageKey:"nv.sb.session" }
    });
    ready = true;
  }catch(e){ lastError = String(e); ready = false; }
  return ready;
}
const available = () => configured() && (ready || init());
const online = () => (typeof navigator.onLine === "boolean") ? navigator.onLine : true;

/* ---------- identifier helpers ---------- */
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||"").trim());
function e164(p){
  let d = String(p||"").replace(/[^\d+]/g,"");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (!d.startsWith("+")) {
    const digits = d.replace(/\D/g,"");
    if (digits.length === 11 && digits.startsWith("8")) d = "+7" + digits.slice(1);      // RU local form
    else if (digits.length === 11 && digits.startsWith("1")) d = "+" + digits;           // NA
    else if (digits.length === 11 && digits.startsWith("0")) d = "+234" + digits.slice(1); // NG local form
    else d = "+" + digits;
  }
  return d;
}
const credFor = (identifier) => isEmail(identifier)
  ? { email: String(identifier).trim().toLowerCase() }
  : { phone: e164(identifier) };

/* ---------- auth ---------- */
async function signUp(identifier, password, meta){
  if (!available()) return {ok:false, code:"nocloud"};
  if (!online())    return {ok:false, code:"offline"};
  try{
    const cred = credFor(identifier);
    const opts = { data: meta || {} };
    if (cred.email && CFG.SITE_URL) opts.emailRedirectTo = CFG.SITE_URL;
    const {data, error} = await sb.auth.signUp(Object.assign({}, cred, {password, options:opts}));
    if (error) return {ok:false, code:"auth", message:error.message};
    return {ok:true, user:data.user, session:data.session, needsConfirm: !data.session};
  }catch(e){ return {ok:false, code:"network", message:String(e)}; }
}
async function signIn(identifier, password){
  if (!available()) return {ok:false, code:"nocloud"};
  if (!online())    return {ok:false, code:"offline"};
  try{
    const cred = credFor(identifier);
    const {data, error} = await sb.auth.signInWithPassword(Object.assign({}, cred, {password}));
    if (error) return {ok:false, code:"auth", message:error.message};
    return {ok:true, user:data.user, session:data.session};
  }catch(e){ return {ok:false, code:"network", message:String(e)}; }
}
async function sendReset(identifier){
  if (!available()) return {ok:false, code:"nocloud"};
  if (!online())    return {ok:false, code:"offline"};
  if (!isEmail(identifier)) return {ok:false, code:"phonereset"};
  try{
    const opts = CFG.SITE_URL ? {redirectTo: CFG.SITE_URL} : {};
    const {error} = await sb.auth.resetPasswordForEmail(String(identifier).trim().toLowerCase(), opts);
    if (error) return {ok:false, code:"auth", message:error.message};
    return {ok:true};
  }catch(e){ return {ok:false, code:"network", message:String(e)}; }
}
/* when the user returns from a reset-password email link */
async function completeReset(newPassword){
  if (!available()) return {ok:false, code:"nocloud"};
  try{
    const {error} = await sb.auth.updateUser({password:newPassword});
    if (error) return {ok:false, code:"auth", message:error.message};
    return {ok:true};
  }catch(e){ return {ok:false, code:"network", message:String(e)}; }
}
async function changePassword(newPassword){ return completeReset(newPassword); }
async function currentUser(){
  if (!available()) return null;
  try{ const {data} = await sb.auth.getUser(); return data ? data.user : null; }catch(e){ return null; }
}
async function signOut(){ try{ if (sb) await sb.auth.signOut(); }catch(e){} }
function isRecoveryLink(){
  const h = location.hash || "";
  return /type=recovery/.test(h) || /type=recovery/.test(location.search||"");
}
function onAuthEvent(cb){ try{ if (sb) sb.auth.onAuthStateChange((ev,sess)=>cb(ev,sess)); }catch(e){} }

/* ---------- profile + data sync ---------- */
async function pullProfile(userId){
  if (!available() || !online()) return null;
  try{
    const {data, error} = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) return null;
    return data || null;
  }catch(e){ return null; }
}
async function pushProfile(userId, row){
  if (!available() || !online()) return {ok:false, code:"offline"};
  try{
    const payload = Object.assign({id:userId, updated_at:new Date().toISOString()}, row);
    const {error} = await sb.from("profiles").upsert(payload, {onConflict:"id"});
    if (error) return {ok:false, code:"db", message:error.message};
    return {ok:true};
  }catch(e){ return {ok:false, code:"network", message:String(e)}; }
}
return { configured, available, online, init, isEmail, e164,
         signUp, signIn, sendReset, completeReset, changePassword,
         currentUser, signOut, isRecoveryLink, onAuthEvent,
         pullProfile, pushProfile, err:()=>lastError };
})();
window.CLOUD = CLOUD;

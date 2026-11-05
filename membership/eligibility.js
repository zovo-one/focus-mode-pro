(function(root){'use strict';
// Focus Mode Pro licence model (read from background.js, unchanged):
//   chrome.storage.local.zovoLicense = {valid, tier:'free'|'pro', email, features, cachedAt, lastVerifiedAt, expiresAt}
//   chrome.storage.sync.licenseKey   = 'ZOVO-XXXX-XXXX-XXXX-XXXX' (retained even when the cache is downgraded)
// The hourly licenseCheck alarm rewrites zovoLicense with a free record on a 401, and REMOVE_LICENSE deletes it,
// so a prior member is captured from oldValue by observer.js and persisted under monotonic flags.
const CAMPAIGN="zovo.membership.focus.v1",PRODUCT="Focus Mode Pro",CARD="Keep distractions blocked. Help me keep improving Focus Mode Pro.",DAYS30=30*86400000;
const SOURCES=[{area:'local',key:'zovoLicense'},{area:'sync',key:'licenseKey'}];
const WATCH={local:['zovoLicense'],sync:['licenseKey']};
function finiteFuture(v,now){return typeof v==='number'&&Number.isFinite(v)&&v>now;}
function recordKind(record,now){
 if(record===undefined||record===null)return 'free';
 if(typeof record!=='object'||Array.isArray(record))return 'unknown';
 if(record.tier==='trial'){const until=record.trialExpires??record.expiresAt;return finiteFuture(until,now)?'trial':'unknown';}
 if(record.valid===true||record.isPro===true)return 'member';
 if(typeof record.tier==='string'&&record.tier&&record.tier!=='free')return 'member';
 if(record.tier!==undefined&&record.tier!==null&&record.tier!=='free')return 'unknown';
 if(record.valid!==undefined&&record.valid!==null&&record.valid!==false)return 'unknown';
 if(record.isPro!==undefined&&record.isPro!==null&&record.isPro!==false)return 'unknown';
 for(const key of ['cachedAt','lastVerifiedAt','expiresAt'])if(record[key]!==undefined&&record[key]!==null&&typeof record[key]!=='number')return 'unknown';
 return 'free';
}
function keyKind(key){if(key===undefined||key===null||key==='')return 'free';return 'unknown';}
function kindOf(area,key,value,now){now=now||Date.now();if(area==='local'&&key==='zovoLicense')return recordKind(value,now);if(area==='sync'&&key==='licenseKey')return keyKind(value);return 'free';}
function trialExpiry(area,key,value){if(area==='local'&&key==='zovoLicense'&&value&&typeof value==='object'&&value.tier==='trial'){const until=value.trialExpires??value.expiresAt;return typeof until==='number'&&Number.isFinite(until)?until:0;}return 0;}
function combine(kinds){if(kinds.includes('member'))return 'member';if(kinds.includes('unknown'))return 'unknown';if(kinds.includes('trial'))return 'trial';return 'free';}
function subscriptionKind(values,now){now=now||Date.now();return combine(SOURCES.map(s=>kindOf(s.area,s.key,values&&values[s.area]?values[s.area][s.key]:undefined,now)));}
function classify(values,state,now){const kind=subscriptionKind(values,now);if(kind!=='free')return kind;
 if(state!==undefined&&state!==null){if(typeof state!=='object'||Array.isArray(state))return 'unknown';if(state.memberSeen)return 'member';if(state.recoverySeen)return 'unknown';if(state.hidden===true)return 'dismissed';if(state.dismissedAt!==undefined&&(typeof state.dismissedAt!=='number'||!Number.isFinite(state.dismissedAt)))return 'unknown';if(state.dismissedAt&&now-state.dismissedAt<DAYS30)return 'dismissed';}return 'free';}
const MEMBER=CAMPAIGN+'.memberSeen',RECOVERY=CAMPAIGN+'.recoverySeen',TRIAL=CAMPAIGN+'.trialUntil',PORT=CAMPAIGN+'.status';
// Dedicated flags are monotonic and cannot be overwritten by a dismissal RMW.
function requestWorkerStatus(){return new Promise(resolve=>{let port,done=false;const finish=status=>{if(done)return;done=true;clearTimeout(timer);try{port?.disconnect();}catch{}resolve(status);};const timer=setTimeout(()=>finish('unknown'),2500);try{port=chrome.runtime.connect({name:PORT});port.onMessage.addListener(message=>{finish(message&&message.campaign===CAMPAIGN&&['free','member','trial','unknown'].includes(message.status)?message.status:'unknown');});port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;finish('unknown');});port.postMessage({request:'status'});}catch{finish('unknown');}});}
async function readValues(){const values={local:{},sync:{}};values.local=await chrome.storage.local.get([...WATCH.local,CAMPAIGN,MEMBER,RECOVERY,TRIAL]);if(WATCH.sync.length)values.sync=await chrome.storage.sync.get(WATCH.sync);return values;}
async function read(){try{const values=await readValues();const data=values.local;const now=Date.now();const localKind=classify(values,data[CAMPAIGN],now);if(data[MEMBER]===true)return 'member';if(data[RECOVERY]===true)return 'unknown';if(data[TRIAL]!==undefined&&(typeof data[TRIAL]!=='number'||!Number.isFinite(data[TRIAL])))return 'unknown';if(data[TRIAL]>now)return 'trial';const workerKind=await requestWorkerStatus();if(workerKind!=='free')return workerKind;return localKind;}catch{return 'unknown';}}
// "Hide these notes" is monotonic: a later "Not now" (30-day cooldown) never re-enables the card.
async function dismiss(forever){const data=await chrome.storage.local.get(CAMPAIGN);const prior=data[CAMPAIGN]&&typeof data[CAMPAIGN]==='object'&&!Array.isArray(data[CAMPAIGN])?data[CAMPAIGN]:{};await chrome.storage.local.set({[CAMPAIGN]:{...prior,dismissedAt:Date.now(),hidden:forever===true||prior.hidden===true}});}
function touches(changes,area){if(area==='local'){if(changes[CAMPAIGN]||changes[MEMBER]||changes[RECOVERY]||changes[TRIAL])return true;}const keys=WATCH[area]||[];return keys.some(k=>changes[k]);}
root.ZovoSubscriptionMembership={CAMPAIGN,PRODUCT,CARD,SOURCES,WATCH,kindOf,trialExpiry,combine,subscriptionKind,recordKind,classify,read,readValues,dismiss,touches,MEMBER,RECOVERY,TRIAL,PORT};
})(globalThis);

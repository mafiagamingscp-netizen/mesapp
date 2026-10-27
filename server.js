'use strict';
// LastVix WhatsApp cloud sender: reads the queue from Firebase and sends via Baileys. Session is kept in Firebase (no re-scan after restarts).
// غير رسمي: الرقم ممكن يتحظر. يرسل فقط بين 8 صباحًا و10 مساءً بتوقيت القاهرة وبفاصل عشوائي وحد يومي.
const express=require('express'),pino=require('pino');
const {initializeApp}=require('firebase/app'),{getAuth,signInWithEmailAndPassword}=require('firebase/auth');
const {getDatabase,ref,onValue,update,get,set,remove,child}=require('firebase/database');
const EMAIL=process.env.ADMIN_EMAIL||'ad123@lastvix.app',PASS=process.env.ADMIN_PASS,PHONE=String(process.env.PAIR_PHONE||'').replace(/\D/g,''),TOKEN=process.env.PAGE_TOKEN||'',PORT=+process.env.PORT||3000;
const MIN=+process.env.MIN_DELAY||8,MAX=+process.env.MAX_DELAY||20,DAILY=+process.env.DAILY||300,PER_KEY=+process.env.PER_KEY||120;
if(!PASS){console.error('ADMIN_PASS مطلوب');process.exit(1)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fbApp=initializeApp({apiKey:'AIzaSyDiXfWn8EAke6rfp4S-tP-JPrEgv5ivBkA',authDomain:'communication-ebba7.firebaseapp.com',databaseURL:'https://communication-ebba7-default-rtdb.firebaseio.com',projectId:'communication-ebba7',appId:'1:41372617613:web:ac3b95e52e9bffa2d98bc4'});
let db,sock,ready=false,pairCode='',queue={},busy=false,day='',total=0,perKey={};
const fk=f=>String(f).replace(/[.#$\[\]\/]/g,'_');
async function useFbAuth(B,base){
  const {initAuthCreds,BufferJSON,proto}=B,rd=async f=>{const s=await get(child(base,fk(f)));return s.exists()?JSON.parse(s.val(),BufferJSON.reviver):null};
  const wr=(f,d)=>set(child(base,fk(f)),JSON.stringify(d,BufferJSON.replacer)),del=f=>remove(child(base,fk(f)));
  const creds=(await rd('creds'))||initAuthCreds();
  return{state:{creds,keys:{
    get:async(type,ids)=>{const out={};await Promise.all(ids.map(async id=>{let v=await rd(type+'-'+id);if(type==='app-state-sync-key'&&v)v=proto.Message.AppStateSyncKeyData.fromObject(v);out[id]=v}));return out},
    set:async data=>{const t=[];for(const c in data)for(const id in data[c]){const v=data[c][id];t.push(v?wr(c+'-'+id,v):del(c+'-'+id))}await Promise.all(t)}}},
    saveCreds:()=>wr('creds',creds)};
}
async function start(){
  const B=await import('@whiskeysockets/baileys'),g=k=>B[k]||(B.default&&B.default[k]),mk=(B.default&&B.default.default)||B.default||B.makeWASocket;
  const {state,saveCreds}=await useFbAuth({initAuthCreds:g('initAuthCreds'),BufferJSON:g('BufferJSON'),proto:g('proto')},ref(db,'waAuth'));
  const {version}=await g('fetchLatestBaileysVersion')();
  sock=mk({version,auth:state,logger:pino({level:'silent'}),browser:['LastVix','Chrome','1.0'],printQRInTerminal:false});
  sock.ev.on('creds.update',saveCreds);
  if(!state.creds.registered){if(!PHONE){console.log('ضيف PAIR_PHONE (رقمك بكود الدولة)')}else setTimeout(async()=>{try{pairCode=await sock.requestPairingCode(PHONE);console.log('🔑 كود الربط:',pairCode)}catch(e){console.log('تعذر طلب كود الربط',e.message)}},4000)}
  sock.ev.on('connection.update',async u=>{
    if(u.connection==='open'){ready=true;pairCode='';console.log('✅ واتساب متصل');pump()}
    if(u.connection==='close'){ready=false;const c=u.lastDisconnect&&u.lastDisconnect.error&&u.lastDisconnect.error.output&&u.lastDisconnect.error.output.statusCode;
      if(c===(g('DisconnectReason')||{}).loggedOut){console.log('تم تسجيل الخروج — مسح الجلسة');await remove(ref(db,'waAuth')).catch(()=>{});process.exit(0)}else setTimeout(()=>start().catch(console.error),3000)}});
}
const cairoHour=()=>+new Date().toLocaleString('en-US',{timeZone:'Africa/Cairo',hour:'numeric',hour12:false})%24;
async function pump(){if(busy)return;busy=true;
  try{while(true){
    const today=new Date().toDateString();if(today!==day){day=today;total=0;perKey={}}
    if(!ready)break;const h=cairoHour();if(h<8||h>=22)break;if(total>=DAILY)break;
    let pick=null;const now=Date.now();
    for(const k in queue)for(const id in queue[k]){const j=queue[k][id];if(j&&j.status==='pending'&&+j.sendAt<=now&&(perKey[k]||0)<PER_KEY&&(!pick||j.sendAt<pick.j.sendAt))pick={k,id,j}}
    if(!pick)break;const {k,id,j}=pick;const to=String(j.to||'').replace(/\D/g,''),text=String(j.text||'').slice(0,1000);
    queue[k][id].status='sending';
    try{if(to.length<10||!text)throw new Error('bad item');await sock.sendMessage(to+'@s.whatsapp.net',{text});total++;perKey[k]=(perKey[k]||0)+1;await update(ref(db,'waQueue/'+k+'/'+id),{status:'sent',sentAt:Date.now()})}
    catch(e){console.log('فشل',e.message);await update(ref(db,'waQueue/'+k+'/'+id),{status:'failed',err:String(e.message).slice(0,80)}).catch(()=>{})}
    await sleep((MIN+Math.random()*(MAX-MIN))*1000)}}finally{busy=false}}
setInterval(pump,60000);
const app=express();app.disable('x-powered-by');
app.get('/health',(r,s)=>s.send('ok'));
app.get('/code',(req,res)=>{if(!TOKEN||req.query.t!==TOKEN)return res.status(403).send('forbidden');res.send('<meta charset="utf-8"><meta http-equiv="refresh" content="5"><body style="font-family:sans-serif;text-align:center;padding:30px;direction:rtl">'+(ready?'<h2>✅ واتساب متصل</h2>':pairCode?'<h3>واتساب ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف بدلًا من ذلك</h3><h1 style="letter-spacing:6px;direction:ltr">'+pairCode+'</h1>':'<p>جاري التجهيز... حدّث الصفحة بعد ثواني</p>'))});
app.listen(PORT,()=>console.log('server on',PORT));
(async()=>{await signInWithEmailAndPassword(getAuth(fbApp),EMAIL,PASS);db=getDatabase(fbApp);console.log('✅ دخول الأدمن');onValue(ref(db,'waQueue'),s=>{queue=s.val()||{};pump()});await start()})().catch(e=>{console.error(e);process.exit(1)});

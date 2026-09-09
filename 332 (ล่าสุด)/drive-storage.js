/* Manual, version-checked Drive storage; no Firebase or authentication keys exported. */
(() => {
  'use strict';
  const FOLDER = '1khpXrVLvw3ERl22OUwzApbnL27uAKdVs';
  const CONFIG = 'st_drive_config_v1', BASE = 'st_drive_base_v1';
  const $ = id => document.getElementById(id);
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const snapshot = () => Object.fromEntries(Object.keys(localStorage).filter(syncEligibleKey).sort().map(k => [k,localStorage.getItem(k)]));
  const canonical = data => JSON.stringify(Object.fromEntries(Object.keys(data).sort().map(k => [k,data[k]])));
  let busy = false;
  const style = document.createElement('style');
  style.textContent = '#st-drive-open{position:fixed;right:16px;bottom:16px;z-index:900;padding:10px 16px;border-radius:24px;background:#164e63;color:white;border:1px solid #fff;box-shadow:0 3px 14px #0003;font:inherit}#st-drive-dialog{position:fixed;inset:0;margin:auto;box-sizing:border-box;width:min(540px,94vw);max-height:90vh;overflow:auto;border:0;border-radius:16px;padding:24px;background:white;color:#163344}#st-drive-dialog::backdrop{background:#10252dcc}#st-drive-dialog label{display:block;margin:16px 0 6px}#st-drive-dialog input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #b6c5cc;border-radius:8px;font:inherit}#st-drive-dialog button{padding:10px 12px;border-radius:8px;border:1px solid #b6c5cc;font:inherit;cursor:pointer}#st-drive-dialog .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}#st-drive-dialog p{line-height:1.7}#st-drive-status{white-space:pre-wrap;background:#eff6f8;padding:12px;border-radius:8px}@media print{#st-drive-open,#st-drive-dialog{display:none!important}}';
  document.head.append(style);
  const holder = document.createElement('div');
  holder.innerHTML = `<button id="st-drive-open" type="button">ฐานข้อมูล Drive</button><dialog id="st-drive-dialog" aria-labelledby="st-drive-title"><h2 id="st-drive-title">ฐานข้อมูล Google Drive</h2><p>เก็บข้อมูล Saint Theresa ในโฟลเดอร์ ปพ.5<br><strong>กดบันทึกก่อนปิดงาน และโหลดข้อมูลล่าสุดก่อนเริ่มงานจากอีกเครื่อง</strong> ระบบนี้ไม่ซิงค์อัตโนมัติ</p><p>ไฟล์ฐานข้อมูลเข้ารหัส และคงสิทธิ์โฟลเดอร์เดิม</p><a href="https://drive.google.com/drive/folders/${FOLDER}" target="_blank" rel="noopener">เปิดโฟลเดอร์ ปพ.5</a> · <a href="drive-setup.html" target="_blank" rel="noopener">วิธีเชื่อมต่อครั้งแรก</a><label for="st-drive-url">URL เว็บแอป Apps Script (ลงท้าย /exec)</label><input id="st-drive-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"><label for="st-drive-key">รหัสเชื่อมต่อ ST_ACCESS_KEY</label><input id="st-drive-key" type="password" autocomplete="off"><p>รหัสจำเฉพาะแท็บนี้ ปิดแท็บแล้วต้องกรอกใหม่ เก็บรหัสไว้เพื่อเปิดข้อมูลที่เข้ารหัส</p><div class="actions"><button id="st-drive-connect">ตรวจการเชื่อมต่อ</button><button id="st-drive-load">โหลดจาก Drive</button><button id="st-drive-save">บันทึกลง Drive</button><button id="st-drive-close">ปิด</button></div><p id="st-drive-status" role="status" aria-live="polite"></p></dialog>`;
  document.body.append(holder);
  function status(message) { $('st-drive-status').textContent = message; }
  function settings() {
    const url = $('st-drive-url').value.trim(), key = $('st-drive-key').value.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) throw new Error('กรอก URL Apps Script ที่ลงท้าย /exec');
    if (key.length < 32) throw new Error('กรอกรหัส ST_ACCESS_KEY จากการตั้งค่า Apps Script');
    return {url,key};
  }
  function offlineOnly() {
    if (localStorage.getItem('lk3_mode') !== 'offline') throw new Error('เลือก “ใช้งานออฟไลน์” ที่หน้าเข้าใช้ก่อนใช้ฐานข้อมูล Drive เพื่อไม่ให้ข้อมูลปะปนกับ Firebase');
  }
  async function api(cfg,body) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(),45000);
    try {
      const response = await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...body,key:cfg.key}),redirect:'follow',credentials:'omit',signal:controller.signal});
      if (!response.ok) throw new Error('HTTP '+response.status);
      const result = await response.json();
      if (!result.ok) {
        const messages = {CONFLICT:'มีข้อมูลรุ่นใหม่บน Drive ระบบไม่ได้เขียนทับ กรุณาสำรองงานในเครื่อง แล้วโหลดข้อมูลล่าสุดและรวมงานก่อนบันทึกใหม่',UNAUTHORIZED:'รหัสเชื่อมต่อไม่ถูกต้อง',BUSY:'มีผู้ใช้อื่นกำลังบันทึก กรุณาลองใหม่',SERVER_ERROR:'Apps Script อ่านหรือเขียนโฟลเดอร์ไม่ได้ ตรวจสิทธิ์และประวัติการทำงานใน Apps Script'};
        throw new Error(messages[result.error] || result.error || 'คำตอบจากเซิร์ฟเวอร์ไม่ถูกต้อง');
      }
      return result;
    } finally { clearTimeout(timer); }
  }
  const b64 = bytes => { let s=''; for (let i=0;i<bytes.length;i+=8192) s+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(s); };
  const un64 = s => Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  async function cryptoKey(secret) {
    const input = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:new TextEncoder().encode('SaintTheresa:'+FOLDER),iterations:250000,hash:'SHA-256'},input,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(data,secret) {
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cryptoKey(secret),new TextEncoder().encode(JSON.stringify({format:'SaintTheresaStorage1',data})));
    return {format:'ST-AES-GCM-1',iv:b64(iv),data:b64(new Uint8Array(bytes))};
  }
  async function decrypt(payload,secret) {
    if (!payload || payload.format!=='ST-AES-GCM-1') throw new Error('รูปแบบฐานข้อมูลไม่ถูกต้อง');
    let value;
    try { value=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(payload.iv)},await cryptoKey(secret),un64(payload.data)))); }
    catch { throw new Error('เปิดฐานข้อมูลไม่ได้ รหัสไม่ตรงกับรหัสที่ใช้เข้ารหัส หรือไฟล์เสียหาย'); }
    if (value.format!=='SaintTheresaStorage1' || !value.data || Array.isArray(value.data) || typeof value.data!=='object') throw new Error('ข้อมูลไม่ถูกต้อง');
    for (const [k,v] of Object.entries(value.data)) {
      if (!syncEligibleKey(k) || typeof v!=='string') throw new Error('พบคีย์ข้อมูลที่ไม่อนุญาต');
      try { JSON.parse(v); } catch { throw new Error('ข้อมูลภายในฐานข้อมูลไม่สมบูรณ์'); }
    }
    return value.data;
  }
  async function fingerprint(data) { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(data))))); }
  async function baseline(cfg,revision,data) { localStorage.setItem(BASE,JSON.stringify({url:cfg.url,revision,hash:await fingerprint(data)})); }
  function remember(cfg) { localStorage.setItem(CONFIG,JSON.stringify({url:cfg.url})); sessionStorage.setItem('st_drive_key',cfg.key); }
  async function connect() {
    const cfg=settings(), result=await api(cfg,{action:'load'});
    if (result.folderId!==FOLDER || !Number.isSafeInteger(result.revision)) throw new Error('ตัวเชื่อมต่อไม่ตรงกับโฟลเดอร์ ปพ.5');
    if (result.payload) await decrypt(result.payload,cfg.key);
    remember(cfg);
    status(`เชื่อมต่อได้ ฐานข้อมูลรุ่น ${result.revision}\n`+(result.revision===0?'ยังไม่มีข้อมูล สามารถกดบันทึกครั้งแรกได้':'กดโหลดจาก Drive ก่อนเริ่มแก้ไข หากยังไม่เคยโหลดในเครื่องนี้'));
  }
  async function save() {
    offlineOnly();
    const cfg=settings(), base=read(BASE), data=snapshot();
    if (!Object.keys(data).length) throw new Error('ยังไม่มีข้อมูลในเครื่องให้บันทึก');
    let revision;
    if (base && base.url===cfg.url) revision=base.revision;
    else {
      const remote=await api(cfg,{action:'load'});
      if(remote.folderId!==FOLDER || remote.revision!==0) throw new Error('มีฐานข้อมูลอยู่แล้ว ต้องโหลดจาก Drive ก่อนบันทึก เพื่อไม่ให้เขียนทับงานเดิม');
      revision=0;
    }
    const payload=await encrypt(data,cfg.key);
    if (payload.data.length>11000000) throw new Error('ข้อมูลใหญ่เกินขนาดที่ตัวเชื่อมต่อรองรับ กรุณาสำรองเป็นไฟล์จากเมนูสำรองข้อมูล');
    const result=await api(cfg,{action:'save',revision,payload,operationId:crypto.randomUUID()});
    if (result.revision!==revision+1) throw new Error('ไม่สามารถยืนยันรุ่นข้อมูลที่บันทึกได้');
    remember(cfg); await baseline(cfg,result.revision,data);
    status(`บันทึกบน Drive สำเร็จ รุ่น ${result.revision}\n${new Date(result.updatedAt).toLocaleString('th-TH')}`);
  }
  async function load() {
    offlineOnly();
    const cfg=settings(), result=await api(cfg,{action:'load'});
    if (result.folderId!==FOLDER || !Number.isSafeInteger(result.revision)) throw new Error('ตัวเชื่อมต่อไม่ตรงกับโฟลเดอร์ ปพ.5');
    if (!result.payload) throw new Error('Drive ยังไม่มีข้อมูล ให้บันทึกครั้งแรกจากเครื่องที่มีข้อมูล');
    const data=await decrypt(result.payload,cfg.key), previous=snapshot();
    if(!confirm('โหลดรุ่น '+result.revision+' แทนข้อมูลในเครื่องทั้งหมด? ระบบจะดาวน์โหลดไฟล์สำรองข้อมูลเดิมก่อนแทนที่')) return;
    if (Object.keys(previous).length) doBackup();
    // Do not use sv(): restoring a snapshot must not trigger Firebase writes.
    try {
      Object.keys(previous).forEach(k=>localStorage.removeItem(k));
      for (const [k,v] of Object.entries(data)) localStorage.setItem(k,v);
    } catch (err) {
      Object.keys(snapshot()).forEach(k=>localStorage.removeItem(k));
      for (const [k,v] of Object.entries(previous)) localStorage.setItem(k,v);
      throw new Error('พื้นที่ในเครื่องไม่เพียงพอ คืนข้อมูลเดิมแล้ว');
    }
    remember(cfg); await baseline(cfg,result.revision,data);
    location.reload();
  }
  async function run(fn) {
    if(busy)return; busy=true;
    $('st-drive-dialog').querySelectorAll('button,input').forEach(el=>el.disabled=true);
    status('กำลังติดต่อ Drive…');
    try { await fn(); }
    catch(err) { status((err.name==='AbortError'?'หมดเวลารอ ยังยืนยันการบันทึกไม่ได้':err.message)+'\nหากการเชื่อมต่อขัดข้อง ข้อมูลในเครื่องยังอยู่ กรุณาตรวจการเชื่อมต่อก่อนลองใหม่'); }
    finally { busy=false; $('st-drive-dialog').querySelectorAll('button,input').forEach(el=>el.disabled=false); }
  }
  $('st-drive-open').onclick=()=>{
    $('st-drive-url').value=(read(CONFIG)||{}).url||'';
    $('st-drive-key').value=sessionStorage.getItem('st_drive_key')||'';
    const base=read(BASE);
    status(base?'เครื่องนี้อ้างอิงข้อมูลรุ่น '+base.revision+' — กดบันทึกเพื่อส่งงานล่าสุด':'ยังไม่ได้โหลดหรือบันทึกฐานข้อมูล Drive ในเครื่องนี้');
    $('st-drive-dialog').showModal();
  };
  $('st-drive-close').onclick=()=>$('st-drive-dialog').close();
  $('st-drive-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('st-drive-connect').onclick=()=>run(connect);
  $('st-drive-save').onclick=()=>run(save);
  $('st-drive-load').onclick=()=>run(load);
})();


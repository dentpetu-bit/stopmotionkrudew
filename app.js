const views = [...document.querySelectorAll('.view')];
const qs = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];
const toast = (msg) => { const t=qs('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); };

let currentProject = null;
let frames = [];
let tool = 'pen';
let drawing = false;
let historyStack = [];
let previewTimer = null;
let previewIndex = 0;
let lastPoint = null;

const drawCanvas = qs('#drawCanvas');
const onionCanvas = qs('#onionCanvas');
const ctx = drawCanvas.getContext('2d', { willReadFrequently:true });
const onionCtx = onionCanvas.getContext('2d');

function showView(id){ views.forEach(v=>v.classList.toggle('active', v.id===id)); if(id==='galleryView') loadGallery(); }
qsa('[data-open]').forEach(b=>b.onclick=()=>showView(b.dataset.open));
qs('#homeBtn').onclick=()=>showView('homeView');
qs('#adminBtn').onclick=()=>showView('adminView');

function resizeCanvas(){
  const wrap = qs('.canvas-wrap');
  const rect = wrap.getBoundingClientRect();
  const old = document.createElement('canvas');
  old.width = drawCanvas.width || 1; old.height = drawCanvas.height || 1;
  old.getContext('2d').drawImage(drawCanvas,0,0);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  [drawCanvas,onionCanvas].forEach(c=>{ c.width = Math.floor(rect.width*dpr); c.height = Math.floor(rect.height*dpr); c.style.width=rect.width+'px'; c.style.height=rect.height+'px'; });
  ctx.setTransform(dpr,0,0,dpr,0,0);
  onionCtx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,rect.width,rect.height);
  if(old.width>1) ctx.drawImage(old,0,0,rect.width,rect.height);
  drawOnion();
}
window.addEventListener('resize', () => setTimeout(resizeCanvas, 100));

function clearCanvas(){ const r=drawCanvas.getBoundingClientRect(); ctx.fillStyle='#fff'; ctx.fillRect(0,0,r.width,r.height); saveHistory(); }
function saveHistory(){ try{ historyStack.push(drawCanvas.toDataURL('image/png')); if(historyStack.length>20) historyStack.shift(); }catch(e){} }
function undo(){ if(historyStack.length<2) return; historyStack.pop(); const img=new Image(); img.onload=()=>{ const r=drawCanvas.getBoundingClientRect(); ctx.clearRect(0,0,r.width,r.height); ctx.drawImage(img,0,0,r.width,r.height); }; img.src=historyStack[historyStack.length-1]; }

function getPoint(e){ const r=drawCanvas.getBoundingClientRect(); return { x:e.clientX-r.left, y:e.clientY-r.top }; }
function startDraw(e){ e.preventDefault(); drawing=true; lastPoint=getPoint(e); saveHistory(); }
function moveDraw(e){
  if(!drawing) return; e.preventDefault();
  const p=getPoint(e); const size=+qs('#brushSize').value;
  ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=size;
  ctx.globalCompositeOperation = tool==='eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = qs('#colorPicker').value;
  ctx.beginPath(); ctx.moveTo(lastPoint.x,lastPoint.y); ctx.lineTo(p.x,p.y); ctx.stroke();
  lastPoint=p;
}
function endDraw(){ drawing=false; ctx.globalCompositeOperation='source-over'; }

drawCanvas.addEventListener('pointerdown', startDraw);
drawCanvas.addEventListener('pointermove', moveDraw);
drawCanvas.addEventListener('pointerup', endDraw);
drawCanvas.addEventListener('pointercancel', endDraw);
drawCanvas.addEventListener('pointerleave', endDraw);

qsa('.tool').forEach(b=>b.onclick=()=>{ tool=b.dataset.tool; qsa('.tool').forEach(x=>x.classList.remove('active')); b.classList.add('active'); });
qs('#undoBtn').onclick=undo;
qs('#clearBtn').onclick=()=>{ if(confirm('ล้างภาพบน Canvas ใช่ไหม?')) clearCanvas(); };
qs('#onionToggle').onchange=drawOnion;

async function createOrGetStudent(code,name,room){
  const { data: found } = await sb.from('students').select('*').eq('student_code', code).maybeSingle();
  if(found) return found;
  const { data, error } = await sb.from('students').insert({ student_code:code, student_name:name, room }).select().single();
  if(error) throw error; return data;
}

qs('#createProjectBtn').onclick = async () => {
  try{
    const code=qs('#studentCode').value.trim(), name=qs('#studentName').value.trim(), room=qs('#studentRoom').value.trim(), pname=qs('#projectName').value.trim(), desc=qs('#projectDesc').value.trim();
    if(!code||!name||!room||!pname) return toast('กรอกข้อมูลให้ครบก่อนครับ');
    const student = await createOrGetStudent(code,name,room);
    const { data, error } = await sb.from('projects').insert({ student_id:student.id, project_name:pname, description:desc, frame_count:0 }).select('*, students(*)').single();
    if(error) throw error;
    await openProject(data);
    toast('สร้างโปรเจกต์สำเร็จ เริ่มวาดได้เลย');
  }catch(err){ console.error(err); toast('สร้างโปรเจกต์ไม่สำเร็จ: '+err.message); }
};

async function openProject(project){
  currentProject = project;
  qs('#currentProjectTitle').textContent = project.project_name;
  qs('#currentProjectMeta').textContent = `${project.students?.student_name || ''} • ห้อง ${project.students?.room || ''}`;
  showView('studioView');
  setTimeout(()=>{ resizeCanvas(); clearCanvas(); },100);
  await loadFrames();
}

async function loadFrames(){
  if(!currentProject) return;
  const { data, error } = await sb.from('frames').select('*').eq('project_id', currentProject.id).order('frame_number');
  if(error) return toast(error.message);
  frames = data || [];
  renderTimeline();
  drawOnion();
}

function renderTimeline(){
  qs('#frameCountBadge').textContent = `${frames.length} เฟรม`;
  const el=qs('#timeline'); el.innerHTML='';
  frames.forEach((f,i)=>{
    const d=document.createElement('div'); d.className='frame'; d.draggable=true; d.dataset.index=i;
    d.innerHTML=`<button title="ลบ">×</button><img src="${f.image_url}" alt="frame"><small>เฟรม ${i+1}</small>`;
    d.querySelector('button').onclick=async(ev)=>{ ev.stopPropagation(); await deleteFrame(f.id); };
    d.onclick=()=>loadFrameToCanvas(f.image_url);
    d.addEventListener('dragstart',ev=>ev.dataTransfer.setData('text/plain',i));
    d.addEventListener('dragover',ev=>ev.preventDefault());
    d.addEventListener('drop',async ev=>{ ev.preventDefault(); const from=+ev.dataTransfer.getData('text/plain'); await reorderFrames(from,i); });
    el.appendChild(d);
  });
}

async function loadFrameToCanvas(url){
  const img=new Image(); img.crossOrigin='anonymous';
  img.onload=()=>{ const r=drawCanvas.getBoundingClientRect(); ctx.fillStyle='#fff'; ctx.fillRect(0,0,r.width,r.height); ctx.drawImage(img,0,0,r.width,r.height); saveHistory(); };
  img.src=url;
}

function drawOnion(){
  const r=onionCanvas.getBoundingClientRect(); onionCtx.clearRect(0,0,r.width,r.height);
  if(!qs('#onionToggle').checked || !frames.length) return;
  const img=new Image(); img.crossOrigin='anonymous';
  img.onload=()=>onionCtx.drawImage(img,0,0,r.width,r.height);
  img.src=frames[frames.length-1].image_url;
}

function canvasToBlob(){ return new Promise(resolve=>drawCanvas.toBlob(resolve,'image/png',0.95)); }
qs('#saveFrameBtn').onclick = async()=>{
  try{
    if(!currentProject) return toast('ยังไม่ได้เลือกโปรเจกต์');
    const blob = await canvasToBlob();
    const n = frames.length + 1;
    const path = `${currentProject.id}/frame-${String(n).padStart(4,'0')}-${Date.now()}.png`;
    const { error: upErr } = await sb.storage.from(BUCKET_NAME).upload(path, blob, { contentType:'image/png', upsert:false });
    if(upErr) throw upErr;
    const { data: pub } = sb.storage.from(BUCKET_NAME).getPublicUrl(path);
    const image_url = pub.publicUrl;
    const { error } = await sb.from('frames').insert({ project_id:currentProject.id, student_id:currentProject.student_id, frame_number:n, image_url });
    if(error) throw error;
    await sb.from('projects').update({ frame_count:n, cover_url: frames.length ? currentProject.cover_url : image_url, updated_at:new Date().toISOString() }).eq('id', currentProject.id);
    currentProject.cover_url = currentProject.cover_url || image_url;
    await loadFrames(); clearCanvas();
    toast(`บันทึกเฟรมที่ ${n} แล้ว`);
  }catch(err){ console.error(err); toast('บันทึกเฟรมไม่สำเร็จ: '+err.message); }
};

async function deleteFrame(id){
  if(!confirm('ลบเฟรมนี้ใช่ไหม?')) return;
  const { error } = await sb.from('frames').delete().eq('id',id);
  if(error) return toast(error.message);
  await renumberFrames(); await loadFrames(); toast('ลบเฟรมแล้ว');
}
async function reorderFrames(from,to){
  if(from===to) return;
  const arr=[...frames]; const [m]=arr.splice(from,1); arr.splice(to,0,m);
  await Promise.all(arr.map((f,i)=>sb.from('frames').update({frame_number:i+1}).eq('id',f.id)));
  await loadFrames();
}
async function renumberFrames(){
  const { data } = await sb.from('frames').select('*').eq('project_id',currentProject.id).order('frame_number');
  await Promise.all((data||[]).map((f,i)=>sb.from('frames').update({frame_number:i+1}).eq('id',f.id)));
  await sb.from('projects').update({ frame_count:(data||[]).length }).eq('id',currentProject.id);
}

function openPreview(){ if(!frames.length) return toast('ยังไม่มีเฟรม'); qs('#previewDialog').showModal(); qs('#previewImage').src=frames[0].image_url; }
function playPreview(){ if(!frames.length) return; clearInterval(previewTimer); const fps=+qs('#fpsSelect').value; previewTimer=setInterval(()=>{ qs('#previewImage').src=frames[previewIndex%frames.length].image_url; previewIndex++; },1000/fps); }
function stopPreview(){ clearInterval(previewTimer); previewIndex=0; if(frames[0]) qs('#previewImage').src=frames[0].image_url; }
qs('#previewBtn').onclick=()=>{ openPreview(); playPreview(); };
qs('#playPreviewBtn').onclick=playPreview;
qs('#pausePreviewBtn').onclick=()=>clearInterval(previewTimer);
qs('#stopPreviewBtn').onclick=stopPreview;
qs('#closePreviewBtn').onclick=()=>{ stopPreview(); qs('#previewDialog').close(); };

qs('#exportGifBtn').onclick = async()=>{
  if(!frames.length) return toast('ยังไม่มีเฟรมสำหรับ Export');
  toast('กำลังสร้าง GIF...');
  const gif = new GIF({ workers:2, quality:10, workerScript:'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js' });
  const fps=+qs('#fpsSelect').value;
  const delay=1000/fps;
  const r=drawCanvas.getBoundingClientRect();
  for(const f of frames){
    const img = await loadImage(f.image_url);
    const temp=document.createElement('canvas'); temp.width=r.width; temp.height=r.height;
    const tctx=temp.getContext('2d'); tctx.fillStyle='#fff'; tctx.fillRect(0,0,temp.width,temp.height); tctx.drawImage(img,0,0,temp.width,temp.height);
    gif.addFrame(temp,{delay});
  }
  gif.on('finished', blob=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(currentProject?.project_name||'stop-motion')+'.gif'; a.click(); toast('ดาวน์โหลด GIF แล้ว'); });
  gif.render();
};
function loadImage(url){ return new Promise((res,rej)=>{ const img=new Image(); img.crossOrigin='anonymous'; img.onload=()=>res(img); img.onerror=rej; img.src=url; }); }

async function getProjects(filterCode){
  let q = sb.from('projects').select('*, students(*)').order('created_at',{ascending:false});
  const { data, error } = await q;
  if(error) throw error;
  return filterCode ? data.filter(p=>p.students?.student_code===filterCode) : data;
}
async function loadGallery(){ try{ renderCards(await getProjects(), qs('#gallery')); }catch(e){ toast(e.message); } }
qs('#refreshGalleryBtn').onclick=loadGallery;
qs('#loadMyWorksBtn').onclick=async()=>{ const code=qs('#myStudentCode').value.trim(); if(!code)return toast('กรอกรหัสนักเรียนก่อน'); renderCards(await getProjects(code), qs('#myWorks')); };
function renderCards(projects, el){
  el.innerHTML=''; if(!projects.length){ el.innerHTML='<p class="empty">ยังไม่พบผลงาน</p>'; return; }
  projects.forEach(p=>{
    const c=document.createElement('div'); c.className='card';
    c.innerHTML=`<img src="${p.cover_url||''}" alt="cover"><div class="card-body"><h3>${p.project_name}</h3><p>${p.students?.student_name||'-'} • ห้อง ${p.students?.room||'-'}</p><p>${p.frame_count||0} เฟรม</p><p>${new Date(p.created_at).toLocaleString('th-TH')}</p><div class="card-actions"><button class="primary open">เปิดดู/แก้ไข</button></div></div>`;
    c.querySelector('.open').onclick=()=>openProject(p);
    el.appendChild(c);
  });
}

qs('#loginAdminBtn').onclick=async()=>{ if(qs('#adminPassword').value!==ADMIN_PASSWORD) return toast('รหัสผ่านไม่ถูกต้อง'); qs('#adminLogin').classList.add('hidden'); qs('#adminPanel').classList.remove('hidden'); await loadAdmin(); };
async function loadAdmin(){
  const projects=await getProjects();
  const { count: frameCount } = await sb.from('frames').select('*',{count:'exact',head:true});
  const students = new Set(projects.map(p=>p.student_id));
  qs('#statProjects').textContent=projects.length; qs('#statFrames').textContent=frameCount||0; qs('#statStudents').textContent=students.size;
  renderAdmin(projects);
}
function renderAdmin(projects){
  const keyword=qs('#adminSearch').value.trim().toLowerCase();
  const list=projects.filter(p=>`${p.project_name} ${p.students?.student_name} ${p.students?.room}`.toLowerCase().includes(keyword));
  const el=qs('#adminList'); el.innerHTML='';
  list.forEach(p=>{
    const c=document.createElement('div'); c.className='card';
    c.innerHTML=`<img src="${p.cover_url||''}"><div class="card-body"><h3>${p.project_name}</h3><p>${p.students?.student_name||'-'} • ${p.students?.room||'-'}</p><p>${p.frame_count||0} เฟรม</p><div class="card-actions"><button class="primary open">เปิด</button><button class="secondary csv">CSV</button><button class="danger del">ลบ</button></div></div>`;
    c.querySelector('.open').onclick=()=>openProject(p);
    c.querySelector('.csv').onclick=()=>downloadProjectCsv(p);
    c.querySelector('.del').onclick=()=>deleteProject(p.id);
    el.appendChild(c);
  });
}
qs('#adminSearch').oninput=loadAdmin;
async function deleteProject(id){ if(!confirm('ลบโปรเจกต์นี้และเฟรมทั้งหมดใช่ไหม?')) return; await sb.from('frames').delete().eq('project_id',id); await sb.from('projects').delete().eq('id',id); toast('ลบโปรเจกต์แล้ว'); loadAdmin(); }
async function downloadProjectCsv(p){ const {data}=await sb.from('frames').select('*').eq('project_id',p.id).order('frame_number'); downloadCsv(data||[], `frames-${p.project_name}.csv`); }
qs('#downloadCsvBtn').onclick=async()=>{ const projects=await getProjects(); downloadCsv(projects.map(p=>({project:p.project_name, student:p.students?.student_name, room:p.students?.room, frames:p.frame_count, created_at:p.created_at})), 'projects.csv'); };
function downloadCsv(rows,filename){ const keys=Object.keys(rows[0]||{}); const csv=[keys.join(','),...rows.map(r=>keys.map(k=>`"${String(r[k]??'').replaceAll('"','""')}"`).join(','))].join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download=filename; a.click(); }

setTimeout(()=>{ resizeCanvas(); clearCanvas(); },200);

/* Stop Motion Studio Classroom By Kru Dew - V9
   แก้ระบบวาดให้ใช้งานได้จริงบน iPad / Tablet / PC
   ใช้ Pointer Events + Canvas DPR Scaling + touch-action:none
*/

let currentTool = 'pen';
let currentProject = null;
let currentStudent = null;
let frames = [];
let isDrawing = false;
let lastPoint = null;
let undoStack = [];
let previewTimer = null;
let previewIndex = 0;
let adminProjectsCache = [];

const $ = (id) => document.getElementById(id);
const drawCanvas = $('drawCanvas');
const onionCanvas = $('onionCanvas');
const ctx = drawCanvas.getContext('2d', { willReadFrequently: true });
const onionCtx = onionCanvas.getContext('2d');

function toast(message, type = 'ok') {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast show ${type}`;
  setTimeout(() => el.className = 'toast', 2600);
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(id).classList.add('active');
  if (id === 'studioView') setTimeout(resizeCanvasKeepDrawing, 120);
}

document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.open)));
$('homeBtn').addEventListener('click', () => showView('homeView'));
$('adminBtn').addEventListener('click', () => showView('adminView'));

// ป้องกัน iPad เลื่อนหน้าเว็บระหว่างวาด
['touchstart','touchmove','touchend'].forEach(evt => {
  drawCanvas.addEventListener(evt, e => e.preventDefault(), { passive: false });
  onionCanvas.addEventListener(evt, e => e.preventDefault(), { passive: false });
});

function setCanvasSize(canvas, context, cssWidth, cssHeight) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeCanvasKeepDrawing() {
  const wrap = document.querySelector('.canvas-wrap');
  if (!wrap) return;
  const oldImage = document.createElement('canvas');
  oldImage.width = drawCanvas.width;
  oldImage.height = drawCanvas.height;
  oldImage.getContext('2d').drawImage(drawCanvas, 0, 0);

  const rect = wrap.getBoundingClientRect();
  const cssWidth = Math.max(320, Math.floor(rect.width));
  const cssHeight = Math.max(300, Math.floor(rect.height));

  setCanvasSize(drawCanvas, ctx, cssWidth, cssHeight);
  setCanvasSize(onionCanvas, onionCtx, cssWidth, cssHeight);

  // พื้นหลังขาว ทำให้ export เป็น PNG ไม่โปร่งใส
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  if (oldImage.width > 0) {
    ctx.drawImage(oldImage, 0, 0, cssWidth, cssHeight);
  }
  drawOnionSkin();
}

window.addEventListener('resize', () => setTimeout(resizeCanvasKeepDrawing, 120));
window.addEventListener('orientationchange', () => setTimeout(resizeCanvasKeepDrawing, 350));

function getPoint(e) {
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left),
    y: (e.clientY - rect.top),
    pressure: e.pressure && e.pressure > 0 ? e.pressure : 0.7
  };
}

function saveUndo() {
  try {
    undoStack.push(drawCanvas.toDataURL('image/png'));
    if (undoStack.length > 30) undoStack.shift();
  } catch (err) {
    console.warn('Undo save failed', err);
  }
}

function startDraw(e) {
  e.preventDefault();
  drawCanvas.setPointerCapture?.(e.pointerId);
  isDrawing = true;
  lastPoint = getPoint(e);
  saveUndo();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const p = getPoint(e);
  const size = Number($('brushSize').value);
  ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : $('colorPicker').value;
  ctx.lineWidth = currentTool === 'eraser' ? size * 1.8 : Math.max(1, size * p.pressure);

  // ใช้ quadratic curve ช่วยให้เส้นลื่นขึ้น
  const midX = (lastPoint.x + p.x) / 2;
  const midY = (lastPoint.y + p.y) / 2;
  ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
  ctx.stroke();
  lastPoint = p;
}

function endDraw(e) {
  if (!isDrawing) return;
  e?.preventDefault?.();
  isDrawing = false;
  ctx.closePath();
  ctx.globalCompositeOperation = 'source-over';
  lastPoint = null;
}

drawCanvas.addEventListener('pointerdown', startDraw);
drawCanvas.addEventListener('pointermove', draw);
drawCanvas.addEventListener('pointerup', endDraw);
drawCanvas.addEventListener('pointercancel', endDraw);
drawCanvas.addEventListener('pointerleave', endDraw);

// fallback สำหรับ browser เก่าบางตัว
if (!window.PointerEvent) {
  drawCanvas.addEventListener('mousedown', startDraw);
  drawCanvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', endDraw);
}

document.querySelectorAll('.tool').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
  });
});

$('undoBtn').addEventListener('click', () => {
  const data = undoStack.pop();
  if (!data) return toast('ยังไม่มีประวัติให้ย้อนกลับ', 'warn');
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
    ctx.drawImage(img, 0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
  };
  img.src = data;
});

$('clearBtn').addEventListener('click', () => {
  if (!confirm('ล้างภาพบนเฟรมปัจจุบันใช่ไหม?')) return;
  saveUndo();
  ctx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
});


// V5: แยกปุ่มถ่ายภาพและนำภาพจากคลัง เพื่อให้ iPad / Tablet เลือกจาก Photos ได้จริง
function ensureProjectBeforeImage() {
  if (!currentProject || !currentStudent) {
    toast('กรุณาสร้างหรือเปิดโปรเจกต์ก่อนนำภาพเข้า', 'warn');
    return false;
  }
  return true;
}

$('cameraBtn')?.addEventListener('click', () => {
  if (!ensureProjectBeforeImage()) return;
  $('cameraInput').click();
});

$('galleryImageBtn')?.addEventListener('click', () => {
  if (!ensureProjectBeforeImage()) return;
  $('galleryImageInput').click();
});

$('cameraInput')?.addEventListener('change', handleImageInputChange);
$('galleryImageInput')?.addEventListener('change', handleImageInputChange);

async function handleImageInputChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'warn');
    e.target.value = '';
    return;
  }
  try {
    await loadLocalFileToCanvas(file);
    drawOnionSkin();
    toast('นำภาพเข้า Canvas แล้ว สามารถขีดเขียนต่อได้เลย');
  } catch (err) {
    console.error(err);
    toast('นำภาพเข้าไม่สำเร็จ: ' + (err.message || err), 'err');
  } finally {
    e.target.value = '';
  }
}

async function loadLocalFileToCanvas(file) {
  // ใช้ FileReader แทน ObjectURL เพื่อให้ iPad/Safari อ่านรูปจาก Photos ได้เสถียรกว่า
  const dataUrl = await fileToDataURL(file);
  await drawImageSourceToCanvas(dataUrl);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('อ่านไฟล์ภาพจากอุปกรณ์ไม่ได้'));
    reader.readAsDataURL(file);
  });
}


// วาดรูปลงกรอบแบบ contain: คงสัดส่วน ไม่ยืด ไม่บิด และอยู่กึ่งกลาง
function drawImageContain(targetCtx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih || !w || !h) return;

  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;

  targetCtx.drawImage(img, dx, dy, dw, dh);
}

function drawImageSourceToCanvas(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      saveUndo();
      const w = drawCanvas.clientWidth;
      const h = drawCanvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);

      // วางภาพแบบ contain ให้อยู่กลาง Canvas ไม่บิดสัดส่วน
      const scale = Math.min(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      resolve();
    };
    img.onerror = () => reject(new Error('อ่านไฟล์ภาพไม่ได้'));
    img.src = src;
  });
}

$('newFrameBtn').addEventListener('click', () => {
  saveUndo();
  ctx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
  drawOnionSkin();
  toast('เปิดเฟรมใหม่แล้ว สามารถวาดต่อได้เลย');
});

$('duplicateFrameBtn').addEventListener('click', async () => {
  if (!frames.length) return toast('ยังไม่มีเฟรมก่อนหน้าให้คัดลอก', 'warn');
  await loadImageToCanvas(frames[frames.length - 1].image_url || frames[frames.length - 1].local_url);
  toast('คัดลอกเฟรมล่าสุดมาเป็นต้นแบบแล้ว');
});

$('onionToggle').addEventListener('change', drawOnionSkin);

async function createOrGetStudent(code, name, room) {
  let { data, error } = await sb.from('students').select('*').eq('student_code', code).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const res = await sb.from('students').insert({ student_code: code, student_name: name, room }).select().single();
  if (res.error) throw res.error;
  return res.data;
}

$('createProjectBtn').addEventListener('click', async () => {
  const student_code = $('studentCode').value.trim();
  const student_name = $('studentName').value.trim();
  const room = $('studentRoom').value.trim();
  const project_name = $('projectName').value.trim();
  const description = $('projectDesc').value.trim();
  if (!student_code || !student_name || !room || !project_name) return toast('กรอกข้อมูลให้ครบก่อนครับ', 'warn');
  try {
    currentStudent = await createOrGetStudent(student_code, student_name, room);
    const { data, error } = await sb.from('projects').insert({
      student_id: currentStudent.id, project_name, description, frame_count: 0
    }).select().single();
    if (error) throw error;
    currentProject = data;
    frames = [];
    updateProjectInfo();
    renderTimeline();
    showView('studioView');
    resizeCanvasKeepDrawing();
    toast('สร้างโปรเจกต์สำเร็จ เริ่มวาดได้เลย');
  } catch (err) {
    console.error(err);
    toast('สร้างโปรเจกต์ไม่สำเร็จ: ' + err.message, 'err');
  }
});

function updateProjectInfo() {
  if (!currentProject || !currentStudent) return;
  $('currentProjectTitle').textContent = currentProject.project_name;
  $('currentProjectMeta').textContent = `${currentStudent.student_name} | ห้อง ${currentStudent.room}`;
}

function dataURLToBlob(dataURL) {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const bin = atob(parts[1]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

$('saveFrameBtn').addEventListener('click', saveFrame);

async function saveFrame() {
  if (!currentProject || !currentStudent) return toast('กรุณาสร้างหรือเปิดโปรเจกต์ก่อน', 'warn');
  const frame_number = frames.length + 1;
  const dataUrl = drawCanvas.toDataURL('image/png');
  const blob = dataURLToBlob(dataUrl);
  const filePath = `${currentProject.id}/frame-${String(frame_number).padStart(5, '0')}-${Date.now()}.png`;
  try {
    toast('กำลังบันทึกเฟรม...', 'warn');
    const up = await sb.storage.from(BUCKET_NAME).upload(filePath, blob, { contentType: 'image/png', upsert: true });
    if (up.error) throw up.error;
    const pub = sb.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    const image_url = pub.data.publicUrl;
    const ins = await sb.from('frames').insert({
      project_id: currentProject.id,
      student_id: currentStudent.id,
      frame_number,
      image_url
    }).select().single();
    if (ins.error) throw ins.error;

    frames.push(ins.data);
    await sb.from('projects').update({
      cover_url: frames[0].image_url,
      frame_count: frames.length,
      updated_at: new Date().toISOString()
    }).eq('id', currentProject.id);

    renderTimeline();
    drawOnionSkin();
    toast(`บันทึกเฟรมที่ ${frame_number} แล้ว`);
  } catch (err) {
    console.error(err);
    toast('บันทึกไม่สำเร็จ: ' + err.message, 'err');
  }
}

function renderTimeline() {
  $('frameCountBadge').textContent = `${frames.length} เฟรม | เพิ่มได้ต่อเนื่อง`;
  const tl = $('timeline');
  tl.innerHTML = '';
  if (!frames.length) {
    tl.innerHTML = '<div class="empty">ยังไม่มีเฟรม กด “บันทึกเฟรม” เพื่อเพิ่มเฟรมแรก</div>';
    return;
  }
  frames.forEach((f, i) => {
    const card = document.createElement('div');
    card.className = 'frame-card';
    card.draggable = true;
    card.dataset.index = i;
    card.innerHTML = `
      <div class="frame-no">#${i + 1}</div>
      <img src="${f.image_url}" alt="frame ${i + 1}" loading="lazy">
      <div class="frame-actions">
        <button title="โหลดมาแก้ไข" data-act="load" data-i="${i}">✏️</button>
        <button title="เลื่อนซ้าย" data-act="left" data-i="${i}">◀</button>
        <button title="เลื่อนขวา" data-act="right" data-i="${i}">▶</button>
        <button title="ลบ" data-act="delete" data-i="${i}">🗑</button>
      </div>`;
    tl.appendChild(card);
  });
}

$('timeline').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const i = Number(btn.dataset.i);
  const act = btn.dataset.act;
  if (act === 'load') await loadImageToCanvas(frames[i].image_url);
  if (act === 'left' && i > 0) { [frames[i-1], frames[i]] = [frames[i], frames[i-1]]; await renumberFrames(); }
  if (act === 'right' && i < frames.length - 1) { [frames[i+1], frames[i]] = [frames[i], frames[i+1]]; await renumberFrames(); }
  if (act === 'delete') await deleteFrame(i);
});

async function renumberFrames() {
  renderTimeline();
  // อัปเดตลำดับใน DB แบบง่าย เหมาะกับจำนวนเฟรมระดับห้องเรียน
  for (let i = 0; i < frames.length; i++) {
    frames[i].frame_number = i + 1;
    await sb.from('frames').update({ frame_number: i + 1 }).eq('id', frames[i].id);
  }
  drawOnionSkin();
}

async function deleteFrame(i) {
  if (!confirm(`ลบเฟรมที่ ${i + 1} ใช่ไหม?`)) return;
  const f = frames[i];
  try {
    await sb.from('frames').delete().eq('id', f.id);
    frames.splice(i, 1);
    await renumberFrames();
    await sb.from('projects').update({
      cover_url: frames[0]?.image_url || null,
      frame_count: frames.length,
      updated_at: new Date().toISOString()
    }).eq('id', currentProject.id);
    toast('ลบเฟรมแล้ว');
  } catch (err) {
    toast('ลบไม่สำเร็จ: ' + err.message, 'err');
  }
}

async function loadImageToCanvas(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      saveUndo();
      ctx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
      drawImageContain(ctx, img, 0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });
}

function drawOnionSkin() {
  onionCtx.clearRect(0, 0, onionCanvas.clientWidth, onionCanvas.clientHeight);
  if (!$('onionToggle').checked || !frames.length) return;
  const last = frames[frames.length - 1];
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    onionCtx.clearRect(0, 0, onionCanvas.clientWidth, onionCanvas.clientHeight);
    onionCtx.globalAlpha = 0.28;
    drawImageContain(onionCtx, img, 0, 0, onionCanvas.clientWidth, onionCanvas.clientHeight);
    onionCtx.globalAlpha = 1;
  };
  img.src = last.image_url;
}

async function loadFrames(projectId) {
  const { data, error } = await sb.from('frames').select('*').eq('project_id', projectId).order('frame_number', { ascending: true });
  if (error) throw error;
  frames = data || [];
  renderTimeline();
  drawOnionSkin();
}

async function openProject(projectId) {
  const { data: project, error } = await sb.from('projects').select('*, students(*)').eq('id', projectId).single();
  if (error) return toast('เปิดโปรเจกต์ไม่ได้: ' + error.message, 'err');
  currentProject = project;
  currentStudent = project.students;
  updateProjectInfo();
  await loadFrames(projectId);
  showView('studioView');
  resizeCanvasKeepDrawing();
}

function getProjectCover(p) {
  return p.cover_url || 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="100%" height="100%" fill="#ede9fe"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="24" fill="#6d28d9">No Frame</text></svg>`);
}

function projectCard(p) {
  const cover = getProjectCover(p);
  const s = p.students || {};
  return `<div class="work-card">
    <img src="${cover}" alt="cover" loading="lazy">
    <div><h3>${p.project_name}</h3><p>${s.student_name || '-'} | ห้อง ${s.room || '-'}</p><p>${p.frame_count || 0} เฟรม</p>
    <button class="primary" data-project="${p.id}">เปิดผลงาน</button></div>
  </div>`;
}

// การ์ดหน้า “ดูผลงานของฉัน”: ดูได้ทันที แต่แก้ไขต้องขอรหัสครู
function myProjectCard(p) {
  const cover = getProjectCover(p);
  const s = p.students || {};
  const created = p.created_at ? new Date(p.created_at).toLocaleDateString('th-TH') : '-';
  return `<div class="work-card my-work-card">
    <img src="${cover}" alt="cover" loading="lazy">
    <div>
      <h3>${p.project_name}</h3>
      <p>${s.student_name || '-'} | ห้อง ${s.room || '-'}</p>
      <p>${p.frame_count || 0} เฟรม | ${created}</p>
      <div class="card-actions">
        <button class="primary" data-view-project="${p.id}">▶️ ดูผลงาน</button>
        <button class="secondary" data-edit-project="${p.id}">✏️ แก้ไข</button>
      </div>
    </div>
  </div>`;
}

async function loadGallery(target = 'gallery', filter = null) {
  let q = sb.from('projects').select('*, students(*)').order('created_at', { ascending: false }).limit(200);
  const { data, error } = await q;
  if (error) return toast('โหลดคลังผลงานไม่ได้: ' + error.message, 'err');
  let list = data || [];
  if (filter) list = list.filter(p => p.students?.student_code === filter);
  $(target).innerHTML = list.length ? list.map(projectCard).join('') : '<div class="empty">ไม่พบผลงาน</div>';
  $(target).querySelectorAll('[data-project]').forEach(btn => btn.addEventListener('click', () => openProject(btn.dataset.project)));
}

async function loadMyWorks() {
  const code = $('myStudentCode').value.trim();
  if (!code) return toast('กรอกรหัสนักเรียนก่อนครับ', 'warn');
  const { data, error } = await sb.from('projects').select('*, students(*)').order('created_at', { ascending: false }).limit(300);
  if (error) return toast('โหลดผลงานของฉันไม่ได้: ' + error.message, 'err');
  const list = (data || []).filter(p => p.students?.student_code === code);
  $('myWorks').innerHTML = list.length ? list.map(myProjectCard).join('') : '<div class="empty">ไม่พบผลงานของรหัสนี้</div>';
  $('myWorks').querySelectorAll('[data-view-project]').forEach(btn => btn.addEventListener('click', () => viewProjectOnly(btn.dataset.viewProject)));
  $('myWorks').querySelectorAll('[data-edit-project]').forEach(btn => btn.addEventListener('click', () => requestTeacherPasswordAndEdit(btn.dataset.editProject)));
}

async function viewProjectOnly(projectId) {
  const { data, error } = await sb.from('frames').select('*').eq('project_id', projectId).order('frame_number', { ascending: true });
  if (error) return toast('ดูผลงานไม่ได้: ' + error.message, 'err');
  if (!data || !data.length) return toast('ผลงานนี้ยังไม่มีเฟรม', 'warn');
  frames = data;
  previewIndex = 0;
  $('previewImage').src = frames[0].image_url;
  $('previewDialog').showModal();
}

async function requestTeacherPasswordAndEdit(projectId) {
  const pass = prompt('ต้องขอรหัสจากครูผู้สอนก่อนแก้ไขผลงาน');
  if (pass === null) return;
  if (pass !== '1234') return toast('รหัสครูไม่ถูกต้อง ไม่สามารถแก้ไขได้', 'err');
  await openProject(projectId);
  toast('ปลดล็อกการแก้ไขแล้ว', 'ok');
}

$('refreshGalleryBtn').addEventListener('click', () => loadGallery('gallery'));
$('loadMyWorksBtn').addEventListener('click', loadMyWorks);
$('myStudentCode')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadMyWorks(); });

$('previewBtn').addEventListener('click', () => {
  if (!frames.length) return toast('ยังไม่มีเฟรมให้เล่น', 'warn');
  previewIndex = 0;
  $('previewImage').src = frames[0].image_url;
  $('previewDialog').showModal();
});
function closePreviewDialog() {
  stopPreview();
  try { $('previewDialog').close(); } catch (err) {}
}
$('closePreviewBtn').addEventListener('click', closePreviewDialog);
$('closePreviewBtnBottom')?.addEventListener('click', closePreviewDialog);
$('previewDialog').addEventListener('cancel', (e) => { e.preventDefault(); closePreviewDialog(); });
$('previewDialog').addEventListener('click', (e) => {
  const rect = $('previewDialog').getBoundingClientRect();
  const clickedBackdrop = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
  if (clickedBackdrop) closePreviewDialog();
});
$('playPreviewBtn').addEventListener('click', playPreview);
$('pausePreviewBtn').addEventListener('click', pausePreview);
$('stopPreviewBtn').addEventListener('click', stopPreview);

function playPreview() {
  pausePreview();
  const fps = Number($('fpsSelect').value);
  previewTimer = setInterval(() => {
    if (!frames.length) return;
    $('previewImage').src = frames[previewIndex].image_url;
    previewIndex = (previewIndex + 1) % frames.length;
  }, 1000 / fps);
}
function pausePreview() { if (previewTimer) clearInterval(previewTimer); previewTimer = null; }
function stopPreview() { pausePreview(); previewIndex = 0; if (frames[0]) $('previewImage').src = frames[0].image_url; }


$('exportGifBtn').addEventListener('click', exportGifV7);

async function exportGifV7() {
  if (!frames.length) return toast('ยังไม่มีเฟรมให้ Export', 'warn');
  if (typeof GIF === 'undefined') {
    toast('โหลดตัวสร้าง GIF ไม่สำเร็จ กรุณาเชื่อมอินเทอร์เน็ตแล้วรีเฟรชหน้าเว็บ', 'err');
    return;
  }
  try {
    toast('กำลังเตรียมเฟรมสำหรับ GIF...', 'warn');

    // V7: กำหนดขนาด GIF จากสัดส่วนของเฟรมจริง/Preview ไม่ใช้การยืดเต็มกล่อง
    // ทำให้ GIF ที่ดาวน์โหลดออกมาไม่บิด ไม่ยืด และมีสัดส่วนเหมือนที่เห็นใน Preview
    const firstImg = await loadImageElementSafe(frames[0].image_url);
    const naturalW = firstImg.naturalWidth || firstImg.width || 1280;
    const naturalH = firstImg.naturalHeight || firstImg.height || 720;
    const maxExportSide = 1280; // กันไฟล์ใหญ่เกินไป แต่ยังคมพอสำหรับงานส่งครู
    const exportScale = Math.min(1, maxExportSide / Math.max(naturalW, naturalH));
    const width = Math.max(320, Math.round(naturalW * exportScale));
    const height = Math.max(240, Math.round(naturalH * exportScale));
    const delay = Math.round(1000 / Number($('fpsSelect').value || 5));

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width,
      height,
      // สำคัญ: ใช้ workerScript แบบ local เพื่อแก้ปัญหา cross-origin บน GitHub Pages
      workerScript: 'gif.worker.js'
    });

    for (let i = 0; i < frames.length; i++) {
      toast(`กำลังเตรียมเฟรม ${i + 1}/${frames.length}...`, 'warn');
      const img = i === 0 ? firstImg : await loadImageElementSafe(frames[i].image_url);
      const temp = document.createElement('canvas');
      temp.width = width;
      temp.height = height;
      const tctx = temp.getContext('2d', { willReadFrequently: true });
      tctx.fillStyle = '#fff';
      tctx.fillRect(0, 0, width, height);
      drawImageContain(tctx, img, 0, 0, width, height);
      gif.addFrame(temp, { delay, copy: true });
    }

    gif.on('finished', blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sanitizeFileName(`${currentProject?.project_name || 'stop-motion'}.gif`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('ดาวน์โหลด GIF สำเร็จ');
    });

    gif.on('progress', p => {
      const percent = Math.round(p * 100);
      toast(`กำลังสร้าง GIF ${percent}%`, 'warn');
    });

    gif.render();
  } catch (err) {
    console.error(err);
    toast('Export GIF ไม่สำเร็จ: ' + (err.message || err), 'err');
  }
}

function sanitizeFileName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '-');
}

function loadImageElement(url) {
  return loadImageElementSafe(url);
}

async function loadImageElementSafe(url) {
  // แปลงรูปจาก Supabase เป็น dataURL ก่อน เพื่อลดปัญหา CORS/Canvas tainted ตอน Export GIF
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) throw new Error('โหลดภาพไม่ได้');
    const blob = await res.blob();
    const dataUrl = await blobToDataURL(blob);
    return await loadImageFromSrc(dataUrl);
  } catch (err) {
    // fallback: โหลดตรงแบบ crossOrigin
    return await loadImageFromSrc(url, true);
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('แปลงรูปเป็น dataURL ไม่สำเร็จ'));
    reader.readAsDataURL(blob);
  });
}

function loadImageFromSrc(src, crossOrigin = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('โหลดรูปสำหรับ GIF ไม่สำเร็จ'));
    img.src = src;
  });
}

$('loginAdminBtn').addEventListener('click', async () => {
  if ($('adminPassword').value !== ADMIN_PASSWORD) return toast('รหัสผ่านไม่ถูกต้อง', 'err');
  $('adminLogin').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  await loadAdmin();
});

async function loadAdmin() {
  const { data: projects, error } = await sb.from('projects').select('*, students(*)').order('created_at', { ascending: false }).limit(500);
  if (error) return toast('โหลด Admin ไม่ได้: ' + error.message, 'err');
  adminProjectsCache = projects || [];
  $('statProjects').textContent = adminProjectsCache.length;
  $('statFrames').textContent = adminProjectsCache.reduce((sum, p) => sum + (p.frame_count || 0), 0);
  $('statStudents').textContent = new Set(adminProjectsCache.map(p => p.students?.student_code).filter(Boolean)).size;
  renderAdmin(adminProjectsCache);
}

function renderAdmin(list) {
  $('adminList').innerHTML = list.length ? list.map(projectCard).join('') : '<div class="empty">ไม่มีข้อมูล</div>';
  $('adminList').querySelectorAll('[data-project]').forEach(btn => btn.addEventListener('click', () => openProject(btn.dataset.project)));
}

$('adminSearch').addEventListener('input', () => {
  const q = $('adminSearch').value.trim().toLowerCase();
  const list = adminProjectsCache.filter(p => `${p.project_name} ${p.students?.student_name} ${p.students?.room}`.toLowerCase().includes(q));
  renderAdmin(list);
});

$('downloadCsvBtn').addEventListener('click', () => {
  const rows = [['project_name','student_name','room','frame_count','created_at']];
  adminProjectsCache.forEach(p => rows.push([p.project_name, p.students?.student_name || '', p.students?.room || '', p.frame_count || 0, p.created_at]));
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'stop-motion-projects.csv';
  a.click();
});

// โหลดคลังผลงานครั้งแรก และตั้ง canvas
window.addEventListener('load', () => {
  resizeCanvasKeepDrawing();
  loadGallery('gallery');
});

/* ===============================
   V3 RELIABLE DRAWING HOTFIX
   แก้ปัญหา Canvas เขียนไม่ได้ใน iPad / Tablet / PC
   ใช้ทั้ง Pointer + Touch + Mouse และกัน event ซ้อน
================================ */
(function installReliableDrawingHotfix(){
  if (!drawCanvas || !ctx) return;

  // กัน browser เลื่อนหน้า/ซูม ระหว่างวาด
  drawCanvas.style.touchAction = 'none';
  drawCanvas.style.webkitUserSelect = 'none';
  drawCanvas.style.userSelect = 'none';
  drawCanvas.style.pointerEvents = 'auto';
  drawCanvas.style.zIndex = '2';
  onionCanvas.style.pointerEvents = 'none';
  onionCanvas.style.zIndex = '1';

  // ถอด event เดิมออกก่อน เพื่อไม่ให้เส้นซ้อนหรือพังจาก browser บางตัว
  try {
    drawCanvas.removeEventListener('pointerdown', startDraw);
    drawCanvas.removeEventListener('pointermove', draw);
    drawCanvas.removeEventListener('pointerup', endDraw);
    drawCanvas.removeEventListener('pointercancel', endDraw);
    drawCanvas.removeEventListener('pointerleave', endDraw);
    drawCanvas.removeEventListener('mousedown', startDraw);
    drawCanvas.removeEventListener('mousemove', draw);
    window.removeEventListener('mouseup', endDraw);
  } catch (err) {}

  let drawingNow = false;
  let lastX = 0;
  let lastY = 0;
  let activePointerId = null;
  let lastTouchTime = 0;

  function eventPoint(ev) {
    const rect = drawCanvas.getBoundingClientRect();
    const src = ev.touches && ev.touches.length ? ev.touches[0]
      : ev.changedTouches && ev.changedTouches.length ? ev.changedTouches[0]
      : ev;
    return {
      x: src.clientX - rect.left,
      y: src.clientY - rect.top,
      pressure: ev.pressure && ev.pressure > 0 ? ev.pressure : 1
    };
  }

  function begin(ev) {
    if (ev.cancelable) ev.preventDefault();
    ev.stopPropagation?.();
    if (ev.type.startsWith('touch')) lastTouchTime = Date.now();
    if (ev.pointerId !== undefined) activePointerId = ev.pointerId;

    // บังคับ resize อีกรอบ หาก canvas ยังไม่มีขนาดจริง
    if (drawCanvas.clientWidth < 50 || drawCanvas.clientHeight < 50) {
      resizeCanvasKeepDrawing();
    }

    drawingNow = true;
    const p = eventPoint(ev);
    lastX = p.x;
    lastY = p.y;
    saveUndo();

    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);

    try { drawCanvas.setPointerCapture?.(ev.pointerId); } catch (err) {}

    // แตะจุดเดียวก็ให้เกิดหมึกทันที
    const size = Number($('brushSize')?.value || 8);
    ctx.lineWidth = currentTool === 'eraser' ? size * 1.8 : size;
    ctx.strokeStyle = currentTool === 'eraser' ? '#000' : ($('colorPicker')?.value || '#111827');
    ctx.lineTo(lastX + 0.01, lastY + 0.01);
    ctx.stroke();
  }

  function move(ev) {
    if (!drawingNow) return;
    if (ev.pointerId !== undefined && activePointerId !== null && ev.pointerId !== activePointerId) return;
    if (ev.cancelable) ev.preventDefault();
    ev.stopPropagation?.();

    const p = eventPoint(ev);
    const size = Number($('brushSize')?.value || 8);
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = currentTool === 'eraser' ? '#000' : ($('colorPicker')?.value || '#111827');
    ctx.lineWidth = currentTool === 'eraser' ? size * 1.8 : Math.max(1, size * p.pressure);

    const midX = (lastX + p.x) / 2;
    const midY = (lastY + p.y) / 2;
    ctx.quadraticCurveTo(lastX, lastY, midX, midY);
    ctx.stroke();
    lastX = p.x;
    lastY = p.y;
  }

  function finish(ev) {
    if (!drawingNow) return;
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    drawingNow = false;
    activePointerId = null;
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over';
  }

  // Pointer Events: ใช้กับ PC, Chrome, Edge, Safari iPad รุ่นใหม่
  drawCanvas.addEventListener('pointerdown', begin, { passive:false });
  drawCanvas.addEventListener('pointermove', move, { passive:false });
  drawCanvas.addEventListener('pointerup', finish, { passive:false });
  drawCanvas.addEventListener('pointercancel', finish, { passive:false });
  drawCanvas.addEventListener('pointerleave', finish, { passive:false });

  // Touch Events: สำรองสำหรับ iPad/Safari บางรุ่น
  drawCanvas.addEventListener('touchstart', begin, { passive:false });
  drawCanvas.addEventListener('touchmove', move, { passive:false });
  drawCanvas.addEventListener('touchend', finish, { passive:false });
  drawCanvas.addEventListener('touchcancel', finish, { passive:false });

  // Mouse Events: สำรองสำหรับคอมพิวเตอร์
  drawCanvas.addEventListener('mousedown', function(ev){
    if (Date.now() - lastTouchTime < 700) return;
    begin(ev);
  }, { passive:false });
  window.addEventListener('mousemove', function(ev){
    if (Date.now() - lastTouchTime < 700) return;
    move(ev);
  }, { passive:false });
  window.addEventListener('mouseup', finish, { passive:false });

  // เรียก resize หลังโหลดหน้า เพื่อให้ Canvas มีขนาดจริง
  setTimeout(resizeCanvasKeepDrawing, 300);
})();

const $ = (s) => document.querySelector(s);
const fileInput = $('#file');
const bgFile = $('#bgFile');
const drop = $('#drop');
const replace = $('#replace');
const canvas = $('#canvas');
const empty = $('#empty');
const generate = $('#generate');
const download = $('#download');
const statusLine = $('#statusLine');
const statusText = $('#status');
const progress = $('#progress');
const progressText = $('#progressText');
const progressPercent = $('#progressPercent');
const progressBar = $('#progressBar');
const templates = $('#templates');
const swatches = $('#swatches');
const subjectMode = $('#subjectMode');
const scale = $('#scale');
const rotate = $('#rotate');
const scaleValue = $('#scaleValue');
const rotateValue = $('#rotateValue');
const shadow = $('#shadow');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const BACKGROUNDS = [
  ['炭灰岩面', './assets/backgrounds/final-premium/charcoal-slate.jpg'],
  ['暖灰洞石', './assets/backgrounds/final-premium/warm-travertine.jpg'],
  ['旧化香槟金属', './assets/backgrounds/final-premium/aged-champagne-metal.jpg'],
  ['绿灰微水泥', './assets/backgrounds/final-premium/sage-microcement.jpg'],
  ['象牙石材', './assets/backgrounds/final-premium/ivory-stone.jpg'],
  ['烟熏黑石', './assets/backgrounds/final-premium/smoky-black-stone.jpg'],
];

let sourceFile = null;
let sourceUrl = '';
let sourceImage = null;
let subjectImage = null;
let bgImage = null;
let bgColor = '#ffffff';
let mode = 'professional';
let useShadow = true;
let pos = { x: 0, y: 120 };
let drag = null;
let processId = 0;

function setStatus(text, error = false) {
  statusText.textContent = text;
  statusLine.classList.toggle('error', error);
}

function setProgress(text, pct, error = false) {
  progress.classList.add('show');
  progress.classList.toggle('error', error);
  progressText.textContent = text;
  progressPercent.textContent = `${pct}%`;
  progressBar.style.width = `${pct}%`;
}

function resetResult() {
  subjectImage = null;
  canvas.hidden = true;
  empty.hidden = false;
  download.classList.add('disabled');
  download.setAttribute('aria-disabled', 'true');
  download.removeAttribute('href');
  generate.disabled = true;
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

function cover(img, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const nw = img.width * s;
  const nh = img.height * s;
  return [(w - nw) / 2, (h - nh) / 2, nw, nh];
}

function contain(img, w, h, ratio) {
  const s = Math.min((w * ratio) / img.width, (h * ratio) / img.height);
  return [img.width * s, img.height * s];
}

function findVisibleBounds(img) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d', { willReadFrequently: true });
  c.width = img.width;
  c.height = img.height;
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < c.height; y++) {
    for (let xx = 0; xx < c.width; xx++) {
      const a = data[(y * c.width + xx) * 4 + 3];
      if (a > 24) {
        count++;
        if (xx < minX) minX = xx;
        if (xx > maxX) maxX = xx;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!count) return null;
  return { minX, minY, maxX, maxY, count, ratio: count / (c.width * c.height) };
}

function trimTransparent(img) {
  const b = findVisibleBounds(img);
  if (!b) throw new Error('没有识别到透明商品主体');
  const pad = 18;
  const sx = Math.max(0, b.minX - pad);
  const sy = Math.max(0, b.minY - pad);
  const sw = Math.min(img.width - sx, b.maxX - b.minX + 1 + pad * 2);
  const sh = Math.min(img.height - sy, b.maxY - b.minY + 1 + pad * 2);
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return loadImg(c.toDataURL('image/png'));
}

async function professionalCutout(file) {
  const form = new FormData();
  form.append('image_file', file);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let res;
  try {
    res = await fetch('/api/remove-bg', { method: 'POST', body: form, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let msg = `remove.bg 处理失败（${res.status}）`;
    try {
      const json = await res.json();
      msg = json.error || json.message || msg;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  if (!blob.type.includes('png')) throw new Error('remove.bg 没有返回透明 PNG');
  return URL.createObjectURL(blob);
}

function draw(final = false) {
  if (!sourceImage || !subjectImage) {
    canvas.hidden = true;
    empty.hidden = false;
    return;
  }
  canvas.width = 1000;
  canvas.height = 1000;
  ctx.clearRect(0, 0, 1000, 1000);
  if (bgImage) {
    ctx.drawImage(bgImage, ...cover(bgImage, 1000, 1000));
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 1000, 1000);
  }
  const sc = Number(scale.value) / 100;
  const deg = Number(rotate.value) * Math.PI / 180;
  const [iw, ih] = contain(subjectImage, 1000, 1000, 0.54 * sc);
  const cx = 500 + pos.x;
  const cy = 610 + pos.y;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(deg);
  if (useShadow) {
    ctx.shadowColor = 'rgba(0,0,0,.24)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 22;
  }
  ctx.drawImage(subjectImage, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();
  canvas.hidden = false;
  empty.hidden = true;
  if (final) {
    const url = canvas.toDataURL('image/jpeg', 0.94);
    download.href = url;
    download.download = 'baijing-background.jpg';
    download.classList.remove('disabled');
    download.setAttribute('aria-disabled', 'false');
  }
}

async function processSubject() {
  const token = ++processId;
  resetResult();
  if (!sourceFile || !sourceImage) return;
  setStatus(mode === 'professional' ? '正在调用专业抠图，请稍等' : '保留原图模式，可以直接合成');
  setProgress(mode === 'professional' ? '正在专业抠图' : '准备完成', mode === 'professional' ? 18 : 60);
  try {
    let img = sourceImage;
    if (mode === 'professional') {
      const cutUrl = await professionalCutout(sourceFile);
      if (token !== processId) return;
      img = await loadImg(cutUrl);
      const bounds = findVisibleBounds(img);
      if (!bounds || bounds.count < 80) throw new Error('没有识别到商品主体');
      if (bounds.ratio > 0.86) throw new Error('专业抠图没有得到透明主体，不能合成');
      img = await trimTransparent(img);
    }
    if (token !== processId) return;
    subjectImage = img;
    generate.disabled = false;
    setProgress('主体处理完成，可以合成', 70);
    setStatus(mode === 'professional' ? '专业抠图完成，可以开始合成' : '保留原图模式，可以开始合成');
    draw();
  } catch (err) {
    if (token !== processId) return;
    resetResult();
    setProgress('主体处理失败，不能合成', 0, true);
    setStatus(`处理失败：${err.message}`, true);
  }
}

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  sourceFile = file;
  sourceUrl = URL.createObjectURL(file);
  sourceImage = await loadImg(sourceUrl);
  pos = { x: 0, y: 120 };
  drop.className = 'drop has-image';
  drop.innerHTML = `<img src="${sourceUrl}" alt="已上传商品图">`;
  replace.hidden = false;
  await processSubject();
}

async function selectBackground(src, btn) {
  [...templates.children].forEach((b) => b.classList.remove('selected'));
  btn.classList.add('selected');
  bgImage = await loadImg(src);
  bgColor = null;
  draw();
}

function renderTemplates() {
  templates.innerHTML = '';
  BACKGROUNDS.forEach(([label, src], i) => {
    const btn = document.createElement('button');
    btn.className = `template${i === 0 ? ' selected' : ''}`;
    btn.type = 'button';
    btn.style.backgroundImage = `url("${src}")`;
    btn.innerHTML = `<span>${label}</span>`;
    btn.onclick = () => selectBackground(src, btn);
    templates.appendChild(btn);
  });
  loadImg(BACKGROUNDS[0][1]).then((img) => { bgImage = img; draw(); }).catch(() => setStatus('背景图加载失败，请刷新后重试', true));
}

fileInput.onchange = (e) => loadFile(e.target.files[0]);
drop.onclick = () => fileInput.click();
replace.onclick = () => fileInput.click();
drop.ondragover = (e) => e.preventDefault();
drop.ondrop = (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); };
subjectMode.onclick = (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  [...subjectMode.children].forEach((b) => b.classList.remove('selected'));
  btn.classList.add('selected');
  mode = btn.dataset.value;
  processSubject();
};
swatches.onclick = (e) => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  [...swatches.children].forEach((b) => b.classList.remove('selected'));
  btn.classList.add('selected');
  [...templates.children].forEach((b) => b.classList.remove('selected'));
  bgColor = btn.dataset.color;
  bgImage = null;
  draw();
};
scale.oninput = () => { scaleValue.textContent = `${scale.value}%`; draw(); };
rotate.oninput = () => { rotateValue.textContent = `${rotate.value}°`; draw(); };
shadow.onclick = () => { useShadow = !useShadow; shadow.classList.toggle('on', useShadow); draw(); };
generate.onclick = () => {
  if (!sourceFile) return fileInput.click();
  if (!subjectImage) {
    setProgress('主体没处理成功，不能合成', 0, true);
    setStatus('没有透明商品主体，已停止合成', true);
    return;
  }
  draw(true);
  setProgress('合成完成', 100);
  setStatus('合成完成，可以下载');
};
download.onclick = (e) => {
  if (download.classList.contains('disabled')) e.preventDefault();
};
canvas.onpointerdown = (e) => {
  drag = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const k = 1000 / rect.width;
  pos.x = drag.px + (e.clientX - drag.x) * k;
  pos.y = drag.py + (e.clientY - drag.y) * k;
  draw();
};
canvas.onpointerup = () => { drag = null; };
bgFile.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  bgImage = await loadImg(URL.createObjectURL(file));
  bgColor = null;
  draw();
};

renderTemplates();
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = {
  file: null,
  sourceUrl: '',
  subjectUrl: '',
  backgroundUrl: './assets/backgrounds/luxury-02-charcoal-marble.png',
  bgColor: '#ffffff',
  mode: 'professional',
  scale: 90,
  rotation: 0,
  shadow: true,
  busy: false,
  job: 0,
  resultUrl: '',
};

const els = {
  drop: $('#drop'), file: $('#file'), replace: $('#replace'), canvas: $('#canvas'), empty: $('#empty'),
  status: $('#status'), statusLine: $('#statusLine'), progress: $('#progress'), progressText: $('#progressText'),
  progressPercent: $('#progressPercent'), progressBar: $('#progressBar'), download: $('#download'), generate: $('#generate'),
  scale: $('#scale'), rotate: $('#rotate'), scaleValue: $('#scaleValue'), rotateValue: $('#rotateValue'), shadow: $('#shadow'),
  bgFile: $('#bgFile'), modeTitle: $('#modeTitle'), modeNote: $('#modeNote')
};

function setStatus(text, error = false) {
  els.status.textContent = text;
  els.statusLine.classList.toggle('error', error);
  els.progress.classList.toggle('error', error);
}

function setProgress(percent, text) {
  els.progress.classList.add('show');
  els.progressBar.style.width = `${percent}%`;
  els.progressPercent.textContent = `${percent}%`;
  els.progressText.textContent = text;
}

function resetResult(message = '图片已就绪，点击开始合成') {
  state.resultUrl = '';
  state.subjectUrl = '';
  els.canvas.hidden = true;
  els.empty.hidden = false;
  els.download.classList.add('disabled');
  els.download.setAttribute('aria-disabled', 'true');
  els.download.removeAttribute('href');
  setProgress(0, '等待处理');
  els.progress.classList.remove('show', 'error');
  setStatus(message, false);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片素材加载失败，请刷新后重试'));
    img.src = src;
  });
}

function findVisibleBounds(img) {
  const c = document.createElement('canvas');
  const max = 900;
  const ratio = Math.min(1, max / Math.max(img.width, img.height));
  c.width = Math.max(1, Math.round(img.width * ratio));
  c.height = Math.max(1, Math.round(img.height * ratio));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0, visible = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const a = data[(y * c.width + x) * 4 + 3];
      if (a > 18) { visible++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    }
  }
  const ratioVisible = visible / (c.width * c.height);
  if (!visible || ratioVisible > 0.92) return null;
  return { sx: minX / ratio, sy: minY / ratio, sw: (maxX - minX + 1) / ratio, sh: (maxY - minY + 1) / ratio };
}

async function professionalCutout(token) {
  if (!state.file) throw new Error('还没有上传商品图片');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const form = new FormData();
    form.append('image_file', state.file);
    form.append('size', 'auto');
    form.append('format', 'png');
    const res = await fetch('/api/remove-bg', { method: 'POST', body: form, signal: controller.signal });
    if (token !== state.job) throw new Error('本次处理已取消');
    if (!res.ok) {
      let msg = '';
      try { const json = await res.json(); msg = json.error || json.detail || ''; } catch { msg = await res.text(); }
      throw new Error(msg || `remove.bg 处理失败（${res.status}）`);
    }
    const blob = await res.blob();
    if (!blob.type.includes('image')) throw new Error('remove.bg 没有返回图片结果');
    const url = URL.createObjectURL(blob);
    const img = await loadImage(url);
    if (!findVisibleBounds(img)) { URL.revokeObjectURL(url); throw new Error('专业抠图没有得到透明主体，不能合成'); }
    return url;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('remove.bg 响应超时，请稍后重试');
    throw e;
  } finally { clearTimeout(timer); }
}

async function compose(productUrl, strictTransparent) {
  const [product, scene] = await Promise.all([loadImage(productUrl), loadImage(state.backgroundUrl)]);
  const bounds = strictTransparent ? findVisibleBounds(product) : null;
  if (strictTransparent && !bounds) throw new Error('主体没有抠出来，已停止合成');
  const size = 1000;
  const c = els.canvas;
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持图片合成');
  ctx.fillStyle = state.bgColor; ctx.fillRect(0, 0, size, size);
  ctx.drawImage(scene, 0, 0, size, size);
  const box = bounds || { sx: 0, sy: 0, sw: product.width, sh: product.height };
  const factor = Math.min((size * 0.50 * state.scale / 100) / box.sw, (size * 0.35 * state.scale / 100) / box.sh);
  const w = box.sw * factor, h = box.sh * factor;
  ctx.save();
  ctx.translate(size / 2, size * 0.64);
  ctx.rotate(state.rotation * Math.PI / 180);
  if (state.shadow) {
    ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#111'; ctx.filter = `blur(${Math.max(12, size * 0.018)}px)`;
    ctx.beginPath(); ctx.ellipse(0, h * 0.48, w * 0.42, Math.max(10, h * 0.10), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.drawImage(product, box.sx, box.sy, box.sw, box.sh, -w / 2, -h / 2, w, h);
  ctx.restore();
  const output = c.toDataURL('image/jpeg', 0.94);
  state.resultUrl = output;
  els.download.href = output;
  els.download.classList.remove('disabled');
  els.download.setAttribute('aria-disabled', 'false');
  els.canvas.hidden = false;
  els.empty.hidden = true;
}

async function processImage() {
  if (!state.file) { els.file.click(); return; }
  const token = ++state.job;
  state.busy = true;
  els.generate.disabled = true;
  resetResult('开始处理：先抠图，成功后才合成');
  try {
    let productUrl = state.sourceUrl;
    let strict = false;
    if (state.mode === 'professional') {
      setProgress(20, '正在调用 remove.bg 专业抠图');
      productUrl = await professionalCutout(token);
      strict = true;
      setProgress(65, '主体已抠出，正在合成背景');
    } else {
      setProgress(35, '保留原图模式：不做抠图');
    }
    if (token !== state.job) return;
    await compose(productUrl, strict);
    if (token !== state.job) return;
    setProgress(100, '合成完成');
    setStatus('合成完成，可以下载', false);
  } catch (e) {
    if (token === state.job) {
      els.canvas.hidden = true; els.empty.hidden = false;
      els.download.classList.add('disabled'); els.download.removeAttribute('href');
      setProgress(0, '主体抠图失败，不能合成');
      els.progress.classList.add('show', 'error');
      setStatus(e.message || '处理失败，请换一张主体更清晰的图片', true);
    }
  } finally {
    if (token === state.job) { state.busy = false; els.generate.disabled = !state.file; }
  }
}

function useFile(file) {
  if (!file || !file.type.startsWith('image/')) { setStatus('请选择 JPG、PNG 或 WebP 图片', true); return; }
  if (file.size > 20 * 1024 * 1024) { setStatus('图片不能超过 20MB', true); return; }
  state.job++;
  state.file = file;
  state.sourceUrl = URL.createObjectURL(file);
  els.drop.classList.add('has-image');
  els.drop.innerHTML = `<img src="${state.sourceUrl}" alt="已上传的商品图">`;
  els.replace.hidden = false;
  els.generate.disabled = false;
  resetResult('图片已就绪，点击开始合成');
}

els.drop.addEventListener('click', () => els.file.click());
els.replace.addEventListener('click', () => els.file.click());
els.file.addEventListener('change', e => { useFile(e.target.files[0]); e.target.value = ''; });
els.drop.addEventListener('dragover', e => e.preventDefault());
els.drop.addEventListener('drop', e => { e.preventDefault(); useFile(e.dataTransfer.files[0]); });
els.generate.addEventListener('click', processImage);

$$('#subjectMode button').forEach(btn => btn.addEventListener('click', () => {
  state.mode = btn.dataset.value;
  $$('#subjectMode button').forEach(b => b.classList.toggle('selected', b === btn));
  els.modeTitle.textContent = state.mode === 'professional' ? 'remove.bg 专业服务' : '保留原图';
  els.modeNote.textContent = state.mode === 'professional' ? '服务器端调用 remove.bg，拿到透明主体后才合成。' : '不抠图，只把原图放到背景上，适合透明 PNG。';
  if (state.file) resetResult('处理方式已切换，请重新开始合成');
}));

$$('#templates .template').forEach(btn => btn.addEventListener('click', () => {
  state.backgroundUrl = btn.dataset.background;
  $$('#templates .template').forEach(b => b.classList.toggle('selected', b === btn));
  if (state.file) resetResult('背景已切换，请重新开始合成');
}));

$$('#swatches .swatch').forEach(btn => btn.addEventListener('click', () => {
  state.bgColor = btn.dataset.color;
  $$('#swatches .swatch').forEach(b => b.classList.toggle('selected', b === btn));
  if (state.file) resetResult('背景颜色已切换，请重新开始合成');
}));

els.scale.addEventListener('input', e => { state.scale = Number(e.target.value); els.scaleValue.textContent = `${state.scale}%`; if (state.file) resetResult('商品大小已调整，请重新开始合成'); });
els.rotate.addEventListener('input', e => { state.rotation = Number(e.target.value); els.rotateValue.textContent = `${state.rotation}°`; if (state.file) resetResult('旋转角度已调整，请重新开始合成'); });
els.shadow.addEventListener('click', () => { state.shadow = !state.shadow; els.shadow.classList.toggle('on', state.shadow); if (state.file) resetResult('投影已调整，请重新开始合成'); });
els.bgFile.addEventListener('change', e => { const f = e.target.files[0]; if (f) { state.backgroundUrl = URL.createObjectURL(f); $$('#templates .template').forEach(b => b.classList.remove('selected')); if (state.file) resetResult('自定义背景已上传，请重新开始合成'); } e.target.value = ''; });
els.download.addEventListener('click', e => { if (!state.resultUrl) { e.preventDefault(); return; } els.download.download = 'jewelry-background-real-1000.jpg'; });

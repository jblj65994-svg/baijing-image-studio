const $ = (s) => document.querySelector(s);
const fileInput = $('#file');
const bgFile = $('#bgFile');
const drop = $('#drop');
const replace = $('#replace');
const canvas = $('#canvas');
const empty = $('#empty');
const generate = $('#generate');
const download = $('#download');
const status = $('#status');
const progress = $('#progress');
const progressText = $('#progressText');
const progressPercent = $('#progressPercent');
const progressBar = $('#progressBar');
const ctx = canvas.getContext('2d');

let sourceImage = null;
let sourceUrl = '';
let subjectImage = null;
let bgImage = null;
let resultUrl = '';
let mode = 'local';
let template = 'darkGraphitePhoto';
let scale = 1;
let rotation = 0;
let hasShadow = true;
let offsetX = 0;
let offsetY = 0;
let dragging = false;

const templates = [
  ['darkGraphitePhoto', '暗灰岩面', 'linear-gradient(180deg,#657069 0 42%,#232827 43% 100%)'],
  ['warmLimestonePhoto', '暖灰石灰岩', 'linear-gradient(180deg,#ddd3c0 0 42%,#8e846f 43% 100%)'],
  ['champagneTravertinePhoto', '香槟洞石', 'linear-gradient(180deg,#edd0a3 0 42%,#a97843 43% 100%)'],
  ['smokedSlatePhoto', '烟熏板岩', 'linear-gradient(180deg,#58635f 0 42%,#111716 43% 100%)'],
  ['greenGrayPhoto', '绿灰石面', 'linear-gradient(180deg,#91a397 0 42%,#30443b 43% 100%)'],
  ['ivoryMarblePhoto', '象牙大理石', 'linear-gradient(180deg,#f7f2e8 0 42%,#bdb4a4 43% 100%)'],
];

function noise(x, y, seed) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function progressTo(value, text) {
  progress.classList.add('show');
  progress.classList.remove('error');
  progressText.textContent = text;
  progressPercent.textContent = `${value}%`;
  progressBar.style.width = `${value}%`;
}

function resetDownload() {
  download.classList.add('disabled');
  download.setAttribute('aria-disabled', 'true');
  download.removeAttribute('href');
  download.removeAttribute('download');
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = '';
}

function imageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败'));
    image.src = url;
  });
}

function drawLowAngleBackdrop(top, mid, floor, seed, contrast = 1) {
  const horizon = Math.floor(canvas.height * 0.42);
  let gradient = ctx.createLinearGradient(0, 0, 0, horizon);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, mid);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, horizon);

  gradient = ctx.createLinearGradient(0, horizon, canvas.width, canvas.height);
  gradient.addColorStop(0, mid);
  gradient.addColorStop(1, floor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

  for (let i = 0; i < 780; i += 1) {
    const x = noise(i, 1, seed) * canvas.width;
    const y = noise(i, 2, seed) * canvas.height;
    const alpha = (0.015 + noise(i, 3, seed) * 0.075) * (y < horizon ? 0.36 : 1) * contrast;
    const rx = (1 + noise(i, 4, seed) * 8) * (y < horizon ? 2.2 : 1);
    const ry = 0.5 + noise(i, 5, seed) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((noise(i, 6, seed) - 0.5) * 0.8);
    ctx.fillStyle = noise(i, 7, seed) > 0.48 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let i = 0; i < 140; i += 1) {
    const x = -80 + noise(i, 11, seed) * (canvas.width + 160);
    const y = horizon + noise(i, 12, seed) * (canvas.height - horizon);
    const length = 35 + noise(i, 13, seed) * 220;
    const angle = (noise(i, 14, seed) - 0.5) * 0.22;
    const alpha = 0.035 + noise(i, 15, seed) * 0.08;
    ctx.strokeStyle = noise(i, 16, seed) > 0.45 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 0.7 + noise(i, 17, seed) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  let seam = ctx.createLinearGradient(0, horizon - 18, 0, horizon + 90);
  seam.addColorStop(0, 'rgba(255,255,255,0)');
  seam.addColorStop(0.48, 'rgba(0,0,0,.18)');
  seam.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = seam;
  ctx.fillRect(0, horizon - 18, canvas.width, 108);

  const spotlight = ctx.createRadialGradient(canvas.width * 0.52, canvas.height * 0.66, 10, canvas.width * 0.52, canvas.height * 0.66, canvas.width * 0.42);
  spotlight.addColorStop(0, 'rgba(255,255,255,.16)');
  spotlight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const vignette = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.56, canvas.width * 0.26, canvas.width * 0.5, canvas.height * 0.56, canvas.width * 0.78);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.2)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTemplate() {
  if (bgImage && bgImage.complete && bgImage.naturalWidth) {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    return;
  }
  if (template === 'darkGraphitePhoto') drawLowAngleBackdrop('#717a73', '#454b47', '#222725', 31, 1.15);
  else if (template === 'warmLimestonePhoto') drawLowAngleBackdrop('#e7ddca', '#b6ab98', '#817766', 32, 0.88);
  else if (template === 'champagneTravertinePhoto') drawLowAngleBackdrop('#f0d2a6', '#c69a61', '#8d6437', 33, 0.9);
  else if (template === 'smokedSlatePhoto') drawLowAngleBackdrop('#56615d', '#303836', '#101413', 34, 1.2);
  else if (template === 'greenGrayPhoto') drawLowAngleBackdrop('#9cad9f', '#657d70', '#2e4239', 35, 0.95);
  else if (template === 'ivoryMarblePhoto') drawLowAngleBackdrop('#faf5ea', '#ded6c7', '#bbb2a3', 36, 0.72);
  else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function render() {
  if (!subjectImage) return;
  canvas.hidden = false;
  empty.hidden = true;
  canvas.width = 1000;
  canvas.height = 1000;
  drawTemplate();

  const sw = subjectImage.naturalWidth || subjectImage.width;
  const sh = subjectImage.naturalHeight || subjectImage.height;
  const base = canvas.width * 0.58 * scale;
  const ratio = sh / sw;
  const dw = ratio > 1 ? base / ratio : base;
  const dh = ratio > 1 ? base : base * ratio;
  const cx = canvas.width / 2 + offsetX;
  const cy = canvas.height / 2 + offsetY;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation * Math.PI / 180);
  if (hasShadow) {
    ctx.shadowColor = 'rgba(15,25,20,.26)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 18;
  }
  ctx.drawImage(subjectImage, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

async function prepare(file) {
  if (!file || !file.type.startsWith('image/')) {
    status.textContent = '请选择 JPG、PNG 或 WEBP 图片';
    return;
  }
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  sourceImage = await imageFromUrl(sourceUrl);
  subjectImage = sourceImage;
  drop.className = 'drop has-image';
  drop.innerHTML = `<img src="${sourceUrl}" alt="已上传商品图">`;
  replace.hidden = false;
  generate.disabled = false;
  resetDownload();
  progress.classList.remove('show', 'error');
  status.textContent = '图片已就绪，可开始合成';
  render();
}

async function professionalCutout() {
  const blob = await fetch(sourceUrl).then((r) => r.blob());
  const response = await fetch('/api/remove-bg', {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  if (!response.ok) throw new Error('专业抠图失败');
  const cutoutBlob = await response.blob();
  const url = URL.createObjectURL(cutoutBlob);
  try {
    return await imageFromUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compose() {
  if (!sourceImage) {
    fileInput.click();
    return;
  }
  generate.disabled = true;
  resetDownload();
  progressTo(20, '正在准备商品主体');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (mode === 'professional') {
    progressTo(55, '正在连接专业抠图');
    try {
      subjectImage = await professionalCutout();
      status.textContent = '专业抠图完成，已生成轻奢背景效果';
    } catch (error) {
      subjectImage = sourceImage;
      status.textContent = '专业抠图暂时不可用，已保留原图合成';
    }
  } else {
    subjectImage = sourceImage;
    status.textContent = mode === 'local' ? '本地模式已保留原图合成，适合实拍质感背景预览' : '已保留原图合成';
  }
  progressTo(78, '正在生成实拍风格背景');
  render();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  progressTo(92, '正在生成下载文件');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  resultUrl = URL.createObjectURL(blob);
  download.href = resultUrl;
  download.download = 'jewelry-background-composite.png';
  download.classList.remove('disabled');
  download.setAttribute('aria-disabled', 'false');
  progressTo(100, '合成完成');
  generate.disabled = false;
}

$('#templates').innerHTML = templates.map(([value, label, css], index) => (
  `<button class="template asset${index === 0 ? ' selected' : ''}" data-template="${value}" type="button" style="background:${css}"><span>${label}</span></button>`
)).join('');

drop.addEventListener('click', () => fileInput.click());
replace.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => prepare(event.target.files[0]).catch((error) => status.textContent = error.message));
drop.addEventListener('dragover', (event) => event.preventDefault());
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  prepare(event.dataTransfer.files[0]).catch((error) => status.textContent = error.message);
});

$('#subjectMode').addEventListener('click', (event) => {
  if (event.target.tagName !== 'BUTTON') return;
  mode = event.target.dataset.value;
  $('#subjectMode').querySelectorAll('button').forEach((button) => button.classList.toggle('selected', button === event.target));
  subjectImage = sourceImage || subjectImage;
  render();
});

$('#templates').addEventListener('click', (event) => {
  const button = event.target.closest('.template');
  if (!button) return;
  template = button.dataset.template || template;
  bgImage = null;
  $('#templates').querySelectorAll('.template').forEach((item) => item.classList.toggle('selected', item === button));
  render();
});

bgFile.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  bgImage = await imageFromUrl(url);
  $('#templates').querySelectorAll('.template').forEach((item) => item.classList.remove('selected'));
  render();
});

$('#scale').addEventListener('input', (event) => {
  scale = Number(event.target.value) / 100;
  $('#scaleValue').textContent = `${event.target.value}%`;
  render();
});

$('#rotate').addEventListener('input', (event) => {
  rotation = Number(event.target.value);
  $('#rotateValue').textContent = `${rotation}°`;
  render();
});

$('#shadow').addEventListener('click', (event) => {
  hasShadow = !hasShadow;
  event.currentTarget.classList.toggle('on', hasShadow);
  render();
});

generate.addEventListener('click', () => compose().catch((error) => {
  generate.disabled = false;
  status.textContent = error.message || '合成失败，请重试';
  progress.classList.add('show', 'error');
  progressText.textContent = '处理失败';
  progressPercent.textContent = '0%';
  progressBar.style.width = '0%';
}));

download.addEventListener('click', (event) => {
  if (download.classList.contains('disabled') || !resultUrl) event.preventDefault();
});

canvas.addEventListener('pointerdown', (event) => {
  if (!subjectImage) return;
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
  canvas._dragStart = [event.clientX, event.clientY, offsetX, offsetY];
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const [sx, sy, ox, oy] = canvas._dragStart;
  offsetX = ox + (event.clientX - sx) * canvas.width / canvas.getBoundingClientRect().width;
  offsetY = oy + (event.clientY - sy) * canvas.height / canvas.getBoundingClientRect().height;
  render();
});
canvas.addEventListener('pointerup', () => dragging = false);

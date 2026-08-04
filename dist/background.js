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
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let sourceImage = null;
let sourceUrl = '';
let subjectImage = null;
let resultUrl = '';
let mode = 'local';
let template = 'charcoalSlate';
let scale = 1;
let rotation = 0;
let hasShadow = true;
let offsetX = 0;
let offsetY = 0;
let dragging = false;

const templates = [
  { value: 'charcoalSlate', label: '炭灰岩面', colors: ['#7b817b', '#4d5652', '#202724'], seed: 12, grain: 1.22 },
  { value: 'warmTravertine', label: '暖灰洞石', colors: ['#efe6d5', '#c7b9a2', '#877966'], seed: 19, grain: 0.82 },
  { value: 'champagneMetal', label: '香槟金属', colors: ['#f1d3a0', '#c89753', '#8a5f32'], seed: 27, grain: 0.76 },
  { value: 'smokyBasalt', label: '烟熏玄武岩', colors: ['#6d7773', '#333c39', '#0d1412'], seed: 34, grain: 1.35 },
  { value: 'sageConcrete', label: '绿灰微水泥', colors: ['#a8b9ad', '#6f8778', '#2d4438'], seed: 41, grain: 0.92 },
  { value: 'ivoryMarble', label: '象牙大理石', colors: ['#fbf6ec', '#ddd3c3', '#a99e8c'], seed: 53, grain: 0.66 },
];

function rand(x, y, seed) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 39.425) * 43758.5453;
  return n - Math.floor(n);
}

function hexToRgb(hex) {
  const raw = hex.replace('#', '');
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function mix(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function progressTo(value, text) {
  progress.classList.add('show');
  progress.classList.remove('error');
  progressText.textContent = text;
  progressPercent.textContent = `${value}%`;
  progressBar.style.width = `${value}%`;
}

function setStatus(text, error = false) {
  status.textContent = text;
  status.parentElement?.classList.toggle('error', error);
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
    image.onerror = () => reject(new Error('图片读取失败，请重新选择图片'));
    image.src = url;
  });
}

function drawLuxurySurface(targetCtx, width, height, preset) {
  const [topHex, midHex, floorHex] = preset.colors;
  const top = hexToRgb(topHex);
  const mid = hexToRgb(midHex);
  const floor = hexToRgb(floorHex);
  const horizon = Math.floor(height * 0.44);
  const img = targetCtx.createImageData(width, height);
  const data = img.data;

  for (let y = 0; y < height; y += 1) {
    const floorPart = Math.max(0, (y - horizon) / (height - horizon));
    const backPart = Math.min(1, y / horizon);
    const base = y < horizon ? mix(top, mid, backPart) : mix(mid, floor, floorPart);
    for (let x = 0; x < width; x += 1) {
      const coarse = rand(Math.floor(x / 22), Math.floor(y / 14), preset.seed);
      const fine = rand(x, y, preset.seed + 7);
      const fiber = Math.sin((x * 0.045) + (y * 0.018) + preset.seed) * 0.5 + 0.5;
      const scrape = rand(Math.floor((x + y * 0.35) / 72), Math.floor(y / 19), preset.seed + 21);
      const strength = (fine - 0.5) * 36 * preset.grain + (coarse - 0.5) * 42 * preset.grain + (fiber - 0.5) * 18;
      const scratch = scrape > 0.78 && y > horizon * 0.7 ? (scrape - 0.78) * 95 : 0;
      const idx = (y * width + x) * 4;
      data[idx] = Math.max(0, Math.min(255, base.r + strength + scratch));
      data[idx + 1] = Math.max(0, Math.min(255, base.g + strength + scratch));
      data[idx + 2] = Math.max(0, Math.min(255, base.b + strength + scratch));
      data[idx + 3] = 255;
    }
  }

  targetCtx.putImageData(img, 0, 0);

  for (let i = 0; i < 170; i += 1) {
    const x = -width * 0.1 + rand(i, 1, preset.seed) * width * 1.2;
    const y = horizon * 0.55 + rand(i, 2, preset.seed) * height * 0.58;
    const length = 40 + rand(i, 3, preset.seed) * 260;
    const angle = (rand(i, 4, preset.seed) - 0.5) * 0.28;
    const alpha = 0.025 + rand(i, 5, preset.seed) * 0.09;
    targetCtx.strokeStyle = rand(i, 6, preset.seed) > 0.48 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    targetCtx.lineWidth = 0.6 + rand(i, 7, preset.seed) * 1.8;
    targetCtx.beginPath();
    targetCtx.moveTo(x, y);
    targetCtx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    targetCtx.stroke();
  }

  const seam = targetCtx.createLinearGradient(0, horizon - 26, 0, horizon + 110);
  seam.addColorStop(0, 'rgba(255,255,255,0)');
  seam.addColorStop(0.48, 'rgba(0,0,0,.16)');
  seam.addColorStop(1, 'rgba(255,255,255,.02)');
  targetCtx.fillStyle = seam;
  targetCtx.fillRect(0, horizon - 26, width, 136);

  const light = targetCtx.createRadialGradient(width * 0.5, height * 0.68, 4, width * 0.5, height * 0.68, width * 0.44);
  light.addColorStop(0, 'rgba(255,255,255,.17)');
  light.addColorStop(1, 'rgba(255,255,255,0)');
  targetCtx.fillStyle = light;
  targetCtx.fillRect(0, 0, width, height);

  const vignette = targetCtx.createRadialGradient(width * 0.5, height * 0.55, width * 0.18, width * 0.5, height * 0.55, width * 0.82);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.22)');
  targetCtx.fillStyle = vignette;
  targetCtx.fillRect(0, 0, width, height);
}

function drawTemplate() {
  const preset = templates.find((item) => item.value === template) || templates[0];
  if (preset.custom) {
    ctx.drawImage(preset.custom, 0, 0, canvas.width, canvas.height);
    return;
  }
  drawLuxurySurface(ctx, canvas.width, canvas.height, preset);
}

function makeTemplatePreview(preset) {
  if (preset.custom) return preset.custom.toDataURL('image/jpeg', 0.76);
  const thumb = document.createElement('canvas');
  thumb.width = 320;
  thumb.height = 190;
  drawLuxurySurface(thumb.getContext('2d'), thumb.width, thumb.height, preset);
  return thumb.toDataURL('image/jpeg', 0.72);
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
  const base = canvas.width * 0.48 * scale;
  const ratio = sh / sw;
  const dw = ratio > 1 ? base / ratio : base;
  const dh = ratio > 1 ? base : base * ratio;
  const cx = canvas.width / 2 + offsetX;
  const cy = canvas.height * 0.64 + offsetY;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation * Math.PI / 180);
  if (hasShadow) {
    ctx.shadowColor = 'rgba(12,18,14,.35)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 20;
  }
  ctx.drawImage(subjectImage, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

async function prepare(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('请选择 JPG、PNG 或 WEBP 图片', true);
    return;
  }
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  sourceImage = await imageFromUrl(sourceUrl);
  subjectImage = sourceImage;
  offsetX = 0;
  offsetY = 0;
  drop.className = 'drop has-image';
  drop.innerHTML = `<img src="${sourceUrl}" alt="已上传商品图">`;
  replace.hidden = false;
  generate.disabled = false;
  resetDownload();
  progress.classList.remove('show', 'error');
  setStatus('图片已就绪，可以开始合成');
  render();
}

async function professionalCutout() {
  const blob = await fetch(sourceUrl).then((r) => r.blob());
  const response = await fetch('/api/remove-bg', {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  if (!response.ok) throw new Error('专业抠图失败，请确认 remove.bg 配置可用');
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
  progressTo(18, '正在准备商品主体');
  await new Promise((resolve) => requestAnimationFrame(resolve));

  if (mode === 'professional') {
    progressTo(48, '正在连接专业抠图');
    subjectImage = await professionalCutout();
    setStatus('专业抠图完成，已生成轻奢背景效果');
  } else {
    subjectImage = sourceImage;
    setStatus(mode === 'local'
      ? '本地模式会保留原图边缘；复杂背景建议使用专业抠图'
      : '已保留原图合成');
  }

  progressTo(76, '正在生成实拍质感背景');
  render();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  progressTo(93, '正在生成下载文件');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  resultUrl = URL.createObjectURL(blob);
  download.href = resultUrl;
  download.download = 'jewelry-background-composite.png';
  download.classList.remove('disabled');
  download.setAttribute('aria-disabled', 'false');
  progressTo(100, '合成完成');
  generate.disabled = false;
}

function renderTemplateButtons() {
  const container = $('#templates');
  container.innerHTML = templates.map((item, index) => (
    `<button class="template asset${index === 0 ? ' selected' : ''}" data-template="${item.value}" type="button" style="background-image:url('${makeTemplatePreview(item)}')"><span>${item.label}</span></button>`
  )).join('');
}

drop.addEventListener('click', () => fileInput.click());
replace.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => prepare(event.target.files[0]).catch((error) => setStatus(error.message, true)));
drop.addEventListener('dragover', (event) => event.preventDefault());
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  prepare(event.dataTransfer.files[0]).catch((error) => setStatus(error.message, true));
});

$('#subjectMode').addEventListener('click', (event) => {
  if (event.target.tagName !== 'BUTTON') return;
  mode = event.target.dataset.value;
  $('#subjectMode').querySelectorAll('button').forEach((button) => button.classList.toggle('selected', button === event.target));
  render();
});

$('#templates').addEventListener('click', (event) => {
  const button = event.target.closest('.template');
  if (!button) return;
  template = button.dataset.template || template;
  $('#templates').querySelectorAll('.template').forEach((item) => item.classList.toggle('selected', item === button));
  render();
});

bgFile.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const image = await imageFromUrl(url);
  const custom = document.createElement('canvas');
  custom.width = 1000;
  custom.height = 1000;
  const customCtx = custom.getContext('2d');
  customCtx.drawImage(image, 0, 0, custom.width, custom.height);
  templates.unshift({ value: 'custom', label: '自定义背景', colors: ['#ffffff', '#eeeeee', '#dddddd'], seed: Date.now() % 1000, grain: 1, custom });
  template = 'custom';
  renderTemplateButtons();
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
  setStatus(error.message || '合成失败，请重试', true);
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
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });

renderTemplateButtons();

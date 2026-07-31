const fileInput = document.querySelector('#file');
const bgFile = document.querySelector('#bgFile');
const drop = document.querySelector('#drop');
const replace = document.querySelector('#replace');
const canvas = document.querySelector('#canvas');
const empty = document.querySelector('#empty');
const generate = document.querySelector('#generate');
const download = document.querySelector('#download');
const status = document.querySelector('#status');
const progress = document.querySelector('#progress');
const progressText = document.querySelector('#progressText');
const progressPercent = document.querySelector('#progressPercent');
const progressBar = document.querySelector('#progressBar');
const ctx = canvas.getContext('2d');

let sourceImage = null;
let subjectCanvas = null;
let sourceUrl = '';
let backgroundUrl = '';
let backgroundImage = null;
let backgroundColor = '#ffffff';
let template = 'studio';
let subjectMode = 'local';
let scale = 1;
let rotation = 0;
let hasShadow = true;
let resultUrl = '';
let dragging = false;
let offsetX = 0;
let offsetY = 0;

const photoTemplateData = [
  ['charcoalStone', '炭黑粗石', 'linear-gradient(135deg,#242724,#6b7069 48%,#252824)'],
  ['warmLimestone', '暖灰石灰岩', 'linear-gradient(135deg,#d4cdc0,#f3efe5 42%,#a79f93)'],
  ['graphiteSlate', '石墨板岩', 'linear-gradient(135deg,#353937,#8a918b 50%,#222725)'],
  ['walnutTable', '胡桃木桌面', 'repeating-linear-gradient(12deg,#8a5736 0 12px,#b37a4f 13px 21px,#754529 22px 30px)'],
  ['microcement', '浅灰微水泥', 'linear-gradient(135deg,#d7d6cf,#f4f2e8 44%,#b9b8b0)'],
  ['champagneLinen', '香槟亚麻', 'linear-gradient(135deg,#b89161,#f0ddba 48%,#9f7a4e)'],
  ['emeraldVelvet', '翡翠丝绒', 'radial-gradient(circle at 30% 20%,#0d7a5a,#083827 55%,#041b14)'],
  ['sandstone', '沙色石灰墙', 'linear-gradient(135deg,#d9b98b,#f3e5ca 48%,#b88658)'],
  ['smokedGlass', '烟熏黑玻璃', 'linear-gradient(135deg,#101715,#4d5853 45%,#0a0d0c)'],
  ['ivoryMarble', '象牙白大理石', 'linear-gradient(135deg,#fbfaf5,#d9d4c9 44%,#ffffff)'],
];

function seededNoise(x, y, seed = 11) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function drawStoneTexture(colors, seed = 4, contrast = 1) {
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  colors.forEach((color, index) => grad.addColorStop(index / (colors.length - 1), color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const density = 420;
  for (let i = 0; i < density; i += 1) {
    const x = seededNoise(i, 1, seed) * canvas.width;
    const y = seededNoise(i, 2, seed) * canvas.height;
    const w = 3 + seededNoise(i, 3, seed) * 34;
    const h = 1 + seededNoise(i, 4, seed) * 14;
    const alpha = (0.012 + seededNoise(i, 5, seed) * 0.052) * contrast;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((seededNoise(i, 6, seed) - 0.5) * 1.6);
    ctx.fillStyle = seededNoise(i, 7, seed) > 0.48 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let i = 0; i < 26; i += 1) {
    const startY = seededNoise(i, 12, seed) * canvas.height;
    ctx.strokeStyle = seededNoise(i, 13, seed) > 0.5 ? 'rgba(255,255,255,.055)' : 'rgba(0,0,0,.07)';
    ctx.lineWidth = 1 + seededNoise(i, 14, seed) * 3;
    ctx.beginPath();
    ctx.moveTo(-40, startY);
    for (let x = 0; x <= canvas.width + 80; x += 120) {
      ctx.lineTo(x, startY + Math.sin(x * 0.011 + i) * (10 + seededNoise(i, x, seed) * 20));
    }
    ctx.stroke();
  }
}

function drawFabricTexture(base, highlight, seed = 8) {
  const grad = ctx.createRadialGradient(canvas.width * 0.36, canvas.height * 0.26, 20, canvas.width * 0.5, canvas.height * 0.58, canvas.width * 0.75);
  grad.addColorStop(0, highlight);
  grad.addColorStop(1, base);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = -canvas.height; i < canvas.width; i += 18) {
    ctx.strokeStyle = `rgba(255,255,255,${0.035 + seededNoise(i, 1, seed) * 0.045})`;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.bezierCurveTo(i + 180, 260, i - 80, 610, i + canvas.height, canvas.height);
    ctx.stroke();
  }
}

function drawWoodTexture() {
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#8b5737');
  grad.addColorStop(0.52, '#b97d50');
  grad.addColorStop(1, '#704225');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 28) {
    ctx.strokeStyle = `rgba(55,25,10,${0.13 + seededNoise(y, 1, 21) * 0.11})`;
    ctx.lineWidth = 2 + seededNoise(y, 2, 21) * 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= canvas.width; x += 90) {
      ctx.lineTo(x, y + Math.sin(x * 0.018 + y * 0.02) * 11);
    }
    ctx.stroke();
  }
}

function drawBuiltInTexture(name) {
  if (name === 'charcoalStone') return drawStoneTexture(['#151817', '#555b56', '#2a2e2b'], 2, 1.25);
  if (name === 'warmLimestone') return drawStoneTexture(['#b9b2a7', '#eee9dc', '#8f887d'], 3, 0.75);
  if (name === 'graphiteSlate') return drawStoneTexture(['#2a2f2d', '#8a908b', '#1d2220'], 5, 1.05);
  if (name === 'walnutTable') return drawWoodTexture();
  if (name === 'microcement') return drawStoneTexture(['#bfc0bb', '#f2efe6', '#a9aaa4'], 7, 0.58);
  if (name === 'champagneLinen') return drawFabricTexture('#a77d4d', '#f1d9ad', 9);
  if (name === 'emeraldVelvet') return drawFabricTexture('#06261b', '#0d7a5a', 10);
  if (name === 'sandstone') return drawStoneTexture(['#c09161', '#f0ddbd', '#a97949'], 12, 0.8);
  if (name === 'smokedGlass') return drawStoneTexture(['#080c0b', '#3b4642', '#111816'], 13, 1.1);
  if (name === 'ivoryMarble') return drawStoneTexture(['#ffffff', '#ddd8ce', '#f8f4ea'], 15, 0.45);
  return false;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败'));
    image.src = url;
  });
}

function setProgress(value, message) {
  progress.classList.add('show');
  progress.classList.remove('error');
  status.classList.remove('error');
  progressText.textContent = message;
  progressPercent.textContent = `${value}%`;
  progressBar.style.width = `${value}%`;
}

function clearProcessingState() {
  progress.classList.remove('show', 'error');
  status.classList.remove('error');
  progressBar.style.width = '0%';
  progressText.textContent = '正在准备';
  progressPercent.textContent = '0%';
  generate.classList.remove('needs-mode');
  generate.innerHTML = '上传图片后开始合成 <span>→</span>';
  generate.disabled = !sourceImage;
}

function resetDownload() {
  download.classList.add('disabled');
  download.setAttribute('aria-disabled', 'true');
  download.removeAttribute('href');
  download.removeAttribute('download');
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = '';
}

function drawBackground() {
  if (drawBuiltInTexture(template) !== false) {
    return;
  }

  if (backgroundImage && backgroundImage.complete && backgroundImage.naturalWidth) {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    return;
  }

  if (backgroundImage && backgroundImage.complete && !backgroundImage.naturalWidth) {
    backgroundImage = null;
    template = 'studio';
    status.textContent = '背景素材加载失败，已切换为纯色背景';
  }

  if (template === 'wood') {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#d2a477');
    grad.addColorStop(1, '#a96e45');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(85,42,20,.16)';
    ctx.lineWidth = 7;
    for (let y = 0; y < canvas.height; y += 55) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y + 20);
      ctx.stroke();
    }
    return;
  }

  if (template === 'blue') {
    const grad = ctx.createRadialGradient(canvas.width * 0.72, canvas.height * 0.18, 10, canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.8);
    grad.addColorStop(0, '#e8f6f5');
    grad.addColorStop(1, '#8ab7bd');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  if (template === 'sunset') {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#f3d1a9');
    grad.addColorStop(0.5, '#d98472');
    grad.addColorStop(1, '#8b5a68');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(25,48,37,.06)';
  ctx.fillRect(0, canvas.height * 0.68, canvas.width, canvas.height * 0.32);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillRect(0, canvas.height * 0.675, canvas.width, 5);
}

function render() {
  if (!subjectCanvas) return;
  canvas.hidden = false;
  empty.hidden = true;
  canvas.width = 1000;
  canvas.height = 1000;
  drawBackground();

  const subjectWidth = subjectCanvas.naturalWidth || subjectCanvas.width;
  const subjectHeight = subjectCanvas.naturalHeight || subjectCanvas.height;
  const base = Math.min(canvas.width, canvas.height) * 0.58 * scale;
  const ratio = subjectHeight / subjectWidth;
  const drawWidth = ratio > 1 ? base / ratio : base;
  const drawHeight = ratio > 1 ? base : base * ratio;
  const cx = canvas.width / 2 + offsetX;
  const cy = canvas.height / 2 + offsetY;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation * Math.PI / 180);
  if (hasShadow) {
    ctx.shadowColor = 'rgba(20,37,27,.25)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 18;
  }
  ctx.drawImage(subjectCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

async function prepare(file) {
  if (!file || !file.type.startsWith('image/')) {
    status.textContent = '请选择 JPG、PNG 或 WEBP 图片';
    return;
  }

  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);

  try {
    sourceImage = await loadImage(sourceUrl);
    subjectCanvas = sourceImage;
    drop.className = 'drop has-image';
    drop.innerHTML = `<img src="${sourceUrl}" alt="已上传商品图">`;
    replace.hidden = false;
    generate.disabled = false;
    resetDownload();
    clearProcessingState();
    status.textContent = subjectMode === 'professional' ? '图片已就绪，可使用专业抠图合成' : '图片已就绪，可开始合成';
    render();
  } catch (error) {
    status.textContent = error.message || '图片读取失败，请换一张试试';
  }
}

async function getProfessionalCutout() {
  if (!sourceUrl) throw new Error('请先上传商品图片');
  const input = await fetch(sourceUrl).then((response) => response.blob());
  const response = await fetch('/api/remove-bg', {
    method: 'POST',
    headers: { 'Content-Type': input.type || 'image/jpeg' },
    body: input,
  });
  if (!response.ok) {
    let message = '专业抠图失败';
    try {
      message = (await response.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  const blob = await response.blob();
  const cutoutUrl = URL.createObjectURL(blob);
  try {
    return await loadImage(cutoutUrl);
  } finally {
    URL.revokeObjectURL(cutoutUrl);
  }
}

async function composeEnhanced() {
  if (!sourceImage) {
    fileInput.click();
    return;
  }

  generate.disabled = true;
  resetDownload();
  setProgress(12, '正在准备商品主体');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  setProgress(45, '正在处理背景');
  await new Promise((resolve) => requestAnimationFrame(resolve));

  if (subjectMode === 'professional') {
    setProgress(60, '正在连接专业抠图');
    try {
      subjectCanvas = await getProfessionalCutout();
      status.textContent = '专业抠图完成，已生成换背景效果';
    } catch (error) {
      subjectCanvas = sourceImage;
      status.textContent = '专业抠图暂时不可用，已保留原图完成合成';
    }
  } else {
    subjectCanvas = sourceImage;
    status.textContent = subjectMode === 'local' ? '本地模式已保留原图合成，适合实拍质感背景预览' : '已保留原图合成';
  }

  render();
  setProgress(85, '正在生成下载文件');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  resultUrl = URL.createObjectURL(blob);
  download.href = resultUrl;
  download.download = 'background-composite.png';
  download.classList.remove('disabled');
  download.setAttribute('aria-disabled', 'false');
  setProgress(100, '合成完成');
  generate.disabled = false;
}

function loadBackgroundAsset(url) {
  const image = new Image();
  image.onload = () => {
    backgroundImage = image;
    status.textContent = '背景素材已加载';
    render();
  };
  image.onerror = () => {
    backgroundImage = null;
    template = 'studio';
    status.textContent = '背景素材加载失败，已使用纯色背景';
    render();
  };
  image.src = url;
}

drop.addEventListener('click', () => fileInput.click());
replace.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => prepare(event.target.files[0]));
drop.addEventListener('dragover', (event) => event.preventDefault());
drop.addEventListener('drop', (event) => {
  event.preventDefault();
  prepare(event.dataTransfer.files[0]);
});

const subjectModePanel = document.querySelector('#subjectMode');
if (subjectModePanel && !subjectModePanel.querySelector('[data-value="professional"]')) {
  const professionalButton = document.createElement('button');
  professionalButton.type = 'button';
  professionalButton.dataset.value = 'professional';
  professionalButton.textContent = '专业抠图';
  subjectModePanel.appendChild(professionalButton);
}

subjectModePanel.addEventListener('click', (event) => {
  if (event.target.tagName !== 'BUTTON') return;
  subjectMode = event.target.dataset.value;
  subjectModePanel.querySelectorAll('button').forEach((button) => button.classList.toggle('selected', button === event.target));
  if (sourceImage) {
    subjectCanvas = sourceImage;
    clearProcessingState();
    status.textContent = subjectMode === 'professional' ? '已切换为专业抠图，合成时会调用 remove.bg' : '已切换处理方式';
    render();
  }
});

document.querySelector('#swatches').addEventListener('click', (event) => {
  if (event.target.tagName !== 'BUTTON') return;
  backgroundColor = event.target.dataset.color;
  backgroundUrl = '';
  backgroundImage = null;
  template = 'studio';
  document.querySelectorAll('.swatch').forEach((button) => button.classList.toggle('selected', button === event.target));
  document.querySelectorAll('.template').forEach((button) => button.classList.remove('selected'));
  render();
});

const photoTemplateGrid = document.querySelector('#templates');
if (photoTemplateGrid) {
  photoTemplateGrid.innerHTML = photoTemplateData.map(([value, label, css], index) => {
    return `<button class="template asset${index === 0 ? ' selected' : ''}" data-template="${value}" type="button" style="background:${css}"><span>${label}</span></button>`;
  }).join('');
  template = photoTemplateData[0][0];
}

document.querySelector('#templates').addEventListener('click', (event) => {
  const button = event.target.closest('.template');
  if (!button) return;
  const asset = button.dataset.background;
  template = button.dataset.template || 'asset';
  backgroundUrl = '';
  backgroundImage = null;
  document.querySelectorAll('.template').forEach((item) => item.classList.toggle('selected', item === button));
  document.querySelectorAll('.swatch').forEach((item) => item.classList.remove('selected'));
  if (asset) loadBackgroundAsset(asset);
  else render();
});

bgFile.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
  backgroundUrl = URL.createObjectURL(file);
  template = 'custom';
  document.querySelectorAll('.template,.swatch').forEach((button) => button.classList.remove('selected'));
  loadBackgroundAsset(backgroundUrl);
});

document.querySelector('#scale').addEventListener('input', (event) => {
  scale = Number(event.target.value) / 100;
  document.querySelector('#scaleValue').textContent = `${event.target.value}%`;
  render();
});

document.querySelector('#rotate').addEventListener('input', (event) => {
  rotation = Number(event.target.value);
  document.querySelector('#rotateValue').textContent = `${rotation}°`;
  render();
});

document.querySelector('#shadow').addEventListener('click', (event) => {
  hasShadow = !hasShadow;
  event.currentTarget.classList.toggle('on', hasShadow);
  render();
});

generate.addEventListener('click', () => composeEnhanced().catch((error) => {
  generate.disabled = false;
  status.textContent = error.message || '合成失败，请重试';
  progress.classList.add('show', 'error');
  progressText.textContent = '处理失败';
  progressPercent.textContent = '0%';
  progressBar.style.width = '0%';
}));

download.addEventListener('click', (event) => {
  if (download.classList.contains('disabled') || !resultUrl) {
    event.preventDefault();
    return;
  }
  status.textContent = '下载已开始';
});

canvas.addEventListener('pointerdown', (event) => {
  if (!subjectCanvas) return;
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

canvas.addEventListener('pointerup', () => {
  dragging = false;
});

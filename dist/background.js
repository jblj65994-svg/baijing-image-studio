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
  ['photo-01-charcoal-stone.png', '炭黑粗石'],
  ['photo-02-warm-limestone.png', '暖灰石灰岩'],
  ['photo-03-graphite-slate.png', '石墨板岩'],
  ['photo-04-walnut-table.png', '胡桃木桌面'],
  ['photo-05-microcement.png', '浅灰微水泥'],
  ['photo-06-champagne-linen.png', '香槟亚麻'],
  ['photo-07-emerald-velvet.png', '翡翠丝绒'],
  ['photo-08-sandstone-plaster.png', '沙色石灰墙'],
  ['photo-09-smoked-glass.png', '烟熏黑玻璃'],
  ['photo-10-ivory-marble.png', '象牙白大理石'],
];

function assetPath(file) {
  return new URL(`/assets/backgrounds/${file}`, document.baseURI).href;
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
  photoTemplateGrid.innerHTML = photoTemplateData.map(([file, label], index) => {
    const url = assetPath(file);
    return `<button class="template asset${index === 0 ? ' selected' : ''}" data-background="${url}" type="button" style="background-image:url('${url}')"><span>${label}</span></button>`;
  }).join('');
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

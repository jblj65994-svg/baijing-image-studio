const VERSION = '20260806a';
const EXPORT_SCALE = 2;

const file = document.querySelector('#file');
const drop = document.querySelector('#drop');
const replace = document.querySelector('#replace');
const generate = document.querySelector('#generate');
const preview = document.querySelector('#preview');
const download = document.querySelector('#download');
const statusText = document.querySelector('#status');
const shadow = document.querySelector('#shadow');
const sizes = document.querySelector('#sizes');

let source = null;
let sourceFile = null;
let result = null;
let size = '1000 × 1000';
let hasShadow = true;

const noteTitle = document.querySelector('.note b');
const noteText = document.querySelector('.note p');
if (noteTitle) noteTitle.textContent = '专业抠图已启用';
if (noteText) noteText.textContent = '优先使用 remove.bg 去除背景并生成白底图；如果接口失败，会明确提示失败，不再用原图假装成功。';

const versionBadge = document.createElement('div');
versionBadge.textContent = `版本 ${VERSION} · 高清PNG`;
versionBadge.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:20;background:#1f6a4a;color:#fff;font-size:11px;padding:5px 8px;border-radius:2px;opacity:.9';
document.body.appendChild(versionBadge);

function setStatus(message, error = false) {
  statusText.textContent = message;
  statusText.parentElement?.classList.toggle('error', error);
  statusText.parentElement?.style.setProperty('color', error ? '#b24a3a' : '#809087');
}

function setResultCopy(label, title, text) {
  document.querySelector('#result-label').textContent = label;
  document.querySelector('#result-title').textContent = title;
  document.querySelector('#result-text').textContent = text;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败，请重新选择图片'));
    image.src = url;
  });
}

function showProgress(percent, message, error = false) {
  preview.innerHTML = '<div style="width:76%;text-align:center;color:#66756c">'
    + `<div style="font-size:13px;font-weight:700;margin-bottom:12px">${error ? '处理失败' : '正在处理'} ${percent}%</div>`
    + `<div style="height:8px;background:#e3e9e4;border-radius:999px;overflow:hidden"><i style="display:block;width:${percent}%;height:100%;background:${error ? '#b24a3a' : '#1f6a4a'};transition:width .25s"></i></div>`
    + `<p style="font-size:12px;margin:12px 0 0;color:${error ? '#b24a3a' : '#849087'}">${message}</p></div>`;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function load(input) {
  if (!input || !input.type.startsWith('image/')) return;
  if (input.size > 20 * 1024 * 1024) {
    setStatus('图片超过 20MB，请换一张更小的图片', true);
    return;
  }

  sourceFile = input;
  const reader = new FileReader();
  reader.onload = () => {
    source = reader.result;
    result = null;
    drop.className = 'drop has-image';
    drop.innerHTML = `<img src="${source}" alt="已上传商品图">`;
    replace.hidden = false;
    generate.innerHTML = '生成白底主图 <span>→</span>';
    generate.disabled = false;
    download.disabled = true;
    setStatus('图片已就绪，将使用专业抠图生成白底主图');
    setResultCopy('等待处理', '准备好开始了吗？', '点击生成后，会先进行专业抠图；抠图成功后才会生成可下载白底图。');
    preview.innerHTML = '<div class="empty"><span>✦</span><p>你的白底主图会显示在这里</p></div>';
    document.querySelector('#step2').classList.add('active');
  };
  reader.readAsDataURL(input);
}

function renderWhiteCanvas(product) {
  const dimensions = size.match(/\d+/g).map(Number);
  const displayWidth = dimensions[0] || 1000;
  const displayHeight = dimensions[1] || displayWidth;
  const width = displayWidth * EXPORT_SCALE;
  const height = displayHeight * EXPORT_SCALE;
  const productWidth = product.naturalWidth || product.width;
  const productHeight = product.naturalHeight || product.height;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);

  const scaleRatio = Math.min((width * 0.76) / productWidth, (height * 0.76) / productHeight);
  const drawWidth = productWidth * scaleRatio;
  const drawHeight = productHeight * scaleRatio;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  if (hasShadow) {
    context.save();
    context.globalAlpha = 0.16;
    context.filter = `blur(${Math.max(6, width * 0.013)}px)`;
    context.fillStyle = '#26332b';
    context.beginPath();
    context.ellipse(width / 2, y + drawHeight * 0.93, drawWidth * 0.28, Math.max(5, drawHeight * 0.035), 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(product, x, y, drawWidth, drawHeight);
  applySubtleSharpen(context, width, height);
  return canvas.toDataURL('image/png');
}

function applySubtleSharpen(context, width, height) {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const copy = new Uint8ClampedArray(data);
  const amount = 0.18;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[i + c] * (1 + amount * 4);
        const top = copy[i - width * 4 + c] * amount;
        const bottom = copy[i + width * 4 + c] * amount;
        const left = copy[i - 4 + c] * amount;
        const right = copy[i + 4 + c] * amount;
        data[i + c] = Math.max(0, Math.min(255, center - top - bottom - left - right));
      }
    }
  }
  context.putImageData(image, 0, 0);
}

function validateTransparentCutout(product) {
  const sampleSize = 160;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  context.clearRect(0, 0, sampleSize, sampleSize);
  context.drawImage(product, 0, 0, sampleSize, sampleSize);
  const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
  let transparent = 0;
  let opaque = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 10) transparent += 1;
    if (pixels[i] > 220) opaque += 1;
  }
  const total = sampleSize * sampleSize;
  const transparentRatio = transparent / total;
  const opaqueRatio = opaque / total;

  if (transparentRatio < 0.08) {
    throw new Error('专业抠图没有返回透明背景，请稍后重试或换一张主体更清晰的图片');
  }
  if (opaqueRatio < 0.003) {
    throw new Error('没有识别到足够清晰的商品主体，请换一张主体更大的图片');
  }
}

async function readErrorMessage(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try {
      const data = await response.json();
      return data.error || data.message || JSON.stringify(data);
    } catch {
      return '';
    }
  }
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function createProfessionalWhiteBackground() {
  const form = new FormData();
  form.append('image_file', sourceFile, sourceFile.name || 'upload.jpg');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let response;
  try {
    response = await fetch('/api/remove-bg', {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('专业抠图超时，请稍后再试');
    throw new Error('无法连接专业抠图服务，请检查部署环境或稍后再试');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await readErrorMessage(response);
    throw new Error(detail ? `专业抠图失败：${detail}` : `专业抠图失败：接口返回 ${response.status}`);
  }

  const type = response.headers.get('content-type') || '';
  if (!type.includes('image/')) {
    throw new Error('专业抠图没有返回图片结果');
  }

  const transparentProduct = await response.blob();
  if (!transparentProduct.size) throw new Error('专业抠图返回了空图片');

  const cutoutUrl = URL.createObjectURL(transparentProduct);
  try {
    const cutout = await loadImage(cutoutUrl);
    validateTransparentCutout(cutout);
    return renderWhiteCanvas(cutout);
  } finally {
    URL.revokeObjectURL(cutoutUrl);
  }
}

file.onchange = (event) => load(event.target.files[0]);
drop.onclick = () => file.click();
replace.onclick = () => file.click();
drop.ondragover = (event) => event.preventDefault();
drop.ondrop = (event) => {
  event.preventDefault();
  load(event.dataTransfer.files[0]);
};

sizes.onclick = (event) => {
  if (event.target.tagName !== 'BUTTON') return;
  [...sizes.children].forEach((item) => item.classList.remove('selected'));
  event.target.classList.add('selected');
  size = event.target.textContent;
};

shadow.onclick = () => {
  hasShadow = !hasShadow;
  shadow.classList.toggle('on', hasShadow);
};

generate.onclick = async () => {
  if (!source || !sourceFile) {
    file.click();
    return;
  }

  result = null;
  generate.disabled = true;
  generate.innerHTML = '正在生成…';
  download.disabled = true;
  setStatus('正在准备图片…');
  setResultCopy('正在处理', '正在专业抠图', '正在连接 remove.bg 去除背景，完成后会自动生成白底主图。');
  showProgress(15, '读取原图');

  try {
    await nextPaint();
    showProgress(45, '正在使用专业抠图移除背景');
    result = await createProfessionalWhiteBackground();
    showProgress(92, '正在生成下载文件');
    await nextPaint();
    preview.innerHTML = `<img src="${result}" alt="生成的白底商品图">`;
    setStatus('专业抠图完成，白底主图已生成');
    setResultCopy('专业抠图完成', '一张高清 PNG 白底商品图', `背景已由 remove.bg 移除，并按 ${size} 的 2 倍清晰度导出，细节会比原来的 JPG 更稳。`);
    download.disabled = false;
    document.querySelector('#step3').classList.add('active');
  } catch (error) {
    console.error(error);
    result = null;
    showProgress(0, error.message || '专业抠图没有完成', true);
    preview.innerHTML = '<div class="empty"><span>!</span><p>专业抠图没有完成，未生成下载图</p></div>';
    setStatus(error.message || '专业抠图失败，没有生成白底图', true);
    setResultCopy('处理失败', '专业抠图没有完成', '这次没有拿到可用的透明商品主体，所以不会生成假结果。请重试，或换一张主体更清晰、背景更简单的图片。');
    download.disabled = true;
  } finally {
    generate.disabled = false;
    generate.innerHTML = '重新生成 <span>→</span>';
  }
};

download.onclick = () => {
  if (!result) return;
  const anchor = document.createElement('a');
  anchor.href = result;
  anchor.download = 'white-background-product-hd.png';
  anchor.click();
};

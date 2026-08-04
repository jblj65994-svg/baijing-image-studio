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

document.querySelector('.note b').textContent = '专业抠图已启用';
document.querySelector('.note p').textContent = '优先使用 remove.bg 去除背景并生成白底图；如果接口暂时不可用，才会退回本地合成。';

function setStatus(message, error = false) {
  statusText.textContent = message;
  statusText.parentElement?.classList.toggle('error', error);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败，请重新选择图片'));
    image.src = url;
  });
}

function showProgress(percent, message) {
  preview.innerHTML = '<div style="width:76%;text-align:center;color:#66756c">'
    + '<div style="font-size:13px;font-weight:700;margin-bottom:12px">正在处理 ' + percent + '%</div>'
    + '<div style="height:8px;background:#e3e9e4;border-radius:999px;overflow:hidden"><i style="display:block;width:' + percent + '%;height:100%;background:#1f6a4a;transition:width .25s"></i></div>'
    + '<p style="font-size:12px;margin:12px 0 0;color:#849087">' + message + '</p></div>';
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function load(input) {
  if (!input || !input.type.startsWith('image/')) return;
  sourceFile = input;
  const reader = new FileReader();
  reader.onload = () => {
    source = reader.result;
    result = null;
    drop.className = 'drop has-image';
    drop.innerHTML = '<img src="' + source + '" alt="已上传商品图">';
    replace.hidden = false;
    generate.innerHTML = '生成白底主图 <span>→</span>';
    generate.disabled = false;
    download.disabled = true;
    setStatus('图片已就绪，将优先使用专业抠图生成白底图');
    document.querySelector('#step2').classList.add('active');
  };
  reader.readAsDataURL(input);
}

function renderWhiteCanvas(product) {
  const dimensions = size.match(/\d+/g).map(Number);
  const width = dimensions[0] || 1000;
  const height = dimensions[1] || width;
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
    context.globalAlpha = 0.18;
    context.filter = `blur(${Math.max(5, width * 0.012)}px)`;
    context.fillStyle = '#26332b';
    context.beginPath();
    context.ellipse(width / 2, y + drawHeight * 0.93, drawWidth * 0.27, Math.max(5, drawHeight * 0.035), 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(product, x, y, drawWidth, drawHeight);
  return canvas.toDataURL('image/jpeg', 0.96);
}

async function createProfessionalWhiteBackground() {
  const response = await fetch('/api/remove-bg', {
    method: 'POST',
    headers: { 'Content-Type': sourceFile.type || 'image/jpeg' },
    body: sourceFile,
  });
  if (!response.ok) throw new Error('remove.bg 处理失败');
  const transparentProduct = await response.blob();
  const cutoutUrl = URL.createObjectURL(transparentProduct);
  try {
    const cutout = await loadImage(cutoutUrl);
    return renderWhiteCanvas(cutout);
  } finally {
    URL.revokeObjectURL(cutoutUrl);
  }
}

async function createFallbackWhiteBackground() {
  const image = await loadImage(source);
  return renderWhiteCanvas(image);
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
  generate.disabled = true;
  generate.innerHTML = '正在生成…';
  download.disabled = true;
  setStatus('正在准备图片…');
  showProgress(15, '读取原图');

  try {
    await nextPaint();
    showProgress(45, '正在使用专业抠图移除背景');
    result = await createProfessionalWhiteBackground();
    showProgress(92, '正在生成下载文件');
    await nextPaint();
    preview.innerHTML = '<img src="' + result + '" alt="生成的白底商品图">';
    setStatus('专业抠图完成，白底主图已生成');
    document.querySelector('#result-label').textContent = '专业抠图完成';
    document.querySelector('#result-title').textContent = '一张干净的白底商品图';
    document.querySelector('#result-text').textContent = '背景已由 remove.bg 移除，并按 ' + size + ' 像素生成。';
    download.disabled = false;
    document.querySelector('#step3').classList.add('active');
  } catch (error) {
    console.error(error);
    showProgress(72, '专业抠图失败，正在保底生成白底图');
    result = await createFallbackWhiteBackground();
    preview.innerHTML = '<img src="' + result + '" alt="生成的白底商品图">';
    setStatus('专业抠图暂时失败，已先保留原图生成白底图', true);
    document.querySelector('#result-label').textContent = '保底结果';
    document.querySelector('#result-title').textContent = '已生成可下载结果';
    document.querySelector('#result-text').textContent = '当前没有成功调用 remove.bg，因此只是白底画布合成；请稍后重试专业抠图。';
    download.disabled = false;
  } finally {
    generate.disabled = false;
    generate.innerHTML = '重新生成 <span>→</span>';
  }
};

download.onclick = () => {
  if (!result) return;
  const anchor = document.createElement('a');
  anchor.href = result;
  anchor.download = 'white-background-product.jpg';
  anchor.click();
};

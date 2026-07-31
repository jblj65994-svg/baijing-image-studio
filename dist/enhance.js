const fileInput = document.querySelector('#file');
const drop = document.querySelector('#drop');
const replace = document.querySelector('#replace');
const processButton = document.querySelector('#process');
const before = document.querySelector('#before');
const after = document.querySelector('#after');
const download = document.querySelector('#download');
const status = document.querySelector('#status');
const progress = document.querySelector('#progress');
const progressText = document.querySelector('#progressText');
const progressPercent = document.querySelector('#progressPercent');
const progressBar = document.querySelector('#progressBar');
let sourceFile = null;
let sourceImage = null;
let resultUrl = '';
let strength = 'standard';
let scale = 1;

function setChoice(group, value, callback) {
  group.querySelectorAll('button').forEach((button) => button.classList.toggle('selected', button.dataset.value === value));
  callback(value);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败'));
    image.src = url;
  });
}

function load(file) {
  if (!file || !file.type.startsWith('image/')) {
    status.textContent = '请选择 JPG、PNG 或 WEBP 图片';
    return;
  }
  sourceFile = file;
  const url = URL.createObjectURL(file);
  loadImage(url).then((image) => {
    if (sourceImage) URL.revokeObjectURL(sourceImage.src);
    sourceImage = image;
    drop.className = 'drop has-image';
    drop.innerHTML = `<img src="${url}" alt="已上传原图">`;
    replace.hidden = false;
    before.innerHTML = `<img src="${url}" alt="原图预览">`;
    after.innerHTML = '<div class="empty"><span>✦</span><p>点击“开始变清晰”</p></div>';
    download.classList.add('disabled');
    download.setAttribute('aria-disabled', 'true');
    download.removeAttribute('href');
    download.removeAttribute('download');
    status.textContent = '图片已就绪，可以开始增强';
  }).catch(() => { URL.revokeObjectURL(url); status.textContent = '图片读取失败，请换一张试试'; });
}

function setProgress(value, message) {
  progress.classList.add('show');
  progressText.textContent = message;
  progressPercent.textContent = `${value}%`;
  progressBar.style.width = `${value}%`;
}

function enhanceImage(image) {
  const factor = Number(scale);
  const width = Math.max(1, Math.round(image.naturalWidth * factor));
  const height = Math.max(1, Math.round(image.naturalHeight * factor));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const source = imageData.data;
  const original = new Uint8ClampedArray(source);
  const amount = strength === 'light' ? .28 : strength === 'strong' ? .72 : .48;
  const contrast = strength === 'light' ? 1.02 : strength === 'strong' ? 1.08 : 1.045;
  const radius = Math.max(1, Math.round(Math.min(width, height) / 700));
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      if (original[index + 3] === 0) continue;
      const left = ((y * width + Math.max(0, x - radius)) * 4);
      const right = ((y * width + Math.min(width - 1, x + radius)) * 4);
      const top = (((Math.max(0, y - radius) * width) + x) * 4);
      const bottom = (((Math.min(height - 1, y + radius) * width) + x) * 4);
      for (let channel = 0; channel < 3; channel += 1) {
        const blur = (original[left + channel] + original[right + channel] + original[top + channel] + original[bottom + channel]) / 4;
        const sharpened = original[index + channel] + amount * (original[index + channel] - blur);
        source[index + channel] = Math.max(0, Math.min(255, (sharpened - 128) * contrast + 128));
      }
    }
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

async function process() {
  if (!sourceImage) { fileInput.click(); return; }
  processButton.disabled = true;
  download.classList.add('disabled');
  download.setAttribute('aria-disabled', 'true');
  status.textContent = '正在本机增强图片';
  setProgress(12, '正在读取原图');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  setProgress(45, '正在高质量放大');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const canvas = enhanceImage(sourceImage);
  setProgress(82, '正在锐化细节');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  resultUrl = URL.createObjectURL(blob);
  after.innerHTML = `<img src="${resultUrl}" alt="增强后的图片">`;
  setProgress(100, '处理完成');
  status.textContent = `处理完成，已放大 ${scale}×，可下载结果`;
  download.href = resultUrl;
  download.download = `enhanced-${scale}x.png`;
  download.classList.remove('disabled');
  download.setAttribute('aria-disabled', 'false');
  processButton.disabled = false;
}

drop.addEventListener('click', () => fileInput.click());
replace.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => load(event.target.files[0]));
drop.addEventListener('dragover', (event) => { event.preventDefault(); });
drop.addEventListener('drop', (event) => { event.preventDefault(); load(event.dataTransfer.files[0]); });
document.querySelector('#strength').addEventListener('click', (event) => { if (event.target.tagName === 'BUTTON') setChoice(event.currentTarget, event.target.dataset.value, (value) => { strength = value; }); });
document.querySelector('#scale').addEventListener('click', (event) => { if (event.target.tagName === 'BUTTON') setChoice(event.currentTarget, event.target.dataset.value, (value) => { scale = Number(value); }); });
processButton.addEventListener('click', () => process().catch((error) => { processButton.disabled = false; status.textContent = error.message || '处理失败，请重试'; setProgress(0, '处理失败'); }));
download.addEventListener('click', (event) => {
  if (download.classList.contains('disabled') || !resultUrl) {
    event.preventDefault();
    return;
  }
  status.textContent = '下载已开始，如果浏览器询问，请选择保存';
});

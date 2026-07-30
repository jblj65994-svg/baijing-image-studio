let uploadedFile = null;

file.onchange = (event) => {
  uploadedFile = event.target.files[0] || null;
  load(uploadedFile);
};

drop.ondrop = (event) => {
  event.preventDefault();
  uploadedFile = event.dataTransfer.files[0] || null;
  load(uploadedFile);
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// 本地演示用的轻量抠图：从图片四周采样背景颜色，并移除相近的连通背景。
// 对“主体居中 + 背景较简单”的商品图效果最好，完全不上传图片。
function makeLocalCutout(image) {
  const longestSide = 700;
  const ratio = Math.min(1, longestSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;
  const backgroundSamples = [];
  const step = Math.max(2, Math.floor(Math.min(width, height) / 90));

  const sample = (x, y) => {
    const i = (y * width + x) * 4;
    backgroundSamples.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < width; x += step) { sample(x, 0); sample(x, height - 1); }
  for (let y = 0; y < height; y += step) { sample(0, y); sample(width - 1, y); }

  const luminance = (colour) => colour[0] * .2126 + colour[1] * .7152 + colour[2] * .0722;
  const averageLightness = backgroundSamples.reduce((total, colour) => total + luminance(colour), 0) / backgroundSamples.length;
  const lightnessSpread = Math.sqrt(backgroundSamples.reduce((total, colour) => {
    const difference = luminance(colour) - averageLightness;
    return total + difference * difference;
  }, 0) / backgroundSamples.length);
  // 浅色、均匀棚拍背景可以安全地从中心移除；复杂场景则保留中心作为保护。
  const simpleStudioBackground = averageLightness > 145 && lightnessSpread < 38;

  const backgroundDistance = (r, g, b) => {
    let best = Infinity;
    for (const colour of backgroundSamples) {
      const dr = r - colour[0], dg = g - colour[1], db = b - colour[2];
      best = Math.min(best, Math.sqrt(dr * dr + dg * dg + db * db));
    }
    return best;
  };

  // 仅从边界向内扩散，避免误删商品主体上与背景相近的区域。
  const visited = new Uint8Array(width * height);
  const queue = [];
  const add = (x, y) => { const p = y * width + x; if (!visited[p]) { visited[p] = 1; queue.push([x, y]); } };
  for (let x = 0; x < width; x++) { add(x, 0); add(x, height - 1); }
  for (let y = 0; y < height; y++) { add(0, y); add(width - 1, y); }
  const threshold = 70;
  for (let index = 0; index < queue.length; index++) {
    const [x, y] = queue[index];
    const pixel = (y * width + x) * 4;
    const red = data[pixel], green = data[pixel + 1], blue = data[pixel + 2];
    const pixelLightness = red * .2126 + green * .7152 + blue * .0722;
    const pixelChroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    const distance = backgroundDistance(red, green, blue);
    // 浅色低饱和区域通常是纸面、台面或原始阴影；彩色和深色细节则保留。
    const softBackground = simpleStudioBackground && pixelLightness > 145 && pixelChroma < 25 && distance < 118;
    if (distance > threshold && !softBackground) continue;
    data[pixel + 3] = 0;
    // 保护中心区域，避免背景与商品颜色相似时把主体全部吞掉。
    const inProtectedCore = !simpleStudioBackground && x > width * .18 && x < width * .82 && y > height * .12 && y < height * .88;
    if (!inProtectedCore) {
      if (x > 0) add(x - 1, y);
      if (x < width - 1) add(x + 1, y);
      if (y > 0) add(x, y - 1);
      if (y < height - 1) add(x, y + 1);
    }
  }
  let visiblePixels = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 24) visiblePixels++;
  if (visiblePixels < width * height * .035) throw new Error('SUBJECT_NOT_FOUND');
  context.putImageData(pixels, 0, 0);
  return canvas;
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

async function createWhiteBackground() {
  const input = uploadedFile || await (await fetch(source)).blob();
  const response = await fetch('/api/remove-bg', { method: 'POST', headers: {'Content-Type': input.type || 'image/jpeg'}, body: input });
  if (!response.ok) {
    let message = 'remove.bg 处理失败';
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  const transparentProduct = await response.blob();
  const cutoutUrl = URL.createObjectURL(transparentProduct);
  const cutout = await loadImage(cutoutUrl);
  const dimensions = size.match(/\d+/g).map(Number);
  const width = dimensions[0], height = dimensions[1];
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  const scale = Math.min((width * .76) / cutout.width, (height * .76) / cutout.height);
  const drawWidth = cutout.width * scale, drawHeight = cutout.height * scale;
  const x = (width - drawWidth) / 2, y = (height - drawHeight) / 2;
  if (hasShadow) {
    context.save();
    context.globalAlpha = .19;
    context.filter = `blur(${Math.max(5, width * .012)}px)`;
    context.fillStyle = '#26332b';
    context.beginPath();
    context.ellipse(width / 2, y + drawHeight * .93, drawWidth * .27, Math.max(5, drawHeight * .035), 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(cutout, x, y, drawWidth, drawHeight);
  URL.revokeObjectURL(cutoutUrl);
  return canvas.toDataURL('image/jpeg', .96);
}

generate.onclick = async () => {
  if (!source) { file.click(); return; }
  generate.disabled = true;
  generate.innerHTML = '正在本地处理…';
  status.textContent = '正在准备图片…';
  showProgress(12, '正在读取原图');
  try {
    await nextPaint();
    showProgress(38, '正在连接图片处理服务');
    status.textContent = '正在上传到本机处理服务…';
    await nextPaint();
    showProgress(68, '正在识别商品主体并移除背景');
    status.textContent = '正在进行专业抠图…';
    await nextPaint();
    result = await createWhiteBackground();
    showProgress(92, '正在生成下载文件');
    await nextPaint();
    preview.innerHTML = '<img src="' + result + '" alt="生成的白底商品图">';
    status.textContent = '本地白底图已生成，可下载或继续微调';
    document.querySelector('#result-label').textContent = '专业抠图完成';
    document.querySelector('#result-title').textContent = '一张干净的白底商品图';
    document.querySelector('#result-text').textContent = '已按 ' + size + ' 像素生成，背景已由专业图片处理服务移除。';
    download.disabled = false;
    document.querySelector('#step3').classList.add('active');
  } catch (error) {
    console.error(error);
    preview.innerHTML = '<div class="empty"><span>!</span><p>没有识别到清晰的商品主体</p></div>';
    status.textContent = '处理未完成：请更换主体更清晰、背景更简单的商品图';
    document.querySelector('#result-label').textContent = '处理未完成';
    document.querySelector('#result-title').textContent = '抠图未完成';
    document.querySelector('#result-text').textContent = error.message || '请检查本地服务和 remove.bg Key 后重试。';
    download.disabled = true;
  } finally {
    generate.disabled = false;
    generate.innerHTML = '重新生成 <span>→</span>';
  }
};

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
    image.onerror = () => reject(new Error('图片读取失败'));
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

function makeProtectedLocalCutout(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;
  const samples = [];
  const step = Math.max(2, Math.floor(Math.min(width, height) / 80));
  const sample = (x, y) => {
    const index = (y * width + x) * 4;
    samples.push([data[index], data[index + 1], data[index + 2]]);
  };

  for (let x = 0; x < width; x += step) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    sample(0, y);
    sample(width - 1, y);
  }

  const luminance = (color) => color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  const average = samples.reduce((sum, color) => sum + luminance(color), 0) / samples.length;
  const spread = Math.sqrt(samples.reduce((sum, color) => {
    const diff = luminance(color) - average;
    return sum + diff * diff;
  }, 0) / samples.length);

  if (average < 145 || spread > 42) {
    return { image, mode: 'original' };
  }

  const distance = (r, g, b) => {
    let best = Infinity;
    for (const sampleColor of samples) {
      best = Math.min(best, Math.hypot(r - sampleColor[0], g - sampleColor[1], b - sampleColor[2]));
    }
    return best;
  };

  const visited = new Uint8Array(width * height);
  const queue = [];
  const add = (x, y) => {
    const point = y * width + x;
    if (!visited[point]) {
      visited[point] = 1;
      queue.push([x, y]);
    }
  };

  for (let x = 0; x < width; x += 1) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    add(0, y);
    add(width - 1, y);
  }

  const threshold = Math.min(120, Math.max(68, 72 + spread));
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    const pixel = (y * width + x) * 4;
    const r = data[pixel];
    const g = data[pixel + 1];
    const b = data[pixel + 2];
    const isProtectedCore = x > width * 0.18 && x < width * 0.82 && y > height * 0.12 && y < height * 0.88;
    if (distance(r, g, b) > threshold || isProtectedCore) continue;
    data[pixel + 3] = 0;
    if (x > 0) add(x - 1, y);
    if (x < width - 1) add(x + 1, y);
    if (y > 0) add(x, y - 1);
    if (y < height - 1) add(x, y + 1);
  }

  context.putImageData(pixels, 0, 0);
  return { image: canvas, mode: 'local' };
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

async function createWhiteBackground() {
  const input = uploadedFile || await (await fetch(source)).blob();

  try {
    const response = await fetch('/api/remove-bg', {
      method: 'POST',
      headers: { 'Content-Type': input.type || 'image/jpeg' },
      body: input,
    });

    if (!response.ok) throw new Error('remove.bg 处理失败');
    const transparentProduct = await response.blob();
    const cutoutUrl = URL.createObjectURL(transparentProduct);
    try {
      const cutout = await loadImage(cutoutUrl);
      return { data: renderWhiteCanvas(cutout), mode: 'professional' };
    } finally {
      URL.revokeObjectURL(cutoutUrl);
    }
  } catch (error) {
    const original = await loadImage(source);
    const local = makeProtectedLocalCutout(original);
    return { data: renderWhiteCanvas(local.image), mode: local.mode };
  }
}

generate.onclick = async () => {
  if (!source) {
    file.click();
    return;
  }
  generate.disabled = true;
  generate.innerHTML = '正在处理...';
  status.textContent = '正在准备图片...';
  showProgress(12, '读取原图');

  try {
    await nextPaint();
    showProgress(38, '连接图片处理服务');
    await nextPaint();
    showProgress(68, '识别商品主体并生成白底');
    const output = await createWhiteBackground();
    result = output.data;
    showProgress(92, '生成下载文件');
    await nextPaint();

    preview.innerHTML = '<img src="' + result + '" alt="生成的白底商品图">';
    if (output.mode === 'professional') {
      status.textContent = '专业抠图完成，白底主图已生成';
      document.querySelector('#result-label').textContent = '专业抠图完成';
      document.querySelector('#result-text').textContent = '背景已由 remove.bg 移除，并按 ' + size + ' 像素生成。';
    } else if (output.mode === 'local') {
      status.textContent = 'remove.bg 暂时不可用，已使用本地处理生成白底图';
      document.querySelector('#result-label').textContent = '本地处理完成';
      document.querySelector('#result-text').textContent = '专业抠图不可用时，已用本地算法生成可下载白底图。';
    } else {
      status.textContent = 'remove.bg 暂时不可用，已保留原图生成白底图';
      document.querySelector('#result-label').textContent = '已生成可下载结果';
      document.querySelector('#result-text').textContent = '当前图片背景较复杂，已先保留主体画面生成白底版。';
    }
    document.querySelector('#result-title').textContent = '一张干净的白底商品图';
    download.disabled = false;
    document.querySelector('#step3').classList.add('active');
  } catch (error) {
    console.error(error);
    preview.innerHTML = '<div class="empty"><span>!</span><p>图片处理失败，请换一张图片再试</p></div>';
    status.textContent = error.message || '处理失败，请重试';
    document.querySelector('#result-label').textContent = '处理未完成';
    document.querySelector('#result-title').textContent = '暂时无法生成';
    document.querySelector('#result-text').textContent = '请确认图片可以正常读取，然后重新生成。';
    download.disabled = true;
  } finally {
    generate.disabled = false;
    generate.innerHTML = '重新生成 <span>→</span>';
  }
};

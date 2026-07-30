"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

const sizes = [
  { label: "1000 × 1000", value: 1000 },
  { label: "800 × 800", value: 800 },
  { label: "1500 × 1500", value: 1500 },
];

const backgrounds = [
  ["炭黑粗石", "/backgrounds/photo-01-charcoal-stone.png"],
  ["暖灰石灰岩", "/backgrounds/photo-02-warm-limestone.png"],
  ["石墨板岩", "/backgrounds/photo-03-graphite-slate.png"],
  ["胡桃木桌面", "/backgrounds/photo-04-walnut-table.png"],
  ["浅灰微水泥", "/backgrounds/photo-05-microcement.png"],
  ["香槟亚麻", "/backgrounds/photo-06-champagne-linen.png"],
  ["翡翠丝绒", "/backgrounds/photo-07-emerald-velvet.png"],
  ["沙色石灰墙", "/backgrounds/photo-08-sandstone-plaster.png"],
  ["烟黑雾玻璃", "/backgrounds/photo-09-smoked-glass.png"],
  ["象牙白大理石", "/backgrounds/photo-10-ivory-marble.png"],
] as const;

type Mode = "local" | "original" | "professional";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("上传商品图，选择背景后开始合成");
  const [size, setSize] = useState(1000);
  const [mode, setMode] = useState<Mode>("local");
  const [background, setBackground] = useState(backgrounds[2][1]);
  const [scale, setScale] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [shadow, setShadow] = useState(true);

  const selectedBackground = useMemo(() => backgrounds.find((item) => item[1] === background), [background]);

  function loadFile(next?: File) {
    if (!next || !next.type.startsWith("image/")) {
      setMessage("请选择 JPG、PNG 或 WebP 图片");
      return;
    }
    if (next.size > 20 * 1024 * 1024) {
      setMessage("图片不能超过 20MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFile(next);
      setSource(String(reader.result));
      setResult(null);
      setMessage("图片已就绪，选择处理方式后开始合成");
    };
    reader.readAsDataURL(next);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    loadFile(event.target.files?.[0]);
    event.target.value = "";
  }

  useEffect(() => {
    if (source) setResult(null);
  }, [background, scale, rotation, shadow, size, mode, source]);

  async function professionalCutout() {
    if (!file) return null;
    const form = new FormData();
    form.append("image_file", file);
    form.append("size", "auto");
    const response = await fetch("/api/remove-bg", { method: "POST", body: form });
    if (!response.ok) throw new Error((await response.text()) || "remove.bg 请求失败");
    return URL.createObjectURL(await response.blob());
  }

  function compose(productUrl: string) {
    return new Promise<string>((resolve, reject) => {
      const product = new Image();
      const scene = new Image();
      product.onload = () => {
        scene.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("浏览器不支持画布"));
          ctx.drawImage(scene, 0, 0, size, size);
          const factor = Math.min((size * 0.68 * (scale / 100)) / product.width, (size * 0.68 * (scale / 100)) / product.height);
          const width = product.width * factor;
          const height = product.height * factor;
          ctx.save();
          ctx.translate(size / 2, size / 2 + size * 0.035);
          ctx.rotate((rotation * Math.PI) / 180);
          if (shadow) {
            ctx.shadowColor = "rgba(18, 24, 20, .28)";
            ctx.shadowBlur = size * 0.025;
            ctx.shadowOffsetY = size * 0.018;
          }
          ctx.drawImage(product, -width / 2, -height / 2, width, height);
          ctx.restore();
          resolve(canvas.toDataURL("image/jpeg", 0.94));
        };
        scene.onerror = () => reject(new Error("背景素材加载失败"));
        scene.src = background;
      };
      product.onerror = () => reject(new Error("商品图加载失败"));
      product.src = productUrl;
    });
  }

  async function processImage() {
    if (!file || !source) {
      inputRef.current?.click();
      return;
    }
    setBusy(true);
    setResult(null);
    setProgress(8);
    try {
      let productUrl = source;
      if (mode === "professional") {
        setMessage("正在连接 remove.bg 专业抠图服务…");
        setProgress(24);
        productUrl = (await professionalCutout()) || source;
        setProgress(62);
      } else {
        setMessage(mode === "local" ? "正在进行本地智能抠图…" : "正在保留原图并合成背景…");
        setProgress(35);
      }
      const output = await compose(productUrl);
      setResult(output);
      setProgress(100);
      setMessage(mode === "professional" ? "专业抠图并合成完成" : mode === "local" ? "本地合成完成（适合浅色、干净背景）" : "已保留原图并合成完成");
    } catch (error) {
      setProgress(0);
      setMessage(error instanceof Error ? error.message : "处理失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result;
    link.download = `jewelry-background-${size}.jpg`;
    link.click();
  }

  return (
    <main>
      <header className="topbar"><a className="brand" href="#top"><span>白</span>白境工作台</a><nav><a className="active" href="#workspace">换背景</a><a href="#workspace">白底主图</a><a href="#next">图片增强</a></nav><span className="secure">服务器端安全处理</span></header>
      <section className="hero" id="top"><p className="eyebrow">电商图片制作 · 正式版</p><h1>让首饰，在真实质感中成为主角</h1><p>上传一张商品图，专业抠图后叠加实拍材质背景，直接导出可用主图。</p></section>
      <section className="workspace" id="workspace">
        <div className="step-line"><span className="step active-step">1 上传商品图</span><i /><span className={source ? "step active-step" : "step"}>2 设置效果</span><i /><span className={result ? "step active-step" : "step"}>3 下载成品</span></div>
        <div className="studio">
          <div className="upload-column"><div className="section-title"><div><p className="number">01</p><h2>上传原图</h2></div><p>JPG、PNG、最大 20MB</p></div><button className={`dropzone ${source ? "has-image" : ""}`} onClick={() => inputRef.current?.click()} onDrop={(event) => { event.preventDefault(); loadFile(event.dataTransfer.files?.[0]); }} onDragOver={(event) => event.preventDefault()}>{source ? <img src={source} alt="已上传的商品图" /> : <><span className="upload-icon">＋</span><strong>点击或拖入商品图片</strong><small>建议使用光线均匀、主体清晰的原图</small></>}</button><input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} />{source && <button className="replace" onClick={() => inputRef.current?.click()}>重新选择图片</button>}</div>
          <div className="settings-column"><div className="section-title"><div><p className="number">02</p><h2>设置换背景</h2></div><p>可随时重新调整</p></div><label className="field-label">主体处理</label><div className="modes">{([ ["local", "本地去背景"], ["original", "保留原图"], ["professional", "专业抠图"] ] as const).map(([key, label]) => <button key={key} className={mode === key ? "selected" : ""} onClick={() => setMode(key)}>{label}</button>)}</div><div className="note"><b>{mode === "professional" ? "remove.bg 专业服务" : mode === "local" ? "本地处理" : "保留原图"}</b><p>{mode === "professional" ? "服务器端调用 remove.bg，边缘质量最佳；API 密钥不会暴露给浏览器。" : mode === "local" ? "适合浅色、干净背景的商品图，不上传图片，也不消耗 API 次数。" : "保留原图细节，适合已经抠好的透明 PNG。"}</p></div><label className="field-label">实拍背景 · {selectedBackground?.[0]}</label><div className="background-grid">{backgrounds.map(([label, src]) => <button key={src} className={background === src ? "selected" : ""} onClick={() => setBackground(src)}><img src={src} alt="" /><span>{label}</span></button>)}</div><div className="sliders"><label>商品大小 <output>{scale}%</output><input type="range" min="55" max="135" value={scale} onChange={(event) => setScale(Number(event.target.value))} /></label><label>旋转角度 <output>{rotation}°</output><input type="range" min="-30" max="30" value={rotation} onChange={(event) => setRotation(Number(event.target.value))} /></label></div><div className="option-row"><div><strong>自然投影</strong><span>为商品添加轻柔落地阴影</span></div><button onClick={() => setShadow((value) => !value)} className={`switch ${shadow ? "on" : ""}`} aria-label="切换自然投影"><i /></button></div><button className="primary" onClick={processImage} disabled={busy}>{busy ? `处理中 ${progress}%` : source ? "上传图片后开始合成" : "上传图片后开始合成"}<span>→</span></button></div>
        </div>
        <section className="result-area"><div className="result-heading"><div><p className="number">03</p><h2>处理结果</h2></div><p className="status"><b className={busy ? "busy-dot" : ""} />{message}</p></div><div className="progress-wrap"><div className="progress-label"><span>{busy ? "处理中" : result ? "合成完成" : "等待处理"}</span><span>{progress}%</span></div><div className="progress"><i style={{ width: `${progress}%` }} /></div></div><div className="result-card"><div className="preview">{result ? <img src={result} alt="生成的首饰商品图" /> : <div className="empty-preview"><span>✦</span><p>成品会显示在这里</p></div>}</div><div className="result-copy"><p className="result-label">{result ? "处理完成" : busy ? "正在处理" : "等待上传"}</p><h3>{result ? "一张有质感的首饰主图" : busy ? "正在合成你的场景…" : "准备好开始了吗？"}</h3><p>{result ? `已按 ${size} × ${size} 像素生成，可下载 JPG 成品。` : "选择专业抠图可获得更干净的边缘；本地模式适合先快速预览。"}</p><button onClick={download} disabled={!result} className="download">下载合成图片 <span>↓</span></button></div></div></section>
      </section>
      <section className="next" id="next"><p>下一步</p><h2>图片变清晰、营销模板和模特上身<br />将在这张工作台上继续加入。</h2></section>
    </main>
  );
}

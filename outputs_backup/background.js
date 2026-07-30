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
let professionalFallback = false;

function loadImage(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('图片读取失败'));img.src=url;});}
function setProgress(value,message){progress.classList.add('show');progress.classList.remove('error');status.classList.remove('error');progressText.textContent=message;progressPercent.textContent=`${value}%`;progressBar.style.width=`${value}%`;}
function clearProcessingState(){progress.classList.remove('show','error');status.classList.remove('error');progressBar.style.width='0%';progressText.textContent='正在准备';progressPercent.textContent='0%';generate.classList.remove('needs-mode');generate.innerHTML='上传图片后开始合成 <span>→</span>';generate.disabled=!sourceImage;}
function setProcessingError(message){progress.classList.add('show','error');progressText.textContent='处理失败';progressPercent.textContent='—';progressBar.style.width='100%';status.classList.add('error');status.textContent=message;generate.classList.add('needs-mode');generate.innerHTML='请先切换主体处理方式 <span>→</span>';generate.disabled=true;}
function resetDownload(){download.classList.add('disabled');download.setAttribute('aria-disabled','true');download.removeAttribute('href');download.removeAttribute('download');if(resultUrl){URL.revokeObjectURL(resultUrl);resultUrl='';}}
function averageCorners(data,w,h){const points=[[2,2],[w-3,2],[2,h-3],[w-3,h-3]];let r=0,g=0,b=0;points.forEach(([x,y])=>{const i=(y*w+x)*4;r+=data[i];g+=data[i+1];b+=data[i+2];});return [r/4,g/4,b/4];}
function makeLocalCutoutLegacy(image){const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const cctx=c.getContext('2d',{willReadFrequently:true});cctx.drawImage(image,0,0);const imageData=cctx.getImageData(0,0,c.width,c.height);const d=imageData.data;const bg=averageCorners(d,c.width,c.height);const threshold=58;for(let y=0;y<c.height;y+=1){for(let x=0;x<c.width;x+=1){const i=(y*c.width+x)*4;const distance=Math.hypot(d[i]-bg[0],d[i+1]-bg[1],d[i+2]-bg[2]);const edge=Math.min(x,y,c.width-1-x,c.height-1-y);if(distance<threshold&&edge<Math.max(14,Math.min(c.width,c.height)*.18)){d[i+3]=0;}else if(distance<threshold*.52&&edge<Math.max(34,Math.min(c.width,c.height)*.3)){d[i+3]=0;}}}cctx.putImageData(imageData,0,0);return c;}
// 复杂纹理背景不强行“猜”主体：猜错会产生碎片，因此自动保留原图并提示用户。
function makeLocalCutout(image){
  const maxSide=900, ratio=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
  const w=Math.max(1,Math.round(image.naturalWidth*ratio)), h=Math.max(1,Math.round(image.naturalHeight*ratio));
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const cctx=c.getContext('2d',{willReadFrequently:true}); cctx.drawImage(image,0,0,w,h);
  const pixels=cctx.getImageData(0,0,w,h), d=pixels.data, samples=[];
  const step=Math.max(2,Math.floor(Math.min(w,h)/70));
  const addSample=(x,y)=>{const i=(y*w+x)*4;samples.push([d[i],d[i+1],d[i+2]]);};
  for(let x=0;x<w;x+=step){addSample(x,0);addSample(x,h-1);} for(let y=0;y<h;y+=step){addSample(0,y);addSample(w-1,y);}
  const lum=v=>v[0]*.2126+v[1]*.7152+v[2]*.0722;
  const mean=samples.reduce((a,v)=>a+lum(v),0)/Math.max(1,samples.length);
  const spread=Math.sqrt(samples.reduce((a,v)=>a+(lum(v)-mean)**2,0)/Math.max(1,samples.length));
  if(spread>48){window.localCutoutQuality='low';return image;}
  // 纹理密度高时，颜色阈值很容易把背景纹理切成碎片；此时宁可保留原图。
  let texture=0,textureCount=0;
  for(let y=step;y<h-step;y+=step){
    for(let x=step;x<w-step;x+=step){
      const i=(y*w+x)*4, right=(y*w+x+step)*4, down=((y+step)*w+x)*4;
      const a=lum([d[i],d[i+1],d[i+2]]), b=lum([d[right],d[right+1],d[right+2]]), c2=lum([d[down],d[down+1],d[down+2]]);
      texture+=Math.abs(a-b)+Math.abs(a-c2); textureCount+=2;
    }
  }
  const textureScore=texture/Math.max(1,textureCount);
  // 预览截图常带大块白边，整体纹理均值会被稀释；再检查中下部背景带。
  let bandTexture=0,bandCount=0;
  const y0=Math.floor(h*.52), y1=Math.floor(h*.88), x0=Math.floor(w*.12), x1=Math.floor(w*.88);
  for(let y=y0+step;y<y1-step;y+=step){
    for(let x=x0+step;x<x1-step;x+=step){
      const i=(y*w+x)*4, right=(y*w+x+step)*4, down=((y+step)*w+x)*4;
      const a=lum([d[i],d[i+1],d[i+2]]), b=lum([d[right],d[right+1],d[right+2]]), c2=lum([d[down],d[down+1],d[down+2]]);
      bandTexture+=Math.abs(a-b)+Math.abs(a-c2); bandCount+=2;
    }
  }
  const bandScore=bandTexture/Math.max(1,bandCount);
  if(textureScore>24 || bandScore>30){window.localCutoutQuality='low';return image;}
  window.localCutoutQuality='good';
  const distance=(r,g,b)=>{let best=Infinity;for(const s of samples){best=Math.min(best,Math.hypot(r-s[0],g-s[1],b-s[2]));}return best;};
  const threshold=Math.max(62,Math.min(112,62+spread*1.25));
  const visited=new Uint8Array(w*h), queue=[];
  const add=(x,y)=>{const p=y*w+x;if(!visited[p]){visited[p]=1;queue.push([x,y]);}};
  for(let x=0;x<w;x++){add(x,0);add(x,h-1);} for(let y=0;y<h;y++){add(0,y);add(w-1,y);}
  for(let q=0;q<queue.length;q++){
    const [x,y]=queue[q], i=(y*w+x)*4, r=d[i], g=d[i+1], b=d[i+2];
    if(distance(r,g,b)>threshold)continue;
    d[i+3]=0;
    if(x>0)add(x-1,y);if(x<w-1)add(x+1,y);if(y>0)add(x,y-1);if(y<h-1)add(x,y+1);
  }
  let removed=0;for(let i=3;i<d.length;i+=4)if(d[i]===0)removed++;
  const fraction=removed/(w*h);
  if(fraction<.08||fraction>.92){window.localCutoutQuality='low';return image;}
  cctx.putImageData(pixels,0,0);return c;
}

function drawBackground(){if(backgroundImage){ctx.drawImage(backgroundImage,0,0,canvas.width,canvas.height);return;}if(template==='studio'){ctx.fillStyle=backgroundColor;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='rgba(25,48,37,.06)';ctx.fillRect(0,canvas.height*.68,canvas.width,canvas.height*.32);ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillRect(0,canvas.height*.675,canvas.width,5);}else if(template==='wood'){const grad=ctx.createLinearGradient(0,0,canvas.width,canvas.height);grad.addColorStop(0,'#d2a477');grad.addColorStop(1,'#a96e45');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(85,42,20,.16)';ctx.lineWidth=7;for(let y=0;y<canvas.height;y+=55){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y+20);ctx.stroke();}}else if(template==='blue'){const grad=ctx.createRadialGradient(canvas.width*.72,canvas.height*.18,10,canvas.width*.5,canvas.height*.5,canvas.width*.8);grad.addColorStop(0,'#e8f6f5');grad.addColorStop(1,'#8ab7bd');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);}else{const grad=ctx.createLinearGradient(0,0,canvas.width,canvas.height);grad.addColorStop(0,'#f3d1a9');grad.addColorStop(.5,'#d98472');grad.addColorStop(1,'#8b5a68');ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);}}
function render(){if(!subjectCanvas)return;canvas.hidden=false;empty.hidden=true;canvas.width=1000;canvas.height=1000;drawBackground();const base=Math.min(subjectCanvas.width,subjectCanvas.height);const subjectSize=base*.72*scale;const ratio=subjectCanvas.height/subjectCanvas.width;const sw=subjectSize;const sh=subjectSize*ratio;const cx=canvas.width/2+offsetX;const cy=canvas.height/2+offsetY;ctx.save();ctx.translate(cx,cy);ctx.rotate(rotation*Math.PI/180);if(hasShadow){ctx.shadowColor='rgba(20,37,27,.25)';ctx.shadowBlur=28;ctx.shadowOffsetY=18;}ctx.drawImage(subjectCanvas,-sw/2,-sh/2,sw,sh);ctx.restore();}
async function prepare(file){if(!file||!file.type.startsWith('image/')){status.textContent='请选择 JPG、PNG 或 WEBP 图片';return;}if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=URL.createObjectURL(file);try{sourceImage=await loadImage(sourceUrl);subjectCanvas=sourceImage;if(subjectMode==='local')window.localCutoutQuality='low';drop.className='drop has-image';drop.innerHTML=`<img src="${sourceUrl}" alt="已上传商品图">`;replace.hidden=false;generate.disabled=false;resetDownload();status.textContent=subjectMode==='local'?'图片已就绪，本地模式需专业抠图才能更换复杂背景':'图片已就绪，可开始合成';render();}catch(error){status.textContent=error.message||'图片读取失败，请换一张试试';}}
async function compose(){return composeEnhanced();}
async function getProfessionalCutout(){
  if(!sourceUrl)throw new Error('请先上传商品图片');
  const input=await fetch(sourceUrl).then(response=>response.blob());
  const response=await fetch('/api/remove-bg',{method:'POST',headers:{'Content-Type':input.type||'image/jpeg'},body:input});
  if(!response.ok){let message='专业抠图失败';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}
  const blob=await response.blob();
  const cutoutUrl=URL.createObjectURL(blob);
  try{return await loadImage(cutoutUrl);}finally{URL.revokeObjectURL(cutoutUrl);}
}
async function composeEnhanced(){
  if(!sourceImage){fileInput.click();return;}
  generate.disabled=true; resetDownload(); professionalFallback=false; setProgress(12,'正在准备商品主体');
  await new Promise(r=>requestAnimationFrame(r)); setProgress(45,'正在处理背景');
  await new Promise(r=>requestAnimationFrame(r));
  if(subjectMode==='professional'){
    setProgress(58,'正在调用专业抠图');
    try{subjectCanvas=await getProfessionalCutout();window.localCutoutQuality='good';}
    catch(error){professionalFallback=true;subjectCanvas=sourceImage;window.localCutoutQuality='low';}
  } else if(subjectMode==='local'){
    // 本地算法不应把复杂纹理误当成背景；无法确认主体时宁可不生成结果。
    subjectCanvas=sourceImage; window.localCutoutQuality='low';
  } else subjectCanvas=sourceImage;
  if(professionalFallback){
    setProgress(0,'处理失败');
    status.textContent='专业抠图需要连接 remove.bg，当前网络不可用；未生成假结果，请恢复网络后重试';
    generate.disabled=false;
    generate.innerHTML='网络恢复后重试 <span>→</span>';
    return;
  }
  if(subjectMode==='local' && window.localCutoutQuality==='low'){
    setProcessingError('\u590d\u6742\u7eb9\u7406\u80cc\u666f\u65e0\u6cd5\u7528\u672c\u5730\u6a21\u5f0f\u5b89\u5168\u53bb\u9664\uff0c\u8bf7\u5207\u6362\u201c\u4fdd\u7559\u539f\u56fe\u201d\u6216\u4f7f\u7528\u4e13\u4e1a\u62a0\u56fe');
    return;
  }
  if(subjectMode==='local' && window.localCutoutQuality==='low'){
    setProgress(0,'处理未完成');
    status.textContent='复杂纹理背景无法用本地模式安全去除，请切换“保留原图”或使用专业抠图';
    generate.disabled=false;
    return;
  }
  render(); setProgress(82,'正在添加自然投影'); await new Promise(r=>requestAnimationFrame(r));
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  resultUrl=URL.createObjectURL(blob); download.href=resultUrl; download.download='background-composite.png';
  download.classList.remove('disabled'); download.setAttribute('aria-disabled','false'); setProgress(100,'合成完成');
  status.textContent=window.localCutoutQuality==='low'&&subjectMode==='local'?'背景纹理较复杂，已保留原图，避免生成碎片；可切换“保留原图”或使用专业抠图':'背景已更换，可拖动商品继续调整';
  generate.disabled=false;
}

drop.addEventListener('click',()=>fileInput.click());replace.addEventListener('click',()=>fileInput.click());fileInput.addEventListener('change',e=>prepare(e.target.files[0]));drop.addEventListener('dragover',e=>e.preventDefault());drop.addEventListener('drop',e=>{e.preventDefault();prepare(e.dataTransfer.files[0]);});
document.querySelector('#subjectMode').addEventListener('click',e=>{if(e.target.tagName!=='BUTTON')return;subjectMode=e.target.dataset.value;document.querySelectorAll('#subjectMode button').forEach(b=>b.classList.toggle('selected',b===e.target));if(sourceImage){subjectCanvas=sourceImage;if(subjectMode==='local')window.localCutoutQuality='low';status.textContent=subjectMode==='local'?'已切换为本地模式，复杂背景需专业抠图':'已切换为保留原图';render();}});
document.querySelector('#swatches').addEventListener('click',e=>{if(e.target.tagName!=='BUTTON')return;backgroundColor=e.target.dataset.color;backgroundUrl='';backgroundImage=null;template='studio';document.querySelectorAll('.swatch').forEach(b=>b.classList.toggle('selected',b===e.target));document.querySelectorAll('.template').forEach(b=>b.classList.remove('selected'));render();});
const photoTemplateData=[
  ['photo-01-charcoal-stone.png','炭黑粗石'],['photo-02-warm-limestone.png','暖灰石灰岩'],['photo-03-graphite-slate.png','石墨板岩'],['photo-04-walnut-table.png','胡桃木桌面'],['photo-05-microcement.png','浅灰微水泥'],['photo-06-champagne-linen.png','香槟亚麻'],['photo-07-emerald-velvet.png','翡翠丝绒'],['photo-08-sandstone-plaster.png','沙色石灰墙'],['photo-09-smoked-glass.png','烟熏黑玻璃'],['photo-10-ivory-marble.png','象牙白大理石']
];
const photoTemplateGrid=document.querySelector('#templates');
if(photoTemplateGrid){photoTemplateGrid.innerHTML=photoTemplateData.map(([file,label],index)=>`<button class="template asset${index===0?' selected':''}" data-background="./assets/backgrounds/${file}" type="button" style="background-image:url('./assets/backgrounds/${file}')"><span>${label}</span></button>`).join('');}
const subjectModePanel=document.querySelector('#subjectMode');
if(subjectModePanel&&!subjectModePanel.querySelector('[data-value="professional"]')){const professionalButton=document.createElement('button');professionalButton.type='button';professionalButton.dataset.value='professional';professionalButton.textContent='专业抠图';subjectModePanel.appendChild(professionalButton);}
subjectModePanel?.addEventListener('click',e=>{if(e.target.dataset.value==='professional')status.textContent='已切换为专业抠图，合成时会调用 remove.bg';});
document.querySelector('#templates').addEventListener('click',e=>{const button=e.target.closest('.template');if(!button)return;const asset=button.dataset.background;template=button.dataset.template||'asset';backgroundUrl='';backgroundImage=null;document.querySelectorAll('.template').forEach(b=>b.classList.toggle('selected',b===button));document.querySelectorAll('.swatch').forEach(b=>b.classList.remove('selected'));if(asset){backgroundImage=new Image();backgroundImage.onload=()=>render();backgroundImage.src=asset;}else{render();}});
bgFile.addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;if(backgroundUrl)URL.revokeObjectURL(backgroundUrl);backgroundUrl=URL.createObjectURL(file);template='custom';document.querySelectorAll('.template,.swatch').forEach(b=>b.classList.remove('selected'));status.textContent='自定义背景已载入';backgroundImage=new Image();backgroundImage.onload=()=>render();backgroundImage.src=backgroundUrl;});
document.querySelector('#scale').addEventListener('input',e=>{scale=Number(e.target.value)/100;document.querySelector('#scaleValue').textContent=`${e.target.value}%`;render();});document.querySelector('#rotate').addEventListener('input',e=>{rotation=Number(e.target.value);document.querySelector('#rotateValue').textContent=`${rotation}°`;render();});document.querySelector('#shadow').addEventListener('click',e=>{hasShadow=!hasShadow;e.currentTarget.classList.toggle('on',hasShadow);render();});generate.addEventListener('click',()=>composeEnhanced().catch(error=>{generate.disabled=false;status.textContent=error.message||'合成失败，请重试';setProgress(0,'处理失败');}));download.addEventListener('click',e=>{if(download.classList.contains('disabled')||!resultUrl)e.preventDefault();else status.textContent='下载已开始，如果浏览器询问，请选择保存';});
canvas.addEventListener('pointerdown',e=>{if(!subjectCanvas)return;dragging=true;canvas.setPointerCapture(e.pointerId);canvas._dragStart=[e.clientX,e.clientY,offsetX,offsetY];});canvas.addEventListener('pointermove',e=>{if(!dragging)return;const [sx,sy,ox,oy]=canvas._dragStart;offsetX=ox+(e.clientX-sx)*canvas.width/canvas.getBoundingClientRect().width;offsetY=oy+(e.clientY-sy)*canvas.height/canvas.getBoundingClientRect().height;render();});canvas.addEventListener('pointerup',()=>{dragging=false;});
fileInput.addEventListener('change',()=>clearProcessingState());
document.querySelector('#subjectMode').addEventListener('click',e=>{if(e.target.tagName==='BUTTON'&&sourceImage)clearProcessingState();});

const REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg";

function jsonError(message, status = 400, extra = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

async function callRemoveBg(apiKey, imageBytes, imageType, filename, size) {
  const form = new FormData();
  form.append("image_file", new Blob([imageBytes], { type: imageType }), filename);
  form.append("format", "png");
  form.append("size", size);

  return fetch(REMOVE_BG_ENDPOINT, {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: form,
  });
}

export async function onRequestPost({ request, env }) {
  const apiKey = env.REMOVEBG_API_KEY;
  if (!apiKey) {
    return jsonError("还没有配置 remove.bg API 密钥", 503);
  }

  let image;
  try {
    const incoming = await request.formData();
    image = incoming.get("image_file");
  } catch {
    return jsonError("上传格式不正确，请重新选择图片", 400);
  }

  if (!(image instanceof File) && !(image instanceof Blob)) {
    return jsonError("请先上传图片", 400);
  }

  if (!image.size) {
    return jsonError("图片文件为空，请重新选择图片", 400);
  }

  const imageBytes = await image.arrayBuffer();
  const imageType = image.type || "image/png";
  const extension = imageType.includes("jpeg") || imageType.includes("jpg") ? "jpg" : "png";
  const filename = image.name || `upload.${extension}`;

  let response = await callRemoveBg(apiKey, imageBytes, imageType, filename, "50MP");
  let requestedSize = "50MP";

  if (!response.ok && response.status === 400) {
    response = await callRemoveBg(apiKey, imageBytes, imageType, filename, "auto");
    requestedSize = "auto";
  }

  if (!response.ok) {
    const detail = await response.text();
    return jsonError(`remove.bg 处理失败（${response.status}）`, response.status, { detail });
  }

  return new Response(response.body, {
    headers: {
      "content-type": response.headers.get("content-type") || "image/png",
      "cache-control": "no-store",
      "x-baijing-removebg-size": requestedSize,
    },
  });
}

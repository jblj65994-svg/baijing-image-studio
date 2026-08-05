export async function onRequestPost({ request, env }) {
  const apiKey = env.REMOVEBG_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "服务器没有配置 remove.bg API 密钥，请在 Cloudflare Variables and secrets 添加 REMOVEBG_API_KEY。" }, { status: 503 });
  }

  let image = null;
  try {
    const incoming = await request.formData();
    image = incoming.get("image_file");
  } catch {
    return Response.json({ error: "上传格式不正确，请重新选择图片。" }, { status: 400 });
  }

  if (!(image instanceof File) && !(image instanceof Blob)) {
    return Response.json({ error: "请先上传图片。" }, { status: 400 });
  }
  if (!image.size) {
    return Response.json({ error: "图片文件为空，请重新选择图片。" }, { status: 400 });
  }

  const imageType = image.type || "image/png";
  const extension = imageType.includes("jpeg") || imageType.includes("jpg") ? "jpg" : "png";
  const form = new FormData();
  form.append("image_file", image, image.name || `upload.${extension}`);
  form.append("size", "auto");
  form.append("format", "png");

  let response;
  try {
    response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });
  } catch (error) {
    return Response.json({ error: `连接 remove.bg 失败：${error?.message || "网络错误"}` }, { status: 502 });
  }

  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { error: `remove.bg 处理失败（${response.status}）`, detail },
      { status: response.status },
    );
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
    },
  });
}

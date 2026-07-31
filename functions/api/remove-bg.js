export async function onRequestPost({ request, env }) {
  const apiKey = env.REMOVEBG_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "未配置 remove.bg API 密钥" }, { status: 503 });
  }

  const incoming = await request.arrayBuffer();
  if (!incoming.byteLength) {
    return Response.json({ error: "请先上传图片" }, { status: 400 });
  }

  const form = new FormData();
  form.append("image_file", new Blob([incoming], { type: request.headers.get("content-type") || "image/jpeg" }), "upload.jpg");
  form.append("size", "auto");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    return Response.json({ error: `remove.bg 处理失败（${response.status}）`, detail }, { status: response.status });
  }

  return new Response(response.body, {
    headers: {
      "content-type": response.headers.get("content-type") || "image/png",
      "cache-control": "no-store",
    },
  });
}

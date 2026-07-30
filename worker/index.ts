import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: { input(stream: ReadableStream): { transform(options: Record<string, unknown>): { output(options: { format: string; quality: number }): Promise<{ response(): Response }> } } };
  REMOVEBG_API_KEY?: string;
}

interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void; }

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/remove-bg") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
      if (!env.REMOVEBG_API_KEY) return new Response("服务器尚未配置 remove.bg API 密钥", { status: 503 });
      try {
        const incoming = await request.formData();
        const image = incoming.get("image_file");
        if (!(image instanceof File)) return new Response("请上传图片", { status: 400 });
        const form = new FormData();
        form.append("image_file", image, image.name || "upload.png");
        form.append("size", "auto");
        const upstream = await fetch("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": env.REMOVEBG_API_KEY }, body: form });
        return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/octet-stream", "Cache-Control": "no-store" } });
      } catch (error) {
        return new Response(`remove.bg 连接失败：${error instanceof Error ? error.message : "未知网络错误"}`, { status: 502 });
      }
    }
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, { fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))), transformImage: async (body, { width, format, quality }) => { const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality }); return result.response(); } }, allowedWidths);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;

/**
 * Cloudflare Worker Script for School Chat
 * 
 * This Worker proxies requests to your backend origin,
 * automatically handling CORS preflight (OPTIONS) and WebSocket upgrades
 * without throwing "405 Method Not Allowed".
 */

// Replace this with your backend host or server IP/Domain (e.g. your Liara, Koyeb, VPS, or Railway address)
const BACKEND_ORIGIN = "https://your-backend-app.liara.run";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight OPTIONS requests directly in Cloudflare Worker (prevents 405)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 2. Handle WebSocket Upgrade for real-time messaging
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      const targetWsUrl = new URL(request.url);
      const backendUrl = new URL(BACKEND_ORIGIN);
      targetWsUrl.hostname = backendUrl.hostname;
      targetWsUrl.protocol = backendUrl.protocol;
      targetWsUrl.port = backendUrl.port;

      return fetch(targetWsUrl.toString(), request);
    }

    // 3. Proxy API requests and frontend requests to backend
    const targetUrl = new URL(request.url);
    const backendUrl = new URL(BACKEND_ORIGIN);
    targetUrl.hostname = backendUrl.hostname;
    targetUrl.protocol = backendUrl.protocol;
    targetUrl.port = backendUrl.port;

    const modifiedRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "follow",
    });

    try {
      const response = await fetch(modifiedRequest);
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: "Backend unreachable", details: err.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};

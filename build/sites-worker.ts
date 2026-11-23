import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { videoResponse } from "../app/assets/video/[file]/route";

// The Sites deployment duplicates the public portfolio (the indexed copy is GitHub Pages, see
// scripts/build-seo.mjs) and hosts client demos, so search engines must not index it.
function withNoindex(response: Response): Response {
  if (response.status === 101 || response.webSocket) return response;
  const marked = new Response(response.body, response);
  marked.headers.set("X-Robots-Tag", "noindex, nofollow");
  return marked;
}

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    return withNoindex(await route(request, env, ctx));
  },
};

function route(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
  if (request.headers.has("Range") && /^\/assets\/video\/[\w-]+\.mp4$/.test(new URL(request.url).pathname)) return videoResponse(request, env);
  let binding = ctx.props?.CONNECTORS;
  // Local preview emulates the same request-scoped capability. This branch and
  // the auxiliary service binding are absent from production builds.
  if (import.meta.env.DEV && !binding && env.CONNECTORS) {
    const preview = env.CONNECTORS;
    const expiresAt = Date.now() + 60_000;
    binding = {
      async getContext() {
        if (Date.now() >= expiresAt) return { status: "request_context_expired" };
        return preview.getContext?.() ?? { status: "binding_unavailable" };
      },
      async invoke(connectorId, actionName, args) {
        if (Date.now() >= expiresAt) {
          return { status: "request_context_expired", message: "This request has expired. Please try again." };
        }
        return preview.invoke(connectorId, actionName, args);
      },
    };
  }
  return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
}

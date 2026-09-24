const http = require("node:http");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const API_PREFIX = "/api";

function proxyApiRequest(request, response) {
  const upstreamPath = request.url.slice(API_PREFIX.length) || "/";
  const upstreamRequest = http.request(
    {
      hostname: "127.0.0.1",
      port: 8000,
      path: upstreamPath,
      method: request.method,
      headers: {
        ...request.headers,
        host: "127.0.0.1:8000",
      },
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers,
      );
      upstreamResponse.pipe(response);
    },
  );

  upstreamRequest.on("error", (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        success: false,
        data: null,
        error: {
          code: "api_proxy_unavailable",
          message: "Local API is unavailable.",
        },
      }),
    );
  });

  request.pipe(upstreamRequest);
}

config.server.enhanceMiddleware = (metroMiddleware) =>
  function aivisionDevMiddleware(request, response, next) {
    if (
      request.url === API_PREFIX ||
      request.url.startsWith(`${API_PREFIX}/`)
    ) {
      proxyApiRequest(request, response);
      return;
    }

    metroMiddleware(request, response, next);
  };

module.exports = config;

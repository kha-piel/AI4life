type ApiBaseUrlOptions = {
  isDev: boolean;
  metroHostUri?: string;
  configuredUrl?: string;
};

function isPrivateDevelopmentHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "::1" || hostname.startsWith("127.")) {
    return true;
  }

  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
    return hostname.endsWith(".local");
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second !== undefined && second >= 64 && second <= 127)
  );
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveApiBaseUrl({
  isDev,
  metroHostUri,
  configuredUrl,
}: ApiBaseUrlOptions): string | null {
  const cleanMetroHost = metroHostUri?.trim().replace(/\/+$/, "");
  if (isDev && cleanMetroHost) {
    if (/^https?:\/\//i.test(cleanMetroHost)) {
      return `${withoutTrailingSlash(cleanMetroHost)}/api`;
    }

    const hostname = cleanMetroHost.startsWith("[")
      ? cleanMetroHost.slice(1, cleanMetroHost.indexOf("]"))
      : (cleanMetroHost.split(":", 1)[0] ?? "");
    const protocol = isPrivateDevelopmentHost(hostname) ? "http" : "https";
    return `${protocol}://${cleanMetroHost}/api`;
  }

  const cleanConfiguredUrl = configuredUrl?.trim();
  if (!cleanConfiguredUrl) return null;

  try {
    const parsed = new URL(cleanConfiguredUrl);
    if (!isDev && parsed.protocol !== "https:") return null;
    return withoutTrailingSlash(parsed.toString());
  } catch {
    return null;
  }
}

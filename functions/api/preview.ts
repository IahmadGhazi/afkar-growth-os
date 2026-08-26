/**
 * GET /api/preview?url=<encoded>
 * Fetches a URL server-side, extracts Open Graph / meta image + title.
 * Returns { ok, image, title, host }.
 * Used by Product Research to show the actual product photo from its source link.
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request } = context;
  if (request.method !== "GET") return json({ error: "GET only" }, 405);

  const urlParam = new URL(request.url).searchParams.get("url");
  if (!urlParam) return json({ error: "missing url" }, 400);

  let target: URL;
  try {
    target = new URL(urlParam);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("bad protocol");
  } catch {
    return json({ error: "invalid url" }, 400);
  }

  // SSRF guard: block private ranges
  const host = target.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".internal") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host)
  ) {
    return json({ error: "blocked host" }, 403);
  }

  try {
    const res = await fetch(target.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; AfkarPreview/1.0)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(7000),
      redirect: "follow",
    });
    if (!res.ok) return json({ ok: false, error: `fetch ${res.status}` }, 502);

    const html = await res.text();
    const slice = html.slice(0, 200000); // cap for regex

    // Extract og:image, twitter:image, or first large img
    const ogImage =
      slice.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      slice.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] ||
      slice.match(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      slice.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i)?.[1] ||
      null;

    const title =
      slice.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      slice.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      null;

    // Resolve relative image URLs
    let image: string | null = null;
    if (ogImage) {
      try {
        image = new URL(ogImage, target.toString()).toString();
      } catch {
        image = ogImage;
      }
    }

    // Fallback: screenshot service for site preview (thum.io)
    const screenshot = `https://image.thum.io/get/width/600/crop/800/noanimate/${encodeURIComponent(target.toString())}`;

    return json({
      ok: true,
      image,
      title: title ? title.slice(0, 120) : null,
      host: target.hostname.replace("www.", ""),
      screenshot,
    });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message).slice(0, 200) }, 502);
  }
}

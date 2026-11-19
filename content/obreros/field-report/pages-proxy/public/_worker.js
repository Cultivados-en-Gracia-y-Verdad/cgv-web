export default {
  async fetch(request, env) {
    const response = await env.FORM_SERVICE.fetch(request);
    const headers = new Headers(response.headers);

    // Private participant links must not appear in search results or leak as referrers.
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Referrer-Policy", "no-referrer");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

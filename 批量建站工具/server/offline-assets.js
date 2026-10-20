/** Sandbox previews have an opaque origin. Only public font assets receive
 * CORS permission; template writes keep the existing loopback/origin checks. */
export function offlineFontHeaders(request, response, next) {
    if (/^\/fonts\//.test(request.url || '')) {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    next();
}

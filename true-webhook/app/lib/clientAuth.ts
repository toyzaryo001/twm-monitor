export function parseJwt(token: string) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

export function isTokenExpired(token: string): boolean {
    const decoded = parseJwt(token);
    if (!decoded || !decoded.exp) return true;

    const exp = Number(decoded.exp);
    if (!Number.isFinite(exp)) return true;

    // Server tokens use milliseconds; accept seconds for JWT-compatible tokens.
    const expMs = exp < 10_000_000_000 ? exp * 1000 : exp;
    return expMs < Date.now();
}

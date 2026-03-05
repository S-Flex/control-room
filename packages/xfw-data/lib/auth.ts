const LOCAL_STORAGE_TOKEN_NAME = "session";
let token: string | null = null;

const subscribers = new Set<(token: string | null) => void>();

// Load token from localStorage on startup
if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME);
    if (stored) token = stored;
}

export function setToken(newToken: string | null) {
    token = newToken;
    if (newToken) {
        localStorage.setItem(LOCAL_STORAGE_TOKEN_NAME, newToken);
    } else {
        localStorage.removeItem(LOCAL_STORAGE_TOKEN_NAME);
    }
    subscribers.forEach((cb) => cb(token));
}

export function getToken() {
    return token;
}

export function clearToken() {
    setToken(null);
}

export function subscribeToken(cb: (token: string | null) => void) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
}

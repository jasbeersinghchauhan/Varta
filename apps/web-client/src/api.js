import { AppState } from './state.js';

const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
export const SERVER_URL = isLocalhost ? "http://localhost:3000" : "https://varta-0w6d.onrender.com";

export async function refreshAccessToken() {
    if (!AppState.tokens.refresh) {
        window.location.replace("/index.html");
        return null;
    }
    try {
        const response = await fetch(`${SERVER_URL}/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: AppState.tokens.refresh }),
        });
        if (!response.ok) throw new Error("Session expired");
        const data = await response.json();

        AppState.tokens.access = data.accessToken;
        AppState.tokens.refresh = data.refreshToken;
        sessionStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        return data.accessToken;
    } catch (err) {
        sessionStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.replace("/index.html");
        return null;
    }
}

export async function apiRequest(endpoint, options = {}, retry = true) {
    let response = await fetch(`${SERVER_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AppState.tokens.access}`,
            ...(options.headers || {}),
        },
    });

    if (response.status === 401 && retry) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            response = await fetch(`${SERVER_URL}${endpoint}`, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${newToken}`,
                    ...(options.headers || {}),
                },
            });
        } else {
            return null;
        }
    }

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : {};
}
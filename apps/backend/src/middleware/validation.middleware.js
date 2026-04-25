export function validateRegister(data) {
    if (!data || typeof data !== "object") {
        throw new Error("INVALID_PAYLOAD");
    }

    const username = typeof data.username === "string" ? data.username.trim() : "";
    if (username.length < 3 || username.length > 80)
        throw new Error("INVALID_USERNAME");

    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
        throw new Error("INVALID_EMAIL");

    const password = typeof data.password === "string" ? data.password : "";
    const strongPassword =
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password);

    if (!strongPassword)
        throw new Error("WEAK_PASSWORD");
}

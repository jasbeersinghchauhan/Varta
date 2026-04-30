export function validateRegister(data) {
    if (!data || typeof data !== "object") {
        throw new Error("INVALID_PAYLOAD");
    }

    const username = validateUsername(data.username);
    const email = validateEmail(data.email);
    const password = validatePassword(data.password);

    return { username, email, password };
}

export function validateUsername(username) {
    if (typeof username !== "string") throw new Error("INVALID_USERNAME");

    const trimmed = username.trim();

    if (trimmed.length < 3 || trimmed.length > 80)
        throw new Error("INVALID_USERNAME");
    return trimmed;
}

export function validateEmail(email) {
    if (typeof email !== "string") throw new Error("INVALID_EMAIL");

    const normalized = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized))
        throw new Error("INVALID_EMAIL");
    return normalized;
}

export function validatePassword(password) {
    if (typeof password !== "string") throw new Error("WEAK_PASSWORD");

    const strongPassword =
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password);

    if (!strongPassword)
        throw new Error("WEAK_PASSWORD");
    return password;
}
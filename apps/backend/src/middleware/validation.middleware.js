export function validateRegister(data) {
    if (!data.username || data.username.length < 3)
        throw new Error("INVALID_USERNAME");

    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
        throw new Error("INVALID_EMAIL");

    if (!data.password || data.password.length < 8)
        throw new Error("INVALID_PASSWORD");
}

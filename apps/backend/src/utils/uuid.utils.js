export function uuidToBuffer(uuid) {
    if (!uuid) return null;
    
    const hex = uuid.replace(/-/g, '');
    return Buffer.from(hex, 'hex');
}

export function bufferToUuid(buffer) {
    if (!buffer) return null;

    const hex = buffer.toString('hex');
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
    ].join('-');
}
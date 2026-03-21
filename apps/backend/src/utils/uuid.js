import { parse as uuidParse, stringify as uuidStringify } from "uuid";

export function uuidToBuffer(uuid) {
    return Buffer.from(uuidParse(uuid));
}

export function bufferToUuid(buffer) {
    return uuidStringify(buffer);
}
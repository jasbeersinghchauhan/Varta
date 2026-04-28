import { handleSendMessage } from './chat-server.js'
import { handleWebRTCSignal } from './webrtc-server.js'

export async function routeEvent(websocket, event) {
    switch (event.type) {
        case "send_message":
            await handleSendMessage(websocket, event);
            break;
            
        case "webrtc_offer":
        case "webrtc_answer":
        case "webrtc_ice_candidate":
        case "webrtc_end_call":
            await handleWebRTCSignal(websocket, event);
            break;

        default:
            websocket.send(JSON.stringify({ error: "Unknown event " }));
    }
}
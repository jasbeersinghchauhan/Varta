import { handleSendMessage } from './chat-server.js'

export async function routeEvent(websocket, event) {
    switch  (event.type) {
        case "send_message":
            await handleSendMessage(websocket, event);
            break;
        
        default:
            websocket.send(JSON.stringify({ error: "Unknown event "}));
    }
}
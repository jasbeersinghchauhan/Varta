import { WebSocketServer } from 'ws';
import { verifyAccessToken } from '../utils/token.utils.js'
import  { registerConnection, removeConnection, getConnection, broadcastStatus } from './connections.js'
import { routeEvent } from './ws-router.js';

export function initializeWebSocket(httpServer) {
    const wss = new WebSocketServer({ server: httpServer });

    wss.on("connection", (websocket, req) => {
        try {
            const url = new URL(req.url, "http://localhost");
            const token = url.searchParams.get("token");

            if (!token) {
                websocket.close(4001, "Unauthorized");
                return;
            }

            const { userId } = verifyAccessToken(token);

            registerConnection(userId, websocket);

            websocket.userId = userId;

            broadcastStatus(userId, true);
        } catch (err) {
            websocket.close(4001, "Invalid token");
            return;
        }

        websocket.on("message", async (data) => {
            try {
                const event = JSON.parse(data);

                await routeEvent(websocket, event);
            } catch (err) {
                websocket.send(JSON.stringify({
                    type: "error",
                    message: "Invalid message format"
                }));
            }
        });

        websocket.on("close", () => {
            if (websocket.userId){
                removeConnection(websocket.userId, websocket);
                
                const activeSockets = getConnection(websocket.userId);
                if (!activeSockets || activeSockets.size === 0) {
                    broadcastStatus(websocket.userId, false);
                }
            }
        });
    });
    return wss;
}
import { getUserCallLogs } from "./calls.service.js";

export async function getCallHistory(req, res) {
    try {
        const userId = req.user.id;
        const logs = await getUserCallLogs(userId);

        res.json(logs);
    } catch (error) {
        console.error("Failed to fetch call logs:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}
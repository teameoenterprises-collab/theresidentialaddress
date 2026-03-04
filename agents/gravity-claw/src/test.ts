import "dotenv/config";
import { processAgentMessage } from "./agent/loop.js";

async function runTest() {
    console.log("Testing agent loop...");
    try {
        const reply = await processAgentMessage("Hello, what time is it?", "test_chat_id");
        console.log("SUCCESS:", reply);
    } catch (error) {
        console.error("FAILED WITH ERROR:", error);
    }
}

runTest();

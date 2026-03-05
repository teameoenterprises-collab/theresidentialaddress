import "dotenv/config";
import { Bot } from "grammy";
import { processAgentMessage } from "./agent/loop.js";
import { mcpManager } from "./tools/mcp.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_IDS_STR = process.env.AUTHORIZED_TELEGRAM_USER_ID || "";
const AUTHORIZED_IDS = AUTHORIZED_IDS_STR.split(",").map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

if (!TELEGRAM_BOT_TOKEN || AUTHORIZED_IDS.length === 0) {
    console.error("CRITICAL: TELEGRAM_BOT_TOKEN or AUTHORIZED_TELEGRAM_USER_ID is not set in .env!");
    process.exit(1);
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);

bot.use(async (ctx, next) => {
    const senderId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    // Allow if either the sender is authorized OR the chat itself is authorized
    const isSenderAuthorized = senderId && AUTHORIZED_IDS.includes(senderId);
    const isChatAuthorized = chatId && AUTHORIZED_IDS.includes(chatId);

    if (!isSenderAuthorized && !isChatAuthorized) {
        console.warn(`[BLOCKED] Message from User: ${senderId} | Chat: ${chatId}`);
        return;
    }

    await next();
});

// Map to track if Max is currently the active focus of a group chat
// Key: chatId, Value: boolean
const chatFocusState = new Map<number, boolean>();

// Listen to both text messages and photos
bot.on(["message:text", "message:photo"], async (ctx) => {
    // 1. Extract text/caption
    const incomingText = ctx.message.text || ctx.message.caption || "";
    const chatId = ctx.chat.id;
    const isGroupChat = chatId < 0;

    // ─── Group Chat Filter (Sticky Conversation) ───────────────────────
    if (isGroupChat) {
        const botUsername = ctx.me.username?.toLowerCase() || "";
        const msgLower = incomingText.toLowerCase();

        // Triggers to ENGAGE Max
        const isMentioned = msgLower.includes(`@${botUsername}`);
        const isNamedMax = msgLower.includes("max");
        const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.me.id;

        // Triggers to DISENGAGE Max (mentioning someone else WITHOUT Max)
        const mentionsOther = msgLower.includes("aman") || msgLower.includes("@cryptohyve");

        let isActive = chatFocusState.get(chatId) || false;

        // If Max is explicitly invoked (even alongside others), he engages
        if (isMentioned || isNamedMax || isReplyToBot) {
            isActive = true;
            chatFocusState.set(chatId, true);
        }
        // If someone else is invoked WITHOUT Max, he disengages
        else if (mentionsOther) {
            isActive = false;
            chatFocusState.set(chatId, false);
        }

        // If not actively focused, ignore the message
        if (!isActive) {
            return;
        }
    }

    console.log(`[RCVD] Chat: ${chatId} | User: ${ctx.from.id} -> ${incomingText || "[Photo]"}`);

    await ctx.replyWithChatAction("typing");

    try {
        // 2. Prepare multimodal parts for Gemini
        const userParts: any[] = [];

        if (incomingText) {
            userParts.push({ text: incomingText });
        }

        // 3. Handle attached photos
        if (ctx.message.photo && ctx.message.photo.length > 0) {
            // Get the highest resolution version of the photo
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const file = await ctx.api.getFile(photo.file_id);

            if (file.file_path) {
                // Download the file from Telegram
                const url = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const base64Data = Buffer.from(arrayBuffer).toString('base64');

                // Add the image to the Gemini parts array
                userParts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: "image/jpeg"
                    }
                });
                console.log(`[PHOTO] Downloaded and attached image (${Math.round(base64Data.length / 1024)} KB)`);
            }
        }

        // If it was just an empty image with no caption, add a generic text prompt
        if (userParts.length === 1 && userParts[0].inlineData) {
            userParts.unshift({ text: "Please process this image." });
        }

        // 4. Send to Agent
        const agentReply = await processAgentMessage(
            userParts,
            chatId.toString(),
            async (progressMsg) => {
                await ctx.reply(progressMsg);
            }
        );
        await ctx.reply(agentReply);
        console.log(`[SENT] Chat: ${chatId} -> ${agentReply.substring(0, 100)}...`);
    } catch (error) {
        console.error("Agent Loop Error:", error);
        await ctx.reply("⚠️ An error occurred while processing your request.");
    }
});

async function startBot() {
    console.log("🔌 Connecting to MCP Servers...");
    await mcpManager.loadConfigAndConnect();

    console.log(`
🦅 Gravity Claw (Telegram Edition) initialized.
🔒 Authorized IDs: ${AUTHORIZED_IDS.join(", ")}
⚡ Polling Telegram servers...
`);

    bot.start();
}

startBot();

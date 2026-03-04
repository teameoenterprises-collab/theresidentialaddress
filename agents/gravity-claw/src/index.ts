import "dotenv/config";
import { Bot } from "grammy";
import { processAgentMessage } from "./agent/loop.js";
import { mcpManager } from "./tools/mcp.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_ID = process.env.AUTHORIZED_TELEGRAM_USER_ID ?
    parseInt(process.env.AUTHORIZED_TELEGRAM_USER_ID, 10) : undefined;

if (!TELEGRAM_BOT_TOKEN || !AUTHORIZED_ID) {
    console.error("CRITICAL: TELEGRAM_BOT_TOKEN or AUTHORIZED_TELEGRAM_USER_ID is not set in .env!");
    process.exit(1);
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);

bot.use(async (ctx, next) => {
    const senderId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    if (senderId !== AUTHORIZED_ID && chatId !== AUTHORIZED_ID) {
        console.warn(`[BLOCKED] Message from User: ${senderId} | Chat: ${chatId}`);
        return;
    }

    await next();
});

bot.on("message:text", async (ctx) => {
    const incomingMsg = ctx.message.text;
    const chatId = ctx.chat.id;
    const isGroupChat = chatId < 0; // Negative IDs = groups/supergroups

    // ─── Group Chat Filter ─────────────────────────────────────────────
    // In group chats, only respond when Max is directly addressed.
    // In DMs, always respond.
    if (isGroupChat) {
        const botUsername = ctx.me.username?.toLowerCase() || "";
        const msgLower = incomingMsg.toLowerCase();
        const isMentioned = msgLower.includes(`@${botUsername}`);
        const isNamedMax = msgLower.includes("max");
        const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.me.id;

        if (!isMentioned && !isNamedMax && !isReplyToBot) {
            // Not addressed to Max — ignore silently
            return;
        }
    }

    console.log(`[RCVD] Chat: ${chatId} | User: ${ctx.from.id} -> ${incomingMsg}`);

    await ctx.replyWithChatAction("typing");

    try {
        const agentReply = await processAgentMessage(incomingMsg, chatId.toString());
        await ctx.reply(agentReply);
        console.log(`[SENT] Chat: ${chatId} -> ${agentReply}`);
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
🔒 Authorized ID: ${AUTHORIZED_ID}
⚡ Polling Telegram servers...
`);

    bot.start();
}

startBot();

import "dotenv/config";
import { Bot, InputFile } from "grammy";
import { processAgentMessage, AgentContext, FILE_MAP } from "./agent/loop.js";
import { mcpManager } from "./tools/mcp.js";
import { startAutoBackup } from "./backup.js";
import fs from "fs";
import path from "path";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ASAN_TOKEN = process.env.TELEGRAM_ASAN_TOKEN;
const TELEGRAM_MARK_BTM_TOKEN = process.env.TELEGRAM_MARK_BTM_TOKEN;
const TELEGRAM_VIKAS_TOKEN = process.env.TELEGRAM_VIKAS_TOKEN;
const TELEGRAM_AHMAD_TOKEN = process.env.TELEGRAM_AHMAD_TOKEN;

const AUTHORIZED_IDS_STR = process.env.AUTHORIZED_TELEGRAM_USER_ID || "";
const AUTHORIZED_IDS = AUTHORIZED_IDS_STR.split(",").map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

const COMPANY_KNOWLEDGE = `
--- COMPANY KNOWLEDGE BASE ---
Legal Name: Everest Ventures Group LLC
Trade Name: The Residential Address
Website: https://www.theresidentialaddress.com
Target Audience: International, non-US founders (SaaS, E-commerce, Digital Nomads from India, UAE, Malaysia, France, etc.)
Core Services:
1. Compliant U.S. Residential Addresses ($79/mo) - Real physical addresses with signed leases and utility bills that pass bank KYC and Stripe verification.
2. LLC Formation - Setting up US companies (Wyoming recommended for $0 state tax).
3. ITIN Applications ($400) - Processing W-7 IRS forms.
4. Bank Account Assistance - Helping non-US founders get approved for Capital One, Chase, Mercury, etc.
5. US Phone Numbers (eSIM) - Real non-VoIP numbers for bank verification.
Value Proposition: Virtual mailboxes (PO Boxes) get rejected by US banks. We provide real residential leases so founders can access US banking and payment processors legally and instantly.
------------------------------
`;

if (AUTHORIZED_IDS.length === 0) {
    console.error("CRITICAL: AUTHORIZED_TELEGRAM_USER_ID is not set in .env!");
    process.exit(1);
}

const maxSystemPrompt = `
You are Max, Chief AI Officer for Everest Ventures Group LLC. 
You are professional, concise, and helpful. You orchestrate the company and manage website development.

${COMPANY_KNOWLEDGE}

--- INTER-AGENT COMMUNICATION ---
You manage the agent fleet. Acknowledge Asan and MarkBTM's reports. 

IMPORTANT — BE EFFICIENT WITH TOOL CALLS:
You already know the website structure. DO NOT waste tool calls listing directories.
${FILE_MAP}

--- TOOLS ---
- filesystem__... : Use for editing the website.
- generate_pdf: Use this to send reports as PDF files instead of long text if the content is long.
- search_memory / remember_fact: Use for recalling user preferences.
`;

const asanSystemPrompt = `
You are Asan, Head of R&D for "The Residential Address" (TRA).
Objective: Scan Reddit for high-intent leads and push them to Airtable.

--- TOOLS & CAPABILITIES ---
1. **Reddit/Airtable Tools (via RubeMCP)**:
   - RubeMCP__search_posts / RubeMCP__search_comments: Use these to find leads on Reddit.
   - RubeMCP__list_tables / RubeMCP__list_records: Check the Airtable structure.
   - RubeMCP__create_record: Push qualified leads to the 'Reddit Leads' table.
2. **generate_pdf**: 
   - CRITICAL: The user prefers PDF reports over text or Markdown files on Telegram.
   - For LONG results (more than 5 leads), strategy blueprints, or detailed reports, you MUST use generate_pdf.
3. **youtube_summarizer**: Use for transcript analysis.

--- DISCOVERY CRITERIA ---
Look for: "Stripe block", "US residential address", "Mercury bank closure".
Analyze using "Value-First" logic: Instructional value > Sales pitches.

${COMPANY_KNOWLEDGE}
`;

const markBtmSystemPrompt = `
You are MarkBTM, Head of Sales for "The Residential Address".
Objective: Execute the "Reply + DM" outreach loop using RubeMCP tools.

--- TOOLS & CAPABILITIES ---
1. **Reddit API (via RubeMCP)**:
   - RubeMCP__reddit_submit_comment: Reply to instructional threads.
   - RubeMCP__reddit_submit_message: Send DMs to interested users.
2. **Airtable (via RubeMCP)**:
   - RubeMCP__list_records: Check for 'Approved' leads in the 'Reddit Leads' table.
3. **generate_pdf**: Use for sending outreach scheduling or performance reports.

--- LOGIC ---
Step 1: Post the "How-To" blueprint to the Reddit thread.
Step 2: Send a safe "Nudge DM" (Spintax recommended).
NEVER include links in the first DM. Use G2G Aged Accounts (1000+ Karma) advantage.

${COMPANY_KNOWLEDGE}
`;

const vikasSystemPrompt = `
You are Vikas, Head of Marketing. You focus on creative assets and ad strategy.
- generate_image: Create marketing assets. Perform QC on your own images!
- generate_pdf: Use this for marketing strategy reports or ad performance audits.

${COMPANY_KNOWLEDGE}
`;

const ahmadSystemPrompt = `
You are Ahmad, Head of Operations. You minimize friction in onboarding.
- generate_pdf: Use for sending SOPs, operational audits, or flowcharts as PDF.

${COMPANY_KNOWLEDGE}
`;

const botConfigs: { token: string | undefined; context: AgentContext }[] = [
    {
        token: TELEGRAM_BOT_TOKEN,
        context: { name: "Max", systemPrompt: maxSystemPrompt, allowMcpFilesystem: true }
    },
    {
        token: TELEGRAM_ASAN_TOKEN,
        context: { name: "Asan", systemPrompt: asanSystemPrompt, allowMcpFilesystem: false }
    },
    {
        token: TELEGRAM_MARK_BTM_TOKEN,
        context: { name: "MarkBTM", systemPrompt: markBtmSystemPrompt, allowMcpFilesystem: false }
    },
    {
        token: TELEGRAM_VIKAS_TOKEN,
        context: { name: "Vikas", systemPrompt: vikasSystemPrompt, allowMcpFilesystem: false }
    },
    {
        token: TELEGRAM_AHMAD_TOKEN,
        context: { name: "Ahmad", systemPrompt: ahmadSystemPrompt, allowMcpFilesystem: false }
    }
];

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function startMultiAgentFleet() {
    if (!IS_PRODUCTION) {
        console.log("🔌 Connecting to MCP Servers...");
        await mcpManager.loadConfigAndConnect();
        startAutoBackup(15);
    }

    const activeBots = botConfigs.filter(b => b.token);
    if (activeBots.length === 0) {
        console.error("CRITICAL: No valid Bot Tokens found in .env!");
        process.exit(1);
    }

    for (const b of activeBots) {
        try {
            const bot = new Bot(b.token!);

            bot.use(async (ctx, next) => {
                const senderId = ctx.from?.id;
                const chatId = ctx.chat?.id;
                const isAuthorized = (senderId && AUTHORIZED_IDS.includes(senderId)) || (chatId && AUTHORIZED_IDS.includes(chatId));

                if (!isAuthorized) {
                    console.warn(`[BLOCKED] Message from: ${senderId} | Chat: ${chatId}`);
                    return;
                }
                await next();
            });

            const chatFocusState = new Map<number, boolean>();

            bot.on(["message:text", "message:photo"], async (ctx) => {
                const incomingText = ctx.message.text || ctx.message.caption || "";
                const chatId = ctx.chat.id;
                const isGroupChat = chatId < 0;

                if (isGroupChat) {
                    const botUsername = ctx.me.username?.toLowerCase() || "";
                    const msgLower = incomingText.toLowerCase();
                    const isMentioned = msgLower.includes(`@${botUsername}`);
                    const isNamed = msgLower.includes(b.context.name.toLowerCase());
                    const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.me.id;
                    const otherNames = ["max", "asan", "mark", "vikas", "ahmad"].filter(n => n !== b.context.name.toLowerCase());
                    const mentionsOther = otherNames.some(name => msgLower.includes(name));

                    let isActive = chatFocusState.get(chatId) || false;
                    if (isMentioned || isNamed || isReplyToBot) {
                        isActive = true;
                        chatFocusState.set(chatId, true);
                    } else if (mentionsOther) {
                        isActive = false;
                        chatFocusState.set(chatId, false);
                    }
                    if (!isActive) return;
                }

                console.log(`[RCVD ${b.context.name}] User: ${ctx.from.id} -> ${incomingText || "[Photo]"}`);
                await ctx.replyWithChatAction("typing");

                try {
                    const userParts: any[] = [];
                    if (incomingText) userParts.push({ text: incomingText });
                    if (ctx.message.photo && ctx.message.photo.length > 0) {
                        const photo = ctx.message.photo[ctx.message.photo.length - 1];
                        const file = await ctx.api.getFile(photo.file_id);
                        if (file.file_path) {
                            const url = `https://api.telegram.org/file/bot${b.token}/${file.file_path}`;
                            const response = await fetch(url);
                            const arrayBuffer = await response.arrayBuffer();
                            userParts.push({
                                inlineData: {
                                    data: Buffer.from(arrayBuffer).toString('base64'),
                                    mimeType: "image/jpeg"
                                }
                            });
                        }
                    }

                    const agentReply = await processAgentMessage(
                        userParts,
                        chatId.toString(),
                        b.context,
                        async (progress) => { await ctx.reply(progress); },
                        async (pPath) => { await ctx.replyWithPhoto(new InputFile(pPath)); },
                        async (fPath, fName) => { await ctx.replyWithDocument(new InputFile(fPath, fName)); }
                    );

                    if (agentReply.length > 4000) {
                        const tempPath = path.join(process.cwd(), "temp_reports", `response_${Date.now()}.md`);
                        if (!fs.existsSync(path.dirname(tempPath))) fs.mkdirSync(path.dirname(tempPath), { recursive: true });
                        fs.writeFileSync(tempPath, agentReply);
                        await ctx.reply("The response is too long for Telegram. Sending as a file instead:");
                        await ctx.replyWithDocument(new InputFile(tempPath, "response.md"));
                    } else {
                        await ctx.reply(agentReply);
                    }
                } catch (error) {
                    console.error(`[ERROR ${b.context.name}]`, error);
                    await ctx.reply("⚠️ An error occurred while processing your request.");
                }
            });

            bot.start();
            console.log(`🤖 Started bot: ${b.context.name}`);
        } catch (error) {
            console.error(`Failed to start bot ${b.context.name}:`, error);
        }
    }

    console.log(`
🦅 Gravity Claw Fleet initialized.
🔒 Authorized IDs: ${AUTHORIZED_IDS.join(", ")}
⚡ Polling Telegram...
`);
}

startMultiAgentFleet();

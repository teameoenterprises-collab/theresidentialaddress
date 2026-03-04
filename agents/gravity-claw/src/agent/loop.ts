import { GoogleGenAI, Content } from "@google/genai";
import { executeGetTime, getTimeToolDefinition } from "../tools/time.js";
import {
    rememberFactToolDefinition,
    searchMemoryToolDefinition,
    executeRememberFact,
    executeSearchMemory
} from "../tools/memory.js";
import { deployToolDefinition, executeDeploy } from "../tools/deploy.js";
import { mcpManager } from "../tools/mcp.js";
import { saveChatHistory, loadChatHistory } from "../memory/db.js";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const MAX_ITERATIONS = 15;
const MAX_HISTORY_TURNS = 20; // Keep last 20 turns per chat to avoid token overflow

// ─── Website File Map (baked into prompt to avoid wasteful directory scans) ──
const WEBSITE_ROOT = "/Users/tahmidnur/.gemini/antigravity/scratch/theresidentialaddress";
const FILE_MAP = `
WEBSITE ROOT: ${WEBSITE_ROOT}
KEY FILES (use these exact paths with filesystem__read_text_file and filesystem__edit_file):
- ${WEBSITE_ROOT}/index.html              (Homepage / landing page)
- ${WEBSITE_ROOT}/llc-formation.html       (LLC Formation service page)
- ${WEBSITE_ROOT}/bank-assistance.html     (Bank Account Assistance page)
- ${WEBSITE_ROOT}/itin-application.html    (ITIN Application service page)
- ${WEBSITE_ROOT}/us-phone.html            (US Phone service page)
- ${WEBSITE_ROOT}/us-address-service.html  (US Address service page)
- ${WEBSITE_ROOT}/style.css                (Global stylesheet)
`.trim();

// ─── Chat History (SQLite-Backed) ───────────────────────────────────────────
// In-memory cache, loaded from SQLite on first access, saved after each message
const chatHistoryCache = new Map<string, Content[]>();

function getHistory(chatId: string): Content[] {
    if (!chatHistoryCache.has(chatId)) {
        // Load from SQLite on first access (survives restarts!)
        const persisted = loadChatHistory(chatId) as Content[];
        chatHistoryCache.set(chatId, persisted);
        if (persisted.length > 0) {
            console.log(`[HISTORY] Restored ${persisted.length} entries for chat ${chatId} from SQLite.`);
        }
    }
    return chatHistoryCache.get(chatId)!;
}

function saveAndTrimHistory(chatId: string) {
    const history = getHistory(chatId);
    const maxEntries = MAX_HISTORY_TURNS * 2;
    if (history.length > maxEntries) {
        const trimmed = history.slice(history.length - maxEntries);
        chatHistoryCache.set(chatId, trimmed);
    }
    // Persist to SQLite
    saveChatHistory(chatId, chatHistoryCache.get(chatId)!);
}

// ─── Agent Loop ─────────────────────────────────────────────────────────────
export async function processAgentMessage(userMessage: string, chatId: string, onProgress?: (msg: string) => Promise<void>): Promise<string> {

    // Multi-Agent Router
    let SYSTEM_PROMPT = `You are a helpful and concise AI assistant.`;

    if (chatId === process.env.HQ_GROUP_ID) {
        SYSTEM_PROMPT = `
You are Max, Chief of Staff for 'The Residential Address' businesses.
You are professional, concise, and helpful. You manage your creator's business.

IMPORTANT — BE EFFICIENT WITH TOOL CALLS:
You already know the website structure. DO NOT waste tool calls listing directories or searching for files.
Go directly to reading and editing the file you need.

${FILE_MAP}

LIVE SITE URL: https://www.theresidentialaddress.com
When the user asks for a link, send them the live URL for the page you edited. Examples:
- Homepage:       https://www.theresidentialaddress.com/
- LLC Formation:  https://www.theresidentialaddress.com/llc-formation.html
- Bank Assistance: https://www.theresidentialaddress.com/bank-assistance.html
- ITIN:           https://www.theresidentialaddress.com/itin-application.html
- US Phone:       https://www.theresidentialaddress.com/us-phone.html
- US Address:     https://www.theresidentialaddress.com/us-address-service.html

WORKFLOW for editing website content:
1. Use filesystem__read_text_file with the exact path above to read the file.
2. Use filesystem__edit_file to make targeted changes (provide old_text and new_text).
3. Confirm what you changed, and send the live URL for the page.
4. If the user wants it live immediately, use deploy_website to push changes.

Other tools:
- deploy_website: commits and pushes changes to make them live.
- search_memory / remember_fact: for business facts and preferences.
- get_current_time: for current time.
`;
    } else if (chatId === process.env.PERSONAL_GROUP_ID) {
        SYSTEM_PROMPT = `
You are a Personal Researcher and Assistant.
You handle general questions, look up facts, and assist with personal tasks.
If you need current time, use the get_current_time tool.
`;
    } else {
        // Fallback for direct messages to the bot
        SYSTEM_PROMPT = `
You are Gravity Claw, a personal agent serving your creator.
You are secure, concise, and helpful.
If you need current time, use the get_current_time tool.
You have access to the project filesystem via MCP tools (prefixed with 'filesystem__').
`;
    }

    // --- Dynamically gather MCP tools ---
    const mcpToolMap = new Map<string, { serverName: string; originalName: string }>();
    const mcpFunctionDeclarations: any[] = [];

    try {
        const mcpTools = await mcpManager.getAllTools();
        for (const tool of mcpTools) {
            mcpToolMap.set(tool.geminiTool.name, {
                serverName: tool.serverName,
                originalName: tool.originalName
            });
            mcpFunctionDeclarations.push(tool.geminiTool);
        }
        if (mcpFunctionDeclarations.length > 0) {
            console.log(`[AGENT] Loaded ${mcpFunctionDeclarations.length} MCP tool(s): ${mcpFunctionDeclarations.map((t: any) => t.name).join(', ')}`);
        }
    } catch (err) {
        console.error("[AGENT] Failed to load MCP tools, continuing with native tools only.", err);
    }

    // Combine native + MCP tool declarations
    const allFunctionDeclarations = [
        getTimeToolDefinition,
        rememberFactToolDefinition,
        searchMemoryToolDefinition,
        deployToolDefinition,
        ...mcpFunctionDeclarations
    ];

    // Retrieve conversation history for this chat (loaded from SQLite if first access)
    const history = getHistory(chatId);

    // Create a chat session WITH history so Max remembers previous messages
    const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{
                functionDeclarations: allFunctionDeclarations
            }],
            temperature: 0.2,
        },
        history: history.length > 0 ? history : undefined,
    });

    let iteration = 0;
    // Send the initial user message
    let response = await chat.sendMessage({ message: userMessage });

    while (iteration < MAX_ITERATIONS) {
        iteration++;

        // 1. Handle Tool Calls
        if (response.functionCalls && response.functionCalls.length > 0) {
            console.log(`[AGENT] Iteration ${iteration}: Calling ${response.functionCalls.length} tool(s)...`);

            if (onProgress && response.functionCalls[0]?.name) {
                const cName = response.functionCalls[0].name;
                let progressMsg = "⏳ Processing...";
                if (cName.includes("read")) progressMsg = "📖 Reading files...";
                else if (cName.includes("edit") || cName.includes("write")) progressMsg = "✏️ Editing files...";
                else if (cName.includes("deploy")) progressMsg = "🚀 Deploying updates...";
                else if (cName.includes("search")) progressMsg = "🔍 Searching...";
                else progressMsg = `🛠 Running tool: ${cName.replace("filesystem__", "")}`;

                await onProgress(progressMsg).catch(console.error);
            }

            const toolResults = [];
            for (const call of response.functionCalls) {
                let result: any;

                // --- Native Tools ---
                if (call.name === "get_current_time") {
                    result = await executeGetTime();
                } else if (call.name === "remember_fact") {
                    const args = call.args as unknown as { fact: string; category: string };
                    result = await executeRememberFact(args);
                } else if (call.name === "search_memory") {
                    const args = call.args as unknown as { query: string };
                    result = await executeSearchMemory(args);
                } else if (call.name === "deploy_website") {
                    const args = call.args as unknown as { commit_message: string };
                    result = await executeDeploy(args);
                }
                // --- MCP Tools (Dynamic Routing) ---
                else if (mcpToolMap.has(call.name!)) {
                    const mapping = mcpToolMap.get(call.name!)!;
                    console.log(`[MCP] Routing ${call.name} -> ${mapping.serverName}::${mapping.originalName}`);
                    try {
                        const mcpResult = await mcpManager.executeTool(
                            mapping.serverName,
                            mapping.originalName,
                            call.args || {}
                        );
                        // MCP results come as content array, extract text
                        if (mcpResult.content && Array.isArray(mcpResult.content)) {
                            result = (mcpResult.content as any[])
                                .filter((c: any) => c.type === "text")
                                .map((c: any) => c.text)
                                .join("\n");
                        } else {
                            result = JSON.stringify(mcpResult);
                        }
                    } catch (mcpErr) {
                        console.error(`[MCP] Error executing ${call.name}:`, mcpErr);
                        result = `Error executing MCP tool: ${mcpErr}`;
                    }
                } else {
                    result = `Unknown tool: ${call.name}`;
                }

                toolResults.push({
                    functionResponse: {
                        name: call.name,
                        response: { result }
                    }
                });
            }
            // Send the results back to the model
            response = await chat.sendMessage({
                message: toolResults
            });
        } else {
            // 2. Handle final text response
            const finalText = response.text?.trim();

            if (finalText) {
                // Save conversation turn to history + persist to SQLite
                history.push({ role: "user", parts: [{ text: userMessage }] });
                history.push({ role: "model", parts: [{ text: finalText }] });
                saveAndTrimHistory(chatId);

                return finalText;
            } else {
                // Edge case: model returned neither tools nor text
                console.warn(`[AGENT] Iteration ${iteration}: No text and no tool calls. Nudging model for a summary...`);
                response = await chat.sendMessage({
                    message: "Please provide a summary of what you just did, or if you encountered an issue, explain what happened."
                });
            }
        }
    }

    // Save even if we hit max iterations
    history.push({ role: "user", parts: [{ text: userMessage }] });
    history.push({ role: "model", parts: [{ text: "I was working on your request but it required too many steps. Please try breaking it into smaller tasks." }] });
    saveAndTrimHistory(chatId);

    return "⚠️ I was working on your request but it required too many steps. Try breaking it into a smaller task (e.g., 'Read us-phone.html' first, then 'Update the hero section to say X').";
}

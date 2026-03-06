import { GoogleGenAI, Content } from "@google/genai";
import { executeGetTime, getTimeToolDefinition } from "../tools/time.js";
import {
    rememberFactToolDefinition,
    searchMemoryToolDefinition,
    executeRememberFact,
    executeSearchMemory
} from "../tools/memory.js";
import { deployToolDefinition, executeDeploy } from "../tools/deploy.js";
import { generateImageToolDefinition, executeGenerateImage } from "../tools/image.js";
import { mcpManager } from "../tools/mcp.js";
import { saveChatHistory, loadChatHistory } from "../memory/db.js";
import { mdToPdf } from "md-to-pdf";
import fs from "fs";
import path from "path";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

const MAX_ITERATIONS = 15;
const MAX_HISTORY_TURNS = 20; // Keep last 20 turns per chat to avoid token overflow

// ─── Website File Map (baked into prompt to avoid wasteful directory scans) ──
const WEBSITE_ROOT = "/Users/tahmidnur/.gemini/antigravity/scratch/theresidentialaddress";
export const FILE_MAP = `
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

function getHistory(chatId: string, botName: string): Content[] {
    const compositeKey = `${botName}_${chatId}`;
    if (!chatHistoryCache.has(compositeKey)) {
        // Load from SQLite on first access (survives restarts!)
        const persisted = loadChatHistory(compositeKey) as Content[];
        chatHistoryCache.set(compositeKey, persisted);
        if (persisted.length > 0) {
            console.log(`[HISTORY] Restored ${persisted.length} entries for ${botName} in chat ${chatId} from SQLite.`);
        }
    }
    return chatHistoryCache.get(compositeKey)!;
}

function saveAndTrimHistory(chatId: string, botName: string) {
    const compositeKey = `${botName}_${chatId}`;
    const history = getHistory(chatId, botName);
    const maxEntries = MAX_HISTORY_TURNS * 2;
    if (history.length > maxEntries) {
        const trimmed = history.slice(history.length - maxEntries);
        chatHistoryCache.set(compositeKey, trimmed);
    }
    // Persist to SQLite
    saveChatHistory(compositeKey, chatHistoryCache.get(compositeKey)!);
}

export interface AgentContext {
    name: string;
    systemPrompt: string;
    allowMcpFilesystem: boolean;
}

export const ALL_BOT_NAMES = ["Max", "Asan", "MarkBTM", "Vikas", "Ahmad"];

export function injectMemoryToOtherBots(chatId: string, senderBotName: string, text: string) {
    const messageToInject = `[${senderBotName}]: ${text}`;

    for (const botName of ALL_BOT_NAMES) {
        if (botName === senderBotName) continue;

        // Retrieve the other bot's history (loads from SQLite if not in cache)
        const otherHistory = getHistory(chatId, botName);

        // Inject the message as if the user said it (so the bot reads it as context)
        otherHistory.push({ role: "user", parts: [{ text: messageToInject }] });
        // Add a blank model response to maintain the strict alternating user/model/user/model array structure required by Gemini
        otherHistory.push({ role: "model", parts: [{ text: "(Acknowledged internally)" }] });

        saveAndTrimHistory(chatId, botName);
    }
}

// ─── Agent Loop ─────────────────────────────────────────────────────────────
export async function processAgentMessage(
    userParts: any[],
    chatId: string,
    agentContext: AgentContext,
    onProgress?: (msg: string) => Promise<void>,
    onPhoto?: (path: string) => Promise<void>,
    onFile?: (path: string, filename: string) => Promise<void>
): Promise<string> {

    const SYSTEM_PROMPT = agentContext.systemPrompt;

    // --- Dynamically gather MCP tools ---
    const mcpToolMap = new Map<string, { serverName: string; originalName: string }>();
    const mcpFunctionDeclarations: any[] = [];

    try {
        const mcpTools = await mcpManager.getAllTools();
        for (const tool of mcpTools) {
            // If it's a filesystem tool, only add it if allowed
            if (tool.serverName === 'filesystem' && !agentContext.allowMcpFilesystem) {
                continue;
            }

            mcpToolMap.set(tool.geminiTool.name, {
                serverName: tool.serverName,
                originalName: tool.originalName
            });
            mcpFunctionDeclarations.push(tool.geminiTool);
        }
        if (mcpFunctionDeclarations.length > 0) {
            console.log(`[${agentContext.name}] Loaded ${mcpFunctionDeclarations.length} MCP tool(s)`);
        }
    } catch (err) {
        console.error(`[${agentContext.name}] Failed to load MCP tools.`, err);
    }

    // Combine native + conditionally loaded MCP tool declarations
    const allFunctionDeclarations = [
        getTimeToolDefinition,
        rememberFactToolDefinition,
        searchMemoryToolDefinition,
        deployToolDefinition,
        {
            name: "generate_pdf",
            description: "Converts a Markdown string into a PDF and sends it to the user. Use this for multi-lead reports or long strategy documents to improve readability on mobile.",
            parameters: {
                type: "object",
                properties: {
                    markdown: { type: "string", description: "The full markdown content to convert." },
                    filename: { type: "string", description: "The desired filename (e.g., reddit_leads.pdf)." }
                },
                required: ["markdown", "filename"]
            }
        },
        ...mcpFunctionDeclarations
    ];

    if (agentContext.name === "Vikas") {
        allFunctionDeclarations.push(generateImageToolDefinition as any);
    }

    // Retrieve conversation history for this specific bot in this chat
    const history = getHistory(chatId, agentContext.name);

    // Create a chat session WITH history so Max remembers previous messages
    const genModel = ai.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: SYSTEM_PROMPT,
        tools: [{
            functionDeclarations: allFunctionDeclarations
        }],
    });

    const chat = genModel.startChat({
        history: history.length > 0 ? history : undefined,
        generationConfig: {
            temperature: 0.2,
        }
    });

    let iteration = 0;
    let lastGeneratedImagePath: string | null = null;

    // Send the initial user message
    let chatResponse = await chat.sendMessage(userParts);
    let currentResponse = chatResponse.response;

    while (iteration < MAX_ITERATIONS) {
        iteration++;

        // 1. Handle Tool Calls
        const calls = currentResponse.functionCalls();
        if (calls && calls.length > 0) {
            console.log(`[${agentContext.name}] Iteration ${iteration}: Calling ${calls.length} tool(s)...`);

            if (onProgress && calls[0]?.name) {
                const cName = calls[0].name;
                let progressMsg = "⏳ Processing...";
                if (cName.includes("read")) progressMsg = "📖 Reading files...";
                else if (cName.includes("edit") || cName.includes("write")) progressMsg = "✏️ Editing files...";
                else if (cName.includes("deploy")) progressMsg = "🚀 Deploying updates...";
                else if (cName.includes("search")) progressMsg = "🔍 Searching...";
                else progressMsg = `🛠 Running tool: ${cName.replace("filesystem__", "")}`;

                await onProgress(progressMsg).catch(console.error);
            }

            const toolResults = [];
            for (const call of calls) {
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
                } else if (call.name === "generate_image") {
                    const args = call.args as unknown as { prompt: string };
                    const res = await executeGenerateImage(args);
                    if (typeof res === "object" && res.type === "image") {
                        if (onPhoto) {
                            await onPhoto(res.path).catch(console.error);
                        }
                        result = "Image successfully generated and sent to the chat.";
                        lastGeneratedImagePath = res.path;
                    } else {
                        result = res; // string error
                    }
                } else if (call.name === "generate_pdf") {
                    const args = call.args as unknown as { markdown: string; filename: string };
                    try {
                        console.log(`[${agentContext.name}] Generating PDF: ${args.filename}`);
                        let safeFilename = args.filename || `report_${Date.now()}.pdf`;
                        if (!safeFilename.toLowerCase().endsWith(".pdf")) safeFilename += ".pdf";

                        const reportsDir = path.join(process.cwd(), "temp_reports");
                        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

                        const pdfPath = path.join(reportsDir, safeFilename);

                        // @ts-ignore
                        const pdfResult = await mdToPdf({ content: args.markdown }).catch(err => {
                            console.error("mdToPdf Internal Error:", err);
                            throw err;
                        });

                        if (pdfResult && pdfResult.content) {
                            fs.writeFileSync(pdfPath, pdfResult.content);
                            if (onFile) {
                                await onFile(pdfPath, safeFilename);
                                result = `✅ PDF successfully generated and sent to user as "${safeFilename}".`;
                            } else {
                                result = "⚠️ PDF generated but could not be sent (file handler missing).";
                            }
                        } else {
                            result = "❌ Failed to generate PDF: md-to-pdf returned empty content.";
                        }
                    } catch (e: any) {
                        console.error("PDF Generation Error Details:", e);
                        result = `❌ Error generating PDF: ${e.message || e}`;
                    }
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
            chatResponse = await chat.sendMessage(toolResults);
            currentResponse = chatResponse.response;
        } else {
            // 2. Handle final text response
            let finalText = "";
            try {
                finalText = currentResponse.text()?.trim() || "";
            } catch (e) {
                console.warn(`[${agentContext.name}] Response text() failed (likely empty or tool-only).`);
            }

            if (finalText) {
                // Save conversation turn to history + persist to SQLite
                history.push({ role: "user", parts: userParts });
                history.push({ role: "model", parts: [{ text: finalText }] });

                if (lastGeneratedImagePath) {
                    try {
                        const imgBuf = fs.readFileSync(lastGeneratedImagePath);
                        history.push({
                            role: "user",
                            parts: [
                                { text: "System Notification: Here is the image you just generated. Please review it carefully to ensure the spelling and design meet requirements." },
                                {
                                    inlineData: {
                                        data: imgBuf.toString("base64"),
                                        mimeType: "image/jpeg"
                                    }
                                }
                            ]
                        });
                        history.push({ role: "model", parts: [{ text: "(Image received and stored in visual memory)" }] });
                    } catch (e) {
                        console.error("Failed to load generated image to memory:", e);
                    }
                    lastGeneratedImagePath = null;
                }

                saveAndTrimHistory(chatId, agentContext.name);

                // --- HIVE MIND INJECTION ---
                injectMemoryToOtherBots(chatId, agentContext.name, finalText);

                return finalText;
            } else {
                // Edge case: model returned neither tools nor text
                console.warn(`[${agentContext.name}] Iteration ${iteration}: No text and no tool calls. Nudging model for a summary...`);
                chatResponse = await chat.sendMessage("Please provide a summary of what you just did, or if you encountered an issue, explain what happened.");
                currentResponse = chatResponse.response;
            }
        }
    }

    // Save even if we hit max iterations
    history.push({ role: "user", parts: userParts });
    history.push({ role: "model", parts: [{ text: "I was working on your request but it required too many steps. Please try breaking it into smaller tasks." }] });
    saveAndTrimHistory(chatId, agentContext.name);

    return "⚠️ I was working on your request but it required too many steps. Try breaking it into a smaller task.";
}

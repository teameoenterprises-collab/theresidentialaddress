import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function listModels() {
    console.log("Listing available models...");
    let response = await ai.models.list();
    for await (const model of response) {
        console.log(model.name);
    }
}

listModels();

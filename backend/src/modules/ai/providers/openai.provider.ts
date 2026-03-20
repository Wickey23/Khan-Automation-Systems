import { env } from "../../../config/env";
import type { AiProvider, CompletionInput, CompletionOutput } from "./provider.interface";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export class OpenAiProvider implements AiProvider {
  key = "openai";

  async complete(input: CompletionInput): Promise<CompletionOutput> {
    const model = input.model || env.AI_OPS_DEFAULT_MODEL || "gpt-4o-mini";

    if (!env.OPENAI_API_KEY) {
      // Deterministic fallback keeps flows operational in lower envs.
      return {
        text: `Draft response (offline fallback): ${input.userPrompt.slice(0, 400)}`,
        provider: this.key,
        model
      };
    }

    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 600,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OPENAI_ERROR:${response.status}:${body.slice(0, 240)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };

    const text = String(payload.choices?.[0]?.message?.content || "").trim();
    return {
      text,
      provider: this.key,
      model: payload.model || model
    };
  }
}

export const openAiProvider = new OpenAiProvider();

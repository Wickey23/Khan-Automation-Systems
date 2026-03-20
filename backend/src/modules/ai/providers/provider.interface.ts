export type CompletionInput = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type CompletionOutput = {
  text: string;
  provider: string;
  model: string;
};

export interface AiProvider {
  key: string;
  complete(input: CompletionInput): Promise<CompletionOutput>;
}

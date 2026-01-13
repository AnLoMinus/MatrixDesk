export {};

declare global {
  interface Window {
    ai: {
      generate: (payload: {
        provider: "gemini" | "ollama";
        prompt: string;
        config?: Record<string, unknown>;
      }) => Promise<unknown>;
    };
  }
}

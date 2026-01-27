type OllamaConfig = {
  baseUrl?: string;
  model?: string;
};

export async function generateOllama(prompt: string, config?: OllamaConfig) {
  const baseUrl = config?.baseUrl || "http://localhost:11434";
  const model = config?.model || "llama3.1";

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false })
  });

  return res.json();
}

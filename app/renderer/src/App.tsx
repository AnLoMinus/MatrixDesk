import { useState } from "react";

const defaultPrompt = "הכנס טקסט לניתוח";

export default function App() {
  const [provider, setProvider] = useState<"gemini" | "ollama">("gemini");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [result, setResult] = useState<string>("");

  const handleAnalyze = async () => {
    const data = await window.ai.generate({
      provider,
      prompt,
      config: { model: provider === "gemini" ? "gemini-2.5-flash" : "llama3.1" }
    });

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    setResult(rawText || JSON.stringify(data, null, 2));
  };

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>MatrixDesk</h1>
      <label style={{ display: "block", marginBottom: 12 }}>
        Provider
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as "gemini" | "ollama")}
          style={{ marginLeft: 8 }}
        >
          <option value="gemini">Gemini (Cloud)</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
      </label>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={6}
        style={{ width: "100%", marginBottom: 12 }}
      />
      <button type="button" onClick={handleAnalyze}>
        Analyze
      </button>
      <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{result}</pre>
    </main>
  );
}

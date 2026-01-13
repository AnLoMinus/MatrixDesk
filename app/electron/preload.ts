import { contextBridge, ipcRenderer } from "electron";

type GeneratePayload = {
  provider: "gemini" | "ollama";
  prompt: string;
  config?: Record<string, unknown>;
};

contextBridge.exposeInMainWorld("ai", {
  generate: (payload: GeneratePayload) => ipcRenderer.invoke("ai:generate", payload)
});

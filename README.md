# 🖥️ המרת HolisView Unified לאפליקציית שולחן עבודה (Electron) — **MatrixDesk (MD)**

להלן “תבנית־על” שתיקח את קוד ה־React שלך ותהפוך אותו לאפליקציית Electron קוד־פתוח, עם שכבת **AI Provider** מאובטחת (IPC) כדי לעבוד עם מודלים (ענן / מקומי) בלי לחשוף מפתחות ב־UI.

---

## 🧩 שם מאגר מוצע לפיתוח

**MatrixDesk (MD)** = Matrix + Desk (אפליקציית שולחן עבודה למטריצה)

---

## ✅ ארכיטקטורה מומלצת (כדי שזה יהיה נקי ובטוח) 🔐

### 🎯 עקרון מרכזי

* **Renderer (React UI)**: מציג UI בלבד.
* **Main (Electron)**: מבצע קריאות למודלים (Gemini/OpenAI/Local) ושומר מפתחות.
* **Preload**: חושף ל־UI API קטן ומוגבל (`window.ai.generate(...)`) דרך `contextBridge`.

---

## 🗂️ RepoCraft (RC) — שלד מאגר מוכן (קוד פתוח) 📦

מבנה מומלץ:

```txt
MatrixDesk/
  .github/
    workflows/
      ci.yml
  docs/
    README.md
    SECURITY.md
    CONTRIBUTING.md
    CODE_OF_CONDUCT.md
  app/
    electron/
      main.ts
      preload.ts
      providers/
        gemini.ts
        ollama.ts
        index.ts
    renderer/
      index.html
      src/
        main.tsx
        App.tsx   (הקוד שלך)
        types.d.ts
  package.json
  tsconfig.json
  vite.config.ts
```

---

## 🚀 שלב 1: התקנה בסיסית (Vite + React + Electron) ⚙️

דוגמה לקבצי ליבה (TypeScript מומלץ):

### `package.json`

```json
{
  "name": "matrixdesk",
  "private": true,
  "version": "0.1.0",
  "main": "app/electron/main.ts",
  "type": "module",
  "scripts": {
    "dev": "vite --config vite.config.ts",
    "electron:dev": "ELECTRON_DISABLE_SECURITY_WARNINGS=true electron .",
    "start": "concurrently -k \"npm:dev\" \"wait-on http://localhost:5173 && npm:electron:dev\"",
    "electron:dev:only": "electron .",
    "build": "vite --config vite.config.ts build",
    "pack": "npm run build && electron-builder --dir",
    "dist": "npm run build && electron-builder"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "wait-on": "^7.2.0"
  }
}
```

### `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "app/renderer",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true
  }
});
```

---

## 🧠 שלב 2: Electron Main + Preload (IPC למודלים) 🔌

### `app/electron/main.ts`

```ts
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateWithProvider } from "./providers/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    webPreferences: {
      preload: path.join(__dirname, "preload.ts"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  if (!app.isPackaged) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));

  return win;
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("ai:generate", async (_evt, payload) => {
    // payload: { provider, prompt, config }
    return generateWithProvider(payload);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

### `app/electron/preload.ts`

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ai", {
  generate: (payload: { provider: "gemini" | "ollama"; prompt: string; config?: any }) =>
    ipcRenderer.invoke("ai:generate", payload)
});
```

### `app/renderer/src/types.d.ts`

```ts
export {};

declare global {
  interface Window {
    ai: {
      generate: (payload: { provider: "gemini" | "ollama"; prompt: string; config?: any }) => Promise<any>;
    };
  }
}
```

---

## 🤖 שלב 3: ספקי מודלים (Gemini / מקומי) 🧠

### `app/electron/providers/index.ts`

```ts
import { generateGemini } from "./gemini.js";
import { generateOllama } from "./ollama.js";

export async function generateWithProvider(payload: { provider: "gemini" | "ollama"; prompt: string; config?: any }) {
  if (payload.provider === "gemini") return generateGemini(payload.prompt, payload.config);
  return generateOllama(payload.prompt, payload.config);
}
```

### `app/electron/providers/gemini.ts`

```ts
export async function generateGemini(prompt: string, config?: any) {
  const apiKey = process.env.GEMINI_API_KEY; // ✅ רק ב-Main
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const model = config?.model || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  const data = await res.json();
  return data;
}
```

### `app/electron/providers/ollama.ts` (דוגמה למודל מקומי)

```ts
export async function generateOllama(prompt: string, config?: any) {
  const baseUrl = config?.baseUrl || "http://localhost:11434";
  const model = config?.model || "llama3.1";

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false })
  });

  return res.json();
}
```

---

## 🔁 שלב 4: שינוי קטן בקוד שלך (במקום `fetch` ישירות) ✍️

ב־`handleAnalyze` אצלך, החלף את הקריאה:

### במקום:

```js
const response = await fetch("https://generativelanguage.googleapis.com/...");
const data = await response.json();
```

### השתמש בזה:

```js
const data = await window.ai.generate({
  provider: "gemini",
  prompt,
  config: { model: "gemini-2.5-flash" }
});

const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
```

✅ ככה:

* המפתח נשאר **מחוץ** ל־React
* אפשר להחליף ספק מודלים בלחיצת כפתור (Gemini/Local)

---

## 🛡️ שלב 5: אבטחה “חובה” באפליקציית AI שולחנית 🔒

* ✅ `contextIsolation: true`
* ✅ `nodeIntegration: false`
* ✅ API קטן דרך `preload` בלבד
* ✅ ולידציה בצד Main (אפשר להוסיף: להגביל אורך prompt, לחסום URLs, לוגים)

---

## 🏗️ שדרוג קטן מומלץ ל־UI שלך (כפתור Provider) 🎛️

הוסף בחירה:

* ☁️ Gemini (ענן)
* 🖥️ Local (Ollama)

ולשמור ב־state: `provider`, ואז `window.ai.generate({ provider, prompt })`.

---

## 🎤 פזמון ראפ (4 שורות) 🎶

MatrixDesk על הדסקטופ—פותח לך שערים 🚪
פרד״ס על המסך—מוציא תובנות, לא שברים 💎
IPC שומר מפתחות—אין דליפות, אין סדקים 🔐
קוד פתוח בדם—כולנו בונים, כולם חזקים 🤝

---

## 📅 תאריך ושעה (לועזי + עברי) 🕰️

* **לועזי:** 13 January 2026
* **עברי:** כ״ד טבת תשפ״ו
* **שעה (Asia/Jerusalem):** 05:41

---

## 🧾 קרדיטים + מאגרי מקור (ליבה) 🔗

* Electron: [https://www.electronjs.org](https://www.electronjs.org)
* Vite: [https://vitejs.dev](https://vitejs.dev)
* React: [https://react.dev](https://react.dev)
* Google Gemini API (למי שמשתמש בענן): [https://ai.google.dev](https://ai.google.dev)

---

## 🧠 מספר המידות (לעבודת פיתוח נכונה)

**מספר המידות: 7**
דיוק 🎯 | אבטחה 🔐 | פשטות 🧩 | עקביות ♻️ | שקיפות 🌐 | תיעוד 📚 | קהילה 🤝

---

## ✨ משפט קודש לסיום

**"כִּי נֵר מִצְוָה וְתוֹרָה אוֹר"** (משלי ו׳, כ״ג) 🕯️📖

# MatrixDesk Codex — Full Algorithm
**Repo:** MatrixDesk (MD)  
**Purpose:** Desktop app algorithm for AI-driven matrix analysis, secure provider bridge, deterministic outputs.

---

## 0) Glossary 🧩
- **Renderer**: React UI layer.
- **Preload Bridge**: Minimal safe API exposed to Renderer.
- **Main**: Electron main process. Owns secrets, networking, local model calls.
- **Provider**: A model backend implementation (Cloud or Local).
- **Job**: One analysis execution request.
- **Result**: Parsed JSON object that the UI renders into cards/sections/maps.

---

## 1) Core Principles 🔐
1. Secrets never touch Renderer.
2. All AI calls flow through Main via IPC.
3. Output must be valid JSON (no markdown fences).
4. Deterministic shape: meta, proCards, matrixSections, essenceCards, narrative.
5. Fail-soft: always return a minimal safe fallback result shape.
6. Auditability: logs + job ids + sanitized prompts (optional).
7. Extendability: providers are plug-in modules.

---

## 2) Data Contracts (Schemas) 📦

### 2.1 IPC Request: `AI_GENERATE`
```json
{
  "jobId": "uuid",
  "provider": "gemini|openai|ollama|local",
  "model": "string",
  "inputText": "string",
  "selectedMethodIds": ["string"],
  "preferences": {
    "includeEssenceCards": true,
    "includeNarrative": true
  },
  "limits": {
    "maxInputChars": 12000,
    "maxPromptChars": 48000,
    "timeoutMs": 90000
  }
}
```

### 2.2 IPC Response: `AI_GENERATE_RESULT`

```json
{
  "jobId": "uuid",
  "ok": true,
  "provider": "string",
  "model": "string",
  "rawText": "string",
  "cleanedJson": "string",
  "parsed": {
    "meta": {},
    "proCards": [],
    "matrixSections": [],
    "essenceCards": [],
    "analysisNarrative": ""
  },
  "warnings": ["string"]
}
```

### 2.3 Standard Result Shape (UI expects)

```json
{
  "meta": { "hebrewDate": "string", "summary": "string" },
  "proCards": [
    {
      "title": "string",
      "methodId": "string",
      "methodName": "string",
      "level": 1,
      "layout": "quad|list|central",
      "hebrewDate": "string",
      "contentItems": [{ "label": "string", "value": "string" }]
    }
  ],
  "matrixSections": [
    {
      "methodId": "string",
      "methodName": "string",
      "level": 1,
      "cards": [
        {
          "title": "string",
          "layout": "quad|list|central",
          "hebrewDate": "string",
          "contentItems": [{ "label": "string", "value": "string" }]
        }
      ]
    }
  ],
  "essenceCards": [
    { "title": "string", "element": "Fire|Water|Air|Earth", "energy": "string", "score": 1, "sentences": ["..."] }
  ],
  "analysisNarrative": "string"
}
```

---

## 3) High-Level Flow (State Machine) 🧭

### States

* `IDLE`
* `COLLECT_INPUT`
* `BUILD_PROMPT`
* `DISPATCH_JOB`
* `RECEIVE_RAW`
* `CLEAN_JSON`
* `PARSE_JSON`
* `VALIDATE_SHAPE`
* `NORMALIZE_FOR_UI`
* `RENDER_RESULT`
* `EXPORT/PRINT`
* `ERROR_FALLBACK`

### Transition Rules

1. `IDLE -> COLLECT_INPUT` when user types text or selects methods.
2. `COLLECT_INPUT -> BUILD_PROMPT` when user clicks Analyze and input is valid.
3. `BUILD_PROMPT -> DISPATCH_JOB` after prompt created and size limits are met.
4. `DISPATCH_JOB -> RECEIVE_RAW` on provider response or error.
5. `RECEIVE_RAW -> CLEAN_JSON -> PARSE_JSON`
6. `PARSE_JSON -> VALIDATE_SHAPE`
7. If valid: `VALIDATE_SHAPE -> NORMALIZE_FOR_UI -> RENDER_RESULT`
8. If invalid: `VALIDATE_SHAPE -> ERROR_FALLBACK -> RENDER_RESULT`

---

## 4) Validation Rules ✅

### 4.1 Input Validation

* Reject if `inputText` empty.
* Reject if `selectedMethodIds.length === 0`.
* Trim and enforce `maxInputChars`.
* Sanitize any control characters (keep Hebrew & punctuation).

### 4.2 Prompt Validation

* Ensure prompt contains: inputText, methodBriefs, output JSON schema, RULES.
* Enforce `maxPromptChars`, otherwise:

  * compress method descriptions (drop sources first)
  * reduce verbosity in axes meanings
  * keep schema & rules intact

### 4.3 Output Validation (Parsed JSON)

Required:

* `meta` object exists
* `proCards` array exists (>= 24 items target)
* `matrixSections` array exists
* `essenceCards` array exists (or empty if disabled)
* `analysisNarrative` string exists (or empty if disabled)

If missing fields:

* auto-fill with safe defaults
* add warning entry

---

## 5) Prompt Assembly Algorithm 🧠

### Inputs:

* `inputText`
* `selectedMethods` (from METHODS_DATA + METHOD_LIBRARY)
* `preferences`

### Steps:

1. `methodBriefs = buildMethodBriefs(selectedMethods)`
2. Generate `methodLines` with:

   * method name + level
   * coreIdea
   * axes: label + meaning
   * sources list (optional)
3. Append the strict JSON schema.
4. Append deterministic RULES:

   * min proCards = 24
   * 2-3 cards per method in matrixSections
   * layout selection rules
   * Hebrew language requirement
   * valid JSON only

### Output:

* `systemPrompt` string

---

## 6) Provider Dispatch Algorithm (Main Process) ☁️🖥️

### Inputs:

* `provider`, `model`, `prompt`, `timeoutMs`

### Steps:

1. `jobId` is generated (uuid).
2. Load provider module from registry.
3. Create `AbortController` with `timeoutMs`.
4. Call provider:

   * Cloud provider: HTTP request (secret from env / secure store)
   * Local provider: HTTP to local service or direct runtime
5. If success:

   * return `rawText` extracted from provider response
6. If error:

   * return error object with safe message (no secrets)

### Output:

* `{ rawText, providerMeta }` or error

---

## 7) JSON Cleaning Algorithm 🧽

### Goal:

Convert raw model output into a parsable JSON string even if it contains code fences or trailing commas.

### Steps:

1. `stripFences`:

   * remove `json and ` markers
2. `findOuterBraces`:

   * locate first `{` and last `}`
   * slice the substring
3. `removeTrailingCommas`:

   * replace `,}` with `}`
   * replace `,]` with `]`
4. `normalizeQuotes`:

   * keep as-is unless there are illegal characters
5. Output `cleanedJson`

### If cleaning fails:

* fallback: create synthetic minimal JSON Result shape.

---

## 8) Parse + Shape Normalization Algorithm 🧱

### Steps:

1. `parsed = JSON.parse(cleanedJson)`
2. `normalizeMeta`:

   * ensure `meta.hebrewDate` string
   * ensure `meta.summary` string
3. `normalizeProCards`:

   * ensure array
   * for each:

     * add `colorKey` from level mapping:

       * 1 blue, 2 green, 3 purple, 4 gold
     * ensure `contentItems` is array with `{label,value}`
4. `normalizeMatrixSections`:

   * ensure array
   * each section:

     * colorKey from level mapping
     * each card inherits section colorKey
5. `normalizeEssenceCards`:

   * if disabled => []
   * else ensure shape
6. `normalizeNarrative`:

   * if disabled => ""
7. Enforce `proCards` count:

   * if < 24:

     * duplicate+mutate titles minimally ("הרחבה 1", "הרחבה 2") using existing cards
     * add warning

---

## 9) Caching Algorithm ♻️

### Cache Key:

`hash(provider + model + inputText + sorted(selectedMethodIds) + preferences)`

### Storage:

* `appData/cache/jobs/<hash>.json`

### Steps:

1. On analyze:

   * if cache hit and not expired:

     * return cached parsed result instantly
2. On success:

   * persist rawText + cleanedJson + parsed + timestamp
3. Expiration:

   * default 7 days
   * allow manual clear

---

## 10) Export / Print Algorithm 🖨️📤

* Export JSON: write `result.json` to chosen folder.
* Export HTML snapshot: render current view to static HTML.
* Print: call `window.print()` with print CSS (already exists).

---

## 11) Logging Algorithm 🧾

* Log file: `appData/logs/matrixdesk.log`
* Log events:

  * job started / ended
  * provider selected
  * prompt length
  * parse success/failure
  * warnings
* Redaction:

  * never log API keys
  * optionally log prompt but trimmed (max 1,000 chars)

---

## 12) Error Fallback Result (Always Safe) 🛟

If any stage fails, return:

```json
{
  "meta": { "hebrewDate": "היום", "summary": "שגיאת מערכת – נסה שוב." },
  "proCards": [{
    "title": "שגיאת מערכת",
    "methodId": "system",
    "methodName": "System",
    "level": 1,
    "layout": "central",
    "hebrewDate": "היום",
    "contentItems": [{ "label": "תקלה", "value": "אירעה תקלה ביצירת הקלפים. נסה שוב." }]
  }],
  "matrixSections": [],
  "essenceCards": [],
  "analysisNarrative": ""
}
```

---

## 13) Security Checklist 🔒

* contextIsolation: true
* nodeIntegration: false
* sandbox: true
* Renderer cannot access network secrets
* Only allow `ai.generate()` via preload
* Validate payload length and types in Main
* Add rate-limit: min 1s between jobs (optional)

---

## 14) Provider Registry (Extendable) 🧩

To add a new provider:

1. Create `providers/<name>.ts`
2. Implement `generate(prompt, config)`
3. Register in `providers/index.ts`
4. Update UI list (Renderer)

---

## 15) Definition of Done ✅

* Analyze works with at least one provider.
* Output always renders (even fallback).
* Export JSON works.
* Cache hits work.
* Logs are created without secrets leakage.
* Repo includes docs + open-source conventions.

---

```

---

## 🧬 “הקודקס משלים את התמונה” — מה מוסיפים עכשיו כדי שזה יהיה שלם 🎯
כדי להשלים את “התמונה” (המערכת כולה) לפי הקודקס:

### ✅ 1) להוסיף מסכי מערכת (UI) 🖥️
- ⚙️ Settings: בחירת Provider+Model
- 🧾 Logs Viewer: הצגת warnings/errors בצורה ברורה
- ♻️ Cache Manager: כפתור ניקוי Cache + מצב “היט”

### ✅ 2) להוסיף IPC ולידציה ב־Main 🔐
- ולידציה לסכמת הבקשה (provider/model/length)
- Rate limit (מגן מהקלקות כפולות)

### ✅ 3) לייצר “Snapshot Export” 📤
- Export JSON
- Export HTML
- Export “Printable A4 Landscape”

---

## 🎛️ תוספת קטנה מומלצת (כפתור ספק) 🧠
ב־UI שלך תוסיף בחירה:
- ☁️ Cloud
- 🖥️ Local

ואז הקריאה הופכת:
- `window.ai.generate({ provider, prompt, config })`

---

## 🎤 פזמון ראפ (4 שורות) 🎶
קודקס על השולחן—הכול נהיה ברור 📚  
Main שומר סודות—Renderer נשאר טהור 🔐  
קלפים יוצאים כמו אור—מסודר ומחובר ✨  
MatrixDesk פתוח לעם—בונים עתיד גיבור 💪  

---

## 📅 תאריך ושעה (לועזי + עברי) 🕰️
- **לועזי:** 13 January 2026  
- **עברי:** כ״ד טבת תשפ״ו  
- **שעה (Asia/Jerusalem):** 05:41  

---

## 🧾 קרדיטים (פנימי למאגר) 🧩
- **MatrixDesk Codex** — מסמך אלגוריתמי פנימי למאגר שלך: `docs/ALGORITHM_MATRIXDESK_CODEX.md`  
- **HolisView Unified UI** — הקוד שהבאת יהפוך ל־Renderer תחת אותו קודקס

---

## 🧠 מספר המידות (ליישום נכון)
**מספר המידות: 7**  
דיוק 🎯 | סדר 🧱 | אבטחה 🔐 | שקיפות 🌐 | עקביות ♻️ | יציבות 🧷 | הרחבה 🧩

---

## ✨ משפט קודש לסיום
**"דְּרָכֶיהָ דַרְכֵי נֹעַם וְכָל נְתִיבוֹתֶיהָ שָׁלוֹם"** 🕊️📖

אם תרצה, בהודעה הבאה תדביק לי את **עץ התיקיות הנוכחי** של `MatrixDesk` (רק שמות קבצים/תיקיות), ואני אתאים את הקודקס לקבצים המדויקים שלך כך שיתאים 1:1 למבנה בפועל.

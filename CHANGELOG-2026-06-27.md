# Change Log — 2026-06-27

Summary of code and configuration changes made to the PropReview application during this session.

---

## 1. Proposal Form Submit Button

**Files:**
- `components/proposal-form.tsx`
- `btp-deploy/components/proposal-form.tsx`

**Change:**
- Renamed the final step submit button from `Create Proposal Review` to `Proposal Review`.

---

## 2. Kimi LLM Base URL Configuration

**Problem:** Kimi/Moonshot API keys issued on the international platform (`platform.moonshot.ai`) fail with `Invalid Authentication` when called against the China endpoint (`https://api.moonshot.cn/v1`).

**Files:**
- `lib/llm/types.ts`
- `lib/llm/config.ts`
- `lib/llm/service.ts`
- `app/api/llm/test/route.ts`
- `app/api/llm/chat/route.ts`
- `components/llm-settings.tsx`
- All corresponding files in `btp-deploy/`

**Changes:**
- Added `baseUrl` field to `KimiConfig`.
- Reads `KIMI_BASE_URL` from `.env.local` (defaults to `https://api.moonshot.cn/v1`).
- Added a **Base URL** dropdown in Settings → LLM Provider with two presets:
  - `https://api.moonshot.cn/v1` — China
  - `https://api.moonshot.ai/v1` — International
- Updated Kimi test/chat calls to use the configured base URL.
- Added **auto endpoint detection**: when Test Connection returns `401`, the backend tries the alternate regional endpoint and reports which one the key works on.
- API keys are now trimmed before use.

---

## 3. LLM Model Selection Dropdowns

**Files:**
- `components/llm-settings.tsx`
- `btp-deploy/components/llm-settings.tsx`

**Changes:**
- Replaced free-text model inputs with dropdown `Select` components.
- **Claude models:**
  - `claude-3-5-sonnet-20241022`
  - `claude-3-5-haiku-20241022`
  - `claude-3-opus-20240229`
  - `claude-3-sonnet-20240229`
- **Kimi models:**
  - `moonshot-v1-8k`
  - `moonshot-v1-32k`
  - `moonshot-v1-128k`
  - `kimi-k2.5`
  - `kimi-k2.6`
- Added context-size labels (e.g., `moonshot-v1-128k (128k context)`).

---

## 4. AI Review Token-Limit Fallback

**Files:**
- `lib/ai-review-service.ts`
- `btp-deploy/lib/ai-review-service.ts`

**Changes:**
- Added detection for token-limit / context-length errors.
- When the full review prompt exceeds the model's limit, the app automatically falls back to **section-by-section review**.

---

## 5. PDF to Markdown Conversion

**Problem:** PDF plain-text extraction loses document structure, repeats headers/footers, and wastes tokens.

**Files:**
- `app/api/documents/extract/route.ts`
- `btp-deploy/app/api/documents/extract/route.ts`
- `package.json`
- `btp-deploy/package.json`

**Changes:**
- Installed `@opendocsg/pdf2md` in both application copies.
- PDF uploads are now converted to **Markdown** first.
- If Markdown conversion fails, the route falls back to the previous `pdf-parse` plain-text extraction.
- The extracted Markdown is stored in `extractedText` and consumed automatically by the AI review pipeline.

**Alternative researched:** Microsoft MarkItDown (Python library + MCP server) — higher quality for complex documents, but requires Python/MCP setup. The Node.js library was chosen for direct integration without extra runtime dependencies.

---

## Operational Notes

- The local dev server was restarted multiple times on **http://localhost:3000** so changes take effect.
- Existing uploaded PDFs still contain the old plain-text extraction; re-upload PDFs to get Markdown output.
- To default the Kimi endpoint to international, add to `.env.local`:
  ```env
  KIMI_BASE_URL=https://api.moonshot.ai/v1
  ```

---

## Remaining Recommendations

For further token savings on large proposals, consider adding:
1. A prompt token estimator before sending.
2. Truncation/summarization of supporting context documents (RFP, transcripts).
3. Automatic section-by-section review when token count exceeds a threshold.
4. Deduplication and removal of page headers/footers from extracted Markdown.

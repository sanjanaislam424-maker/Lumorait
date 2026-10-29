# Project memory

## Product intent & audience

- Full-stack micro-task and SMM (social media marketing) web application
- Includes Lumora Coin economy, gamified rewards, and super admin dashboard
- Humorous personal assistant UI persona ("Lumora IT" assistant)
- Vite + React frontend; backend uses serverless functions

## Brand personality & voice

- Assistant uses humor; official Lumora IT identity
- AI replies must be plain text only (no markdown symbols) — chat widget renders raw text, so asterisks etc. show literally

## Visual design & UX direction

- Vite + React + Tailwind CSS + lucide-react icons (per `.bolt/prompt`)
- Chat widget renders plain text only; avoid markdown-formatted responses from the AI
- Typing indicator (three dots) should only show before any streamed text arrives; hide it once text starts streaming

## Decisions, constraints & rationale

- Gemini API integration uses stored API key loaded from a database table (not `.env`); key is valid
- Switched to current Gemini model after prior model was retired by Google; backup/fallback model also configured
- Failures logged in function logs for diagnosability
- System prompt corrected: VIP has 0% service charge; prompt also instructs avoiding markdown symbols in replies
- **Streaming implemented:** Gemini API now uses streaming responses (newline-delimited JSON chunks forwarded to browser as they arrive); full reply saved after stream completes
- **Client stream reader** handles idle timeout (45s) and retries once, but only before any text has appeared
- **Error handling refined:**
  - Connection fail before any text → retry once → fallback message only if retry also fails
  - Connection drop after text started → partial reply kept + short notice shown
  - 45s idle timeout → treated as connection problem
- Membership tier service charges: VIP = 0%; Pro listed as 2% in membership table but Buy & Convert / Wallet pages treat Pro and VIP as exempt from 3% charge — unresolved conflict

## Open questions & assumptions

- **Security risk:** Gemini API key stored in a publicly readable DB table accessible via public app key. Needs rotation and move to a protected secret. Not yet changed due to potential app-settings loading impact.
- **Pricing mismatch:** Which is correct for Pro tier service charge — 2% (membership table) or exempt (Wallet / Buy & Convert pages)? User needs to confirm so pages can be aligned.
- Assumption: serverless function cold starts may cause long first-request latency (observed 120s timeout on initial test)
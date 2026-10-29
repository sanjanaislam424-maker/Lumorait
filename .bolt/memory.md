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

- (No explicit design details inferred yet beyond `.bolt/prompt` constraints — Vite + React + Tailwind CSS + lucide-react icons)
- Chat widget currently renders plain text only; avoid sending markdown-formatted responses from the AI

## Decisions, constraints & rationale

- Gemini API integration uses stored API key loaded from a database table (not `.env`); key is valid
- Switched to current Gemini model after prior model was retired by Google (caused silent fallback to "trouble responding" message)
- Added a backup/fallback model since Google retires models quickly
- Failures now logged in function logs for diagnosability
- System prompt corrected: VIP has 0% service charge (prompt previously said 2%)
- System prompt includes instruction to avoid markdown symbols in replies
- Membership tier service charges: VIP = 0%; Pro listed as 2% in membership table but Buy & Convert / Wallet pages treat Pro and VIP as exempt from 3% charge — unresolved conflict

## Open questions & assumptions

- **Security risk:** Gemini API key stored in a publicly readable DB table accessible via public app key. Needs rotation and move to a protected secret. Not yet changed due to potential app-settings loading impact.
- **Pricing mismatch:** Which is correct for Pro tier service charge — 2% (membership table) or exempt (Wallet / Buy & Convert pages)? User needs to confirm so pages can be aligned.
- Assumption: serverless function cold starts may cause long first-request latency (observed 120s timeout on initial test)
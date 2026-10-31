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
- Admin Gemini key list: test button (flask icon) per key; green "Valid" with token count + model on success, red error message on failure
- Usage stats displayed below each key: request count, total tokens (input + output), last-used date
- Admin error banners should include a retry button, not just a dead-end message

## Decisions, constraints & rationale

- Gemini API integration uses stored API key loaded from a database table (not `.env`); key is valid
- Switched to current Gemini model after prior model was retired by Google; backup/fallback model also configured
- Failures logged in function logs for diagnosability
- System prompt corrected: VIP has 0% service charge; prompt also instructs avoiding markdown symbols in replies
- **Streaming implemented:** Gemini API uses streaming responses (newline-delimited JSON chunks forwarded to browser as they arrive); full reply saved after stream completes
- **Client stream reader** handles idle timeout (45s) and retries once, but only before any text has appeared
- **Error handling refined:**
  - Connection fail before any text → retry once → fallback message only if retry also fails
  - Connection drop after text started → partial reply kept + short notice shown
  - 45s idle timeout → treated as connection problem
- **Token tracking implemented:** `ai-chat` function extracts `usageMetadata` from Gemini stream and persists per-key usage stats (request count, input/output tokens, last-used date) via atomic increment RPC
- **Test-key edge function:** sends a minimal "hello" request to verify a Gemini key; returns validity, token count, and model name; correctly rejects invalid keys
- Membership tier service charges: VIP = 0%; Pro listed as 2% in membership table but Buy & Convert / Wallet pages treat Pro and VIP as exempt from 3% charge — unresolved conflict
- **Admin user fetch uses SECURITY DEFINER RPC:** `admin_list_users` checks `is_platform_admin()` and reads `profiles` + `auth.users` directly, so table RLS policies don't block it. Function raises "Not authorized" (PostgreSQL code P0001) when caller's profile role isn't `admin` or caller is banned.
- **Admin panel dev bypass mismatch:** UI allows any signed-in user via `isDevAdmin` bypass, but the RPC rejects non-admin roles. A non-admin account hitting the Users tab gets "Not authorized" with no useful logging.
- **Error handling gap identified (in progress):** `fetchAdminUsers` throws raw Supabase error; UI only special-cases P0001 code. Real error may carry a different code and is only partly logged. Needs detailed console logging + retry button in `AdminUsersTab`.

## Open questions & assumptions

- **Security risk:** Gemini API key stored in a publicly readable DB table accessible via public app key. Needs rotation and move to a protected secret. Not yet changed due to potential app-settings loading impact.
- **Pricing mismatch:** Which is correct for Pro tier service charge — 2% (membership table) or exempt (Wallet / Buy & Convert pages)? User needs to confirm so pages can be aligned.
- Assumption: serverless function cold starts may cause long first-request latency (observed 120s timeout on initial test)
- Admin panel test-button UI and usage-stats display not yet verified in a browser (only edge function tested with invalid key)
- Pending fix: add console error logging to `fetchAdminUsers` and retry button to `AdminUsersTab` error banner; verify which account/role the signed-in test user has and whether an admin profile exists in `profiles`.
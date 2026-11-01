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
- Typing indicator (three dots) only before streamed text arrives; hide once text starts
- Admin Gemini key list: test button (flask icon) per key; green "Valid" with token count + model on success, red error message on failure
- Usage stats below each key: request count, total tokens (input + output), last-used date
- Admin error banners include retry button
- **AI Chat layout:** AI responses aligned LEFT, user messages aligned RIGHT
- **Message timestamp tooltip:** floating tooltip positioned directly below the message bubble (not on the side) on hover/tap; avoids clipping on small screens; fade-and-slide animation
- **Support/Report modal:** screenshot upload (with thumbnail preview & file input) only for Bug Report and Feedback forms; Ask Question (প্রশ্ন) omits screenshot
- Admin Support tab renders attached screenshot images inline on messages

## Decisions, constraints & rationale

- Gemini API key stored in DB table (not `.env`); streaming responses; full reply saved after stream
- Client stream reader: 45s idle timeout, retries once only before any text appears
- Token tracking: `ai-chat` function extracts `usageMetadata` and persists per-key stats via atomic increment RPC
- Test-key edge function sends minimal "hello" to verify key validity
- System prompt: VIP = 0% service charge; no markdown symbols in replies
- **Support routing split:** Bug Report & Feedback create chat session with status `pending_human` (routes to admin panel); Ask Question routes directly to AI assistant (no admin routing, no screenshot)
- ChatWidget accepts `routeToAdmin` flag that sets session to `pending_human` on creation
- Admin user fetch uses SECURITY DEFINER RPC `admin_list_users`; rejects non-admin roles with P0001
- Admin panel dev bypass mismatch: UI `isDevAdmin` bypass allows any signed-in user, but RPC rejects non-admin roles

## Open questions & assumptions

- **Security risk:** Gemini API key in publicly readable DB table; needs rotation to protected secret. Deferred due to app-settings loading impact.
- **Pricing mismatch:** Pro tier service charge — 2% (membership table) vs exempt (Wallet/Buy & Convert pages)? User needs to confirm.
- Assumption: serverless cold starts may cause long first-request latency (observed 120s timeout)
- Pending fix: detailed console error logging in `fetchAdminUsers` and retry button in `AdminUsersTab` error banner; verify test user role/admin profile existence
- Admin Support tab image rendering and timestamp tooltip behavior not yet browser-verified
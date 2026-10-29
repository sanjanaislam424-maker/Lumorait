/*
# Allow users to delete their own chat sessions

1. Security
- Adds a DELETE policy on `chat_sessions` so an authenticated user can delete
  only sessions they own (`auth.uid() = user_id`).
- The existing CASCADE foreign key on `chat_messages.session_id` automatically
  removes all messages when the session is deleted, so no separate message
  cleanup is needed.

2. Notes
- A DELETE grant already exists for `authenticated`; only the policy was missing.
*/

DROP POLICY IF EXISTS "delete_own_chat_sessions" ON chat_sessions;
CREATE POLICY "delete_own_chat_sessions" ON chat_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

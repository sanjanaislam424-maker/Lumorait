/*
# Enable realtime on profiles table

Allows the Supabase Realtime system to broadcast UPDATE events on the profiles
table so users see balance changes (e.g. admin refund) instantly without
needing a manual page refresh.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
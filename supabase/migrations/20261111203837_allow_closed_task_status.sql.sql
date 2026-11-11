/*
# Allow "closed" status on tasks

complete_box_task sets status='closed' when a P2P box task is claimed, but
tasks_status_check only allowed open/in_progress/completed/cancelled → [23514].
*/

ALTER TABLE public.tasks
  DROP CONSTRAINT tasks_status_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status = ANY (ARRAY[
    'open'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'closed'::text
  ]));
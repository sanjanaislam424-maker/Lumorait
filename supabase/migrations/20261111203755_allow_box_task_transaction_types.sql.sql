/*
# Allow box task transaction types

publish_box_task / complete_box_task insert transactions with type
'box_task_spend' / 'box_task_reward', but transactions_type_check didn't
list them → every publish with a cost > 0 threw [23514].
*/

ALTER TABLE public.transactions
  DROP CONSTRAINT transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type = ANY (ARRAY[
    'deposit'::text, 'withdrawal'::text, 'task_spend'::text, 'task_earn'::text,
    'referral'::text, 'spin'::text, 'checkin'::text, 'bonus'::text, 'penalty'::text,
    'admin_adjust'::text, 'promo'::text, 'referral_signup'::text, 'spin_extra'::text,
    'box_task_spend'::text, 'box_task_reward'::text
  ]));
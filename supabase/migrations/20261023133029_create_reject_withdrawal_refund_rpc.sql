/*
# Atomic withdrawal rejection refund function

## Problem
The admin rejection handler does a read-then-write refund from the client side.
This has two issues:
1. Race condition: two admins could reject simultaneously, double-refunding.
2. No double-refund guard: a rejected request could be refunded again.

## Fix
Create a SECURITY DEFINER function `reject_withdrawal_refund` that atomically:
1. Locks the transaction row (FOR UPDATE).
2. Verifies status is 'pending' — rejects if already processed.
3. Adds the withdrawal amount back to the user's cash_balance and withdrawable_balance.
4. Sets the transaction status to 'rejected'.
5. Inserts a refund record into transactions.
6. Returns the new balances.

## Security
- SECURITY DEFINER so it bypasses RLS (the client can't update other users' profiles).
- REVOKE EXECUTE from PUBLIC and anon; GRANT only to authenticated.
- Search path set to 'public' for safety.
*/

CREATE OR REPLACE FUNCTION public.reject_withdrawal_refund(p_tx_id uuid)
RETURNS TABLE(new_cash_balance numeric, new_withdrawable_balance numeric, refunded_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tx RECORD;
  v_amount numeric;
  v_new_cash numeric;
  v_new_withdrawable numeric;
BEGIN
  -- Lock the transaction row to prevent concurrent processing
  SELECT * INTO v_tx FROM transactions WHERE id = p_tx_id FOR UPDATE;

  -- Guard: only pending withdrawals can be refunded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  IF v_tx.type <> 'withdrawal' THEN
    RAISE EXCEPTION 'Transaction is not a withdrawal';
  END IF;
  IF v_tx.status <> 'pending' THEN
    RAISE EXCEPTION 'Transaction already processed (status: %)', v_tx.status;
  END IF;

  v_amount := ABS(v_tx.amount);

  -- Atomically increment the user's balances with an exclusive lock
  UPDATE profiles
    SET cash_balance = COALESCE(cash_balance, 0) + v_amount,
        withdrawable_balance = COALESCE(withdrawable_balance, COALESCE(cash_balance, 0)) + v_amount
    WHERE id = v_tx.user_id
    RETURNING cash_balance, withdrawable_balance INTO v_new_cash, v_new_withdrawable;

  -- Mark the withdrawal as rejected
  UPDATE transactions SET status = 'rejected' WHERE id = p_tx_id;

  -- Insert a refund record for the user's transaction history
  INSERT INTO transactions (user_id, type, amount, status, note)
    VALUES (v_tx.user_id, 'withdrawal', v_amount, 'completed',
      'Refund: Withdrawal rejected | +' || v_amount || ' BDT returned');

  RETURN QUERY SELECT v_new_cash, v_new_withdrawable, v_amount;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_withdrawal_refund(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal_refund(uuid) TO authenticated;
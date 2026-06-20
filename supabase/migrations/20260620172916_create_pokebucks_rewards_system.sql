-- PokeBucks ($PKB) Rewards System on Polygon
-- Earn rate: $1 spent = 10 PKB
-- Redeem rate: 10 PKB = $1 off
-- Min withdrawal: 100 PKB

-- Ledger: all PKB transactions (positive = credit, negative = debit)
CREATE TABLE IF NOT EXISTS rewards_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('earned', 'spent', 'withdrawn', 'bonus', 'refunded', 'manual')),
  amount numeric NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rewards_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_ledger" ON rewards_ledger FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admins_read_all_ledger" ON rewards_ledger FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admins_insert_ledger" ON rewards_ledger FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Withdrawal requests
CREATE TABLE IF NOT EXISTS rewards_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  tx_hash text,
  admin_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rewards_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_withdrawals" ON rewards_withdrawals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admins_read_all_withdrawals" ON rewards_withdrawals FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admins_update_withdrawals" ON rewards_withdrawals FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_rewards_ledger_user_id ON rewards_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_ledger_order_id ON rewards_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_rewards_withdrawals_user_id ON rewards_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_withdrawals_status ON rewards_withdrawals(status);

DROP TRIGGER IF EXISTS rewards_withdrawals_updated_at ON rewards_withdrawals;
CREATE TRIGGER rewards_withdrawals_updated_at
  BEFORE UPDATE ON rewards_withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Award PKB for a completed order (called client-side after payment success)
CREATE OR REPLACE FUNCTION award_pokebucks_for_order(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_total numeric;
  v_pkb_amount numeric;
  v_already_rewarded boolean;
BEGIN
  SELECT user_id, total INTO v_user_id, v_total
  FROM orders
  WHERE id = p_order_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM rewards_ledger WHERE order_id = p_order_id AND type = 'earned'
  ) INTO v_already_rewarded;

  IF v_already_rewarded THEN RETURN 0; END IF;

  v_pkb_amount := FLOOR(v_total * 10);
  IF v_pkb_amount <= 0 THEN RETURN 0; END IF;

  INSERT INTO rewards_ledger (user_id, type, amount, order_id, description)
  VALUES (v_user_id, 'earned', v_pkb_amount, p_order_id,
    'Earned from order #' || UPPER(SUBSTRING(p_order_id::text, 1, 8)));

  RETURN v_pkb_amount;
END;
$$;

-- Spend PKB (deduct from balance) — validated atomically
CREATE OR REPLACE FUNCTION spend_pokebucks(p_amount numeric, p_order_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM rewards_ledger WHERE user_id = auth.uid();

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient PokeBucks balance (have %, need %)', v_balance, p_amount;
  END IF;

  INSERT INTO rewards_ledger (user_id, type, amount, order_id, description)
  VALUES (auth.uid(), 'spent', -p_amount, p_order_id,
    'Redeemed ' || p_amount || ' $PKB toward purchase');

  RETURN true;
END;
$$;

-- Request a withdrawal — deducts PKB immediately
CREATE OR REPLACE FUNCTION request_pokebucks_withdrawal(p_amount numeric, p_wallet text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_withdrawal_id uuid;
BEGIN
  IF p_amount < 100 THEN
    RAISE EXCEPTION 'Minimum withdrawal is 100 PKB';
  END IF;

  IF p_wallet IS NULL OR LENGTH(TRIM(p_wallet)) = 0 THEN
    RAISE EXCEPTION 'Wallet address is required';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM rewards_ledger WHERE user_id = auth.uid();

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient PokeBucks balance';
  END IF;

  INSERT INTO rewards_ledger (user_id, type, amount, description)
  VALUES (auth.uid(), 'withdrawn', -p_amount,
    'Withdrawal of ' || p_amount || ' $PKB to ' || SUBSTRING(p_wallet, 1, 10) || '...');

  INSERT INTO rewards_withdrawals (user_id, amount, wallet_address)
  VALUES (auth.uid(), p_amount, p_wallet)
  RETURNING id INTO v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$$;

-- Admin: process or reject a withdrawal (rejection refunds PKB)
CREATE OR REPLACE FUNCTION admin_process_withdrawal(
  p_withdrawal_id uuid,
  p_status text,
  p_tx_hash text DEFAULT NULL,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal rewards_withdrawals%ROWTYPE;
  v_is_admin boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Admin access required'; END IF;

  SELECT * INTO v_withdrawal FROM rewards_withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;

  UPDATE rewards_withdrawals
  SET status = p_status, tx_hash = p_tx_hash, admin_note = p_admin_note, updated_at = now()
  WHERE id = p_withdrawal_id;

  IF p_status = 'rejected' THEN
    INSERT INTO rewards_ledger (user_id, type, amount, description)
    VALUES (v_withdrawal.user_id, 'refunded', v_withdrawal.amount,
      'Withdrawal rejected: ' || COALESCE(p_admin_note, 'No reason provided'));
  END IF;
END;
$$;

-- Admin: manually award PKB to any user
CREATE OR REPLACE FUNCTION admin_award_pokebucks(
  p_user_id uuid,
  p_amount numeric,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Admin access required'; END IF;

  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  INSERT INTO rewards_ledger (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', p_amount, p_description);
END;
$$;

-- Mystery Box Openings: records every box opening and what card was won
CREATE TABLE IF NOT EXISTS mystery_box_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  box_type text NOT NULL CHECK (box_type IN ('bronze', 'silver', 'gold')),
  pkb_spent numeric NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text,
  product_image_url text,
  product_price numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mystery_box_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_openings" ON mystery_box_openings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admins_read_all_openings" ON mystery_box_openings FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_mystery_box_openings_user_id ON mystery_box_openings(user_id);

-- Open a mystery box: validates balance, picks random card, deducts PKB
CREATE OR REPLACE FUNCTION open_mystery_box(p_box_type text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkb_cost   numeric;
  v_min_price  numeric;
  v_max_price  numeric;
  v_box_name   text;
  v_balance    numeric;
  v_product    products%ROWTYPE;
BEGIN
  -- Define box tiers
  IF p_box_type = 'bronze' THEN
    v_pkb_cost  := 300;
    v_min_price := 10;
    v_max_price := 60;
    v_box_name  := 'Bronze Mystery Box';
  ELSIF p_box_type = 'silver' THEN
    v_pkb_cost  := 800;
    v_min_price := 50;
    v_max_price := 160;
    v_box_name  := 'Silver Mystery Box';
  ELSIF p_box_type = 'gold' THEN
    v_pkb_cost  := 2000;
    v_min_price := 120;
    v_max_price := 999999;
    v_box_name  := 'Gold Mystery Box';
  ELSE
    RAISE EXCEPTION 'Invalid box type: %', p_box_type;
  END IF;

  -- Validate PKB balance
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM rewards_ledger WHERE user_id = auth.uid();

  IF v_balance < v_pkb_cost THEN
    RAISE EXCEPTION 'Insufficient PokeBucks — need %, have %', v_pkb_cost, v_balance;
  END IF;

  -- Pick random in-stock product in price range
  SELECT * INTO v_product
  FROM products
  WHERE price >= v_min_price
    AND price < v_max_price
    AND in_stock = true
    AND quantity > 0
  ORDER BY RANDOM()
  LIMIT 1;

  -- Fallback: any in-stock product, highest priced first
  IF NOT FOUND THEN
    SELECT * INTO v_product
    FROM products
    WHERE in_stock = true AND quantity > 0
    ORDER BY price DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No cards available right now — check back soon!';
  END IF;

  -- Deduct PKB
  INSERT INTO rewards_ledger (user_id, type, amount, description)
  VALUES (auth.uid(), 'spent', -v_pkb_cost,
    v_box_name || ' — Won: ' || v_product.name);

  -- Record the opening (snapshot product details in case product changes)
  INSERT INTO mystery_box_openings (user_id, box_type, pkb_spent, product_id, product_name, product_image_url, product_price)
  VALUES (auth.uid(), p_box_type, v_pkb_cost, v_product.id, v_product.name, v_product.image_url, v_product.price);

  -- Decrement inventory
  UPDATE products SET quantity = quantity - 1 WHERE id = v_product.id;
  UPDATE products SET in_stock = false WHERE id = v_product.id AND quantity <= 0;

  RETURN json_build_object(
    'id',          v_product.id,
    'name',        v_product.name,
    'price',       v_product.price,
    'image_url',   v_product.image_url,
    'set_name',    v_product.set_name,
    'rarity',      v_product.rarity,
    'description', v_product.description
  );
END;
$$;

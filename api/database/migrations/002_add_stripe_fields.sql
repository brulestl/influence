-- BEGIN MIGRATION
-- Add Stripe-related fields to users table for subscription management

-- Add Stripe customer ID for linking users to Stripe customers
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Add subscription status tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';

-- Add subscription ID for tracking active subscriptions
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id TEXT;

-- Add payment status tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none';

-- Add last payment date for tracking payment history
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;

-- Add daily query count for rate limiting (will be reset daily)
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_query_count INTEGER DEFAULT 0;

-- Add last query reset date for tracking when to reset daily counts
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_query_reset_date DATE DEFAULT CURRENT_DATE;

-- Create index on stripe_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Create index on subscription_status for filtering active subscriptions
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Create index on tier for faster tier-based queries
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);

-- Add constraint to ensure valid subscription statuses
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS chk_subscription_status 
  CHECK (subscription_status IN ('none', 'active', 'trialing', 'past_due', 'canceled', 'unpaid'));

-- Add constraint to ensure valid payment statuses
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS chk_payment_status 
  CHECK (payment_status IN ('none', 'paid', 'failed', 'pending'));

-- Add constraint to ensure valid tiers
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS chk_tier 
  CHECK (tier IN ('guest', 'essential', 'power'));

-- Create a function to reset daily query counts
CREATE OR REPLACE FUNCTION reset_daily_query_counts()
RETURNS void AS $$
BEGIN
  UPDATE users 
  SET daily_query_count = 0, 
      last_query_reset_date = CURRENT_DATE
  WHERE last_query_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to increment user query count
CREATE OR REPLACE FUNCTION increment_user_query_count(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  -- Reset count if it's a new day
  UPDATE users 
  SET daily_query_count = 0, 
      last_query_reset_date = CURRENT_DATE
  WHERE id = user_id AND last_query_reset_date < CURRENT_DATE;
  
  -- Increment the count
  UPDATE users 
  SET daily_query_count = daily_query_count + 1
  WHERE id = user_id
  RETURNING daily_query_count INTO new_count;
  
  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Create a function to get user query limit based on tier
CREATE OR REPLACE FUNCTION get_user_query_limit(user_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE user_tier
    WHEN 'power' THEN RETURN -1; -- Unlimited
    WHEN 'essential' THEN RETURN 3;
    WHEN 'guest' THEN RETURN 3;
    ELSE RETURN 3; -- Default
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for the new fields
-- Users can only see their own Stripe information
CREATE POLICY IF NOT EXISTS "Users can view own stripe info" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own stripe info" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Add comment explaining the migration
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for subscription management';
COMMENT ON COLUMN users.subscription_status IS 'Current subscription status from Stripe';
COMMENT ON COLUMN users.subscription_id IS 'Active Stripe subscription ID';
COMMENT ON COLUMN users.payment_status IS 'Current payment status';
COMMENT ON COLUMN users.last_payment_date IS 'Date of last successful payment';
COMMENT ON COLUMN users.daily_query_count IS 'Number of queries made today (resets daily)';
COMMENT ON COLUMN users.last_query_reset_date IS 'Date when daily query count was last reset';

-- END MIGRATION
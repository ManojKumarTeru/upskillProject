-- Adding the role column to the users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS primary_role text CHECK (primary_role IN ('customer', 'owner'));

-- Optional: Set default to customer if existing rows exist
-- UPDATE public.users SET primary_role = 'customer' WHERE primary_role IS NULL;

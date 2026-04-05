-- 1. Add coordinates to locations for Map Discovery
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS longitude numeric;

-- 2. Add tiering to customer loyalty
ALTER TABLE public.customer_loyalty ADD COLUMN IF NOT EXISTS tier text DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold'));

-- 3. (Optional) Index for proximity search efficiency
CREATE INDEX IF NOT EXISTS idx_locations_coordinates ON public.locations (latitude, longitude);

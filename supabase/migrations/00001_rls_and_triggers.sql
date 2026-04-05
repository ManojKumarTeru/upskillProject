-- ==============================================
-- 1. Enable RLS on all tables
-- ==============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 2. Create Security Policies
-- ==============================================

-- USERS Table
-- People can only see and edit their own private details.
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- SESSIONS Table
-- Customers keep their push notification tokens private
CREATE POLICY "Users can manage own sessions" ON public.user_sessions FOR ALL USING (auth.uid() = user_id);

-- BUSINESSES & LOCATIONS Tables
-- ANY authenticated user needs to be able to read Shop Names and Shop Addresses.
CREATE POLICY "Anyone can view businesses" ON public.businesses FOR SELECT USING (true);
CREATE POLICY "Anyone can view locations" ON public.locations FOR SELECT USING (true);
-- But only Shop Owners can UPDATE their shop's name/address.
CREATE POLICY "Staff can update business" ON public.businesses FOR UPDATE USING (
    id IN (SELECT business_id FROM public.business_staff WHERE user_id = auth.uid())
);
CREATE POLICY "Staff can update locations" ON public.locations FOR UPDATE USING (
    business_id IN (SELECT business_id FROM public.business_staff WHERE user_id = auth.uid())
);

-- BUSINESS STAFF Table
-- To prevent hacking, staff can only see their own assignments. (Admins could see more, but keeping it simple).
CREATE POLICY "Staff can view own assignment" ON public.business_staff FOR SELECT USING (auth.uid() = user_id);

-- CUSTOMER LOYALTY Table
-- Customers can see their own points balance.
CREATE POLICY "Customers can view own loyalty" ON public.customer_loyalty FOR SELECT USING (auth.uid() = user_id);
-- Shop owners can see all the customers connected to THEIR shop only.
CREATE POLICY "Staff can view business loyalty" ON public.customer_loyalty FOR SELECT USING (
    business_id IN (SELECT business_id FROM public.business_staff WHERE user_id = auth.uid())
);
-- Shop owners can award points/visits to their connected customers.
CREATE POLICY "Staff can manage loyalty" ON public.customer_loyalty FOR ALL USING (
    business_id IN (SELECT business_id FROM public.business_staff WHERE user_id = auth.uid())
);

-- VISIT LOGS Table
-- Customers can look at history of their past visits.
CREATE POLICY "Customers can view own visits" ON public.visit_logs FOR SELECT USING (auth.uid() = user_id);
-- Staff can see visits that happened at their shop.
CREATE POLICY "Staff can view location visits" ON public.visit_logs FOR SELECT USING (
    location_id IN (SELECT id FROM public.locations WHERE business_id IN (SELECT business_id FROM public.business_staff WHERE user_id = auth.uid()))
);
CREATE POLICY "Staff can insert visits" ON public.visit_logs FOR INSERT WITH CHECK (
    scanned_by_staff_id IN (SELECT id FROM public.business_staff WHERE user_id = auth.uid())
);

-- OFFERS & COUPONS
-- Anyone can see active offers
CREATE POLICY "Anyone can view offers" ON public.offers FOR SELECT USING (true);
-- Customers can see their own coupons.
CREATE POLICY "Customers can view own coupons" ON public.user_coupons FOR SELECT USING (auth.uid() = user_id);
-- Staff can mark coupons as 'redeemed'.
CREATE POLICY "Staff can redeem coupons" ON public.user_coupons FOR UPDATE USING (
    offer_id IN (SELECT id FROM public.offers WHERE business_id IN (SELECT business_id FROM public.business_staff WHERE user_id = auth.uid()))
);

-- NOTIFICATIONS
-- Only staff can send/log notifications for their shop
CREATE POLICY "Staff can manage notifications" ON public.notifications FOR ALL USING (
    business_id IN (SELECT business_id FROM public.business_staff WHERE user_id = auth.uid())
);

-- ==============================================
-- 3. The "Auto-Profile" Trigger
-- ==============================================
-- When a user logs in with Google/Apple for the first time on Supabase, 
-- this automatically creates their profile in our database instantly.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, first_name, last_name, email, phone)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.email,
    new.phone
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

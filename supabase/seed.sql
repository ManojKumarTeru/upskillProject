-- ============================================================
-- UPSKILL APP — TEST SEED DATA
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- 
-- STEP 1: Replace placeholders below with your REAL user IDs
--   OWNER_USER_ID  → The UUID of the user who signed up as a Business Owner
--   CUSTOMER_USER_ID → The UUID of the user who signed up as a Customer
--   
-- Find these in: Supabase Dashboard → Authentication → Users
-- ============================================================

DO $$
DECLARE
  -- ⚠️  REPLACE THESE WITH YOUR REAL USER IDs FROM SUPABASE AUTH
  v_owner_user_id    UUID := 'REPLACE_WITH_OWNER_USER_ID';
  v_customer_user_id UUID := 'REPLACE_WITH_CUSTOMER_USER_ID';

  -- Generated IDs (auto-created, don't touch)
  v_business_id   UUID := gen_random_uuid();
  v_location_id   UUID := gen_random_uuid();
  v_offer_1_id    UUID := gen_random_uuid();
  v_offer_2_id    UUID := gen_random_uuid();
  v_offer_3_id    UUID := gen_random_uuid();
  v_loyalty_id    UUID := gen_random_uuid();
BEGIN

  -- ============================================================
  -- 1. BUSINESS
  -- ============================================================
  INSERT INTO public.businesses (id, name, category, logo_url, is_active)
  VALUES (
    v_business_id,
    'Karthik''s Café & Bakery',
    'Food & Beverage',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=128&h=128&fit=crop',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 2. SHOP LOCATION (Branch)
  -- ============================================================
  INSERT INTO public.locations (id, business_id, name, address, city, pin_code, qr_code_id, latitude, longitude, is_active)
  VALUES (
    v_location_id,
    v_business_id,
    'Main Street Branch',
    '42, MG Road, Koramangala',
    'Bangalore',
    '560034',
    'SHOP_' || LEFT(v_business_id::TEXT, 8),
    12.9352,
    77.6245,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 3. BUSINESS STAFF (Owner linked to the business)
  -- ============================================================
  INSERT INTO public.business_staff (business_id, user_id, location_id, role, is_active)
  VALUES (
    v_business_id,
    v_owner_user_id,
    v_location_id,
    'owner',
    true
  )
  ON CONFLICT (business_id, user_id, location_id) DO NOTHING;

  -- ============================================================
  -- 4. OFFERS
  -- ============================================================
  INSERT INTO public.offers (id, business_id, location_id, title, description, discount_type, discount_value, is_welcome_offer, is_active, created_by)
  VALUES
    (
      v_offer_1_id, v_business_id, v_location_id,
      '☕ Welcome Offer — 20% OFF',
      'Get 20% off on your first order! Just show this at checkout.',
      'percentage', 20, true, true, v_owner_user_id
    ),
    (
      v_offer_2_id, v_business_id, v_location_id,
      '🍰 Weekend Special — 30% OFF Pastries',
      'Every Saturday & Sunday, enjoy 30% off on all our freshly baked pastries.',
      'percentage', 30, false, true, v_owner_user_id
    ),
    (
      v_offer_3_id, v_business_id, v_location_id,
      '🎂 Loyalty Reward — Free Birthday Cake Slice',
      'Redeem 50 points and get a free slice of any cake on your birthday month!',
      'percentage', 50, false, true, v_owner_user_id
    )
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 5. CUSTOMER LOYALTY (Customer connected to the shop)
  -- ============================================================
  INSERT INTO public.customer_loyalty
    (id, business_id, user_id, joined_at_location_id, total_visits, total_spent, current_points, last_visited_at)
  VALUES (
    v_loyalty_id,
    v_business_id,
    v_customer_user_id,
    v_location_id,
    4,
    4200,
    42,
    NOW() - INTERVAL '1 day'
  )
  ON CONFLICT (business_id, user_id) DO NOTHING;

  -- ============================================================
  -- 6. VISIT LOGS (Past transactions for this customer)
  -- ============================================================
  INSERT INTO public.visit_logs (location_id, user_id, amount_spent, points_earned, visit_time)
  VALUES
    (v_location_id, v_customer_user_id, 2000,  20, NOW() - INTERVAL '1 day'),
    (v_location_id, v_customer_user_id, 750,    7, NOW() - INTERVAL '5 days'),
    (v_location_id, v_customer_user_id, 1100,  11, NOW() - INTERVAL '12 days'),
    (v_location_id, v_customer_user_id, 350,    4, NOW() - INTERVAL '20 days');

  RAISE NOTICE '✅ Seed data inserted successfully!';
  RAISE NOTICE '   Business ID  : %', v_business_id;
  RAISE NOTICE '   Location ID  : %', v_location_id;
  RAISE NOTICE '   Loyalty ID   : %', v_loyalty_id;
  RAISE NOTICE '';
  RAISE NOTICE '   Copy these IDs to verify data in your Supabase tables.';

END $$;

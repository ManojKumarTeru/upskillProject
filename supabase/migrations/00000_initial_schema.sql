-- 1. Users (Extends auth.users)
CREATE TABLE public.users (
    id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name text,
    last_name text,
    email text UNIQUE,
    phone text UNIQUE,
    avatar_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    meta jsonb,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- 2. User Sessions / Devices (For Push Notifications & Tracking)
CREATE TABLE public.user_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    device_token text NOT NULL,
    device_type text CHECK (device_type IN ('ios', 'android', 'web')),
    created_at timestamp with time zone DEFAULT now(),
    last_seen timestamp with time zone DEFAULT now(),
    meta jsonb,
    CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- 3. Business Entities (The Brand itself, e.g. "Starbucks")
CREATE TABLE public.businesses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category text, 
    logo_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    meta jsonb,
    CONSTRAINT businesses_pkey PRIMARY KEY (id)
);

-- 4. Shop Locations (Branches of a Business, e.g. "Starbucks - Main St")
-- For a single shop, this is just a 1:1 relation with businesses, but enables multi-branch scalability.
CREATE TABLE public.locations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    name text NOT NULL,
    address text,
    city text,
    pin_code text,
    qr_code_id text UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    meta jsonb,
    CONSTRAINT locations_pkey PRIMARY KEY (id),
    CONSTRAINT locations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- 5. Business Staff / Owners (RBAC mapping)
CREATE TABLE public.business_staff (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    user_id uuid NOT NULL,
    location_id uuid, -- If null, they are an overall admin. If set, they only manage one location
    role text NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT business_staff_pkey PRIMARY KEY (id),
    CONSTRAINT business_staff_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
    CONSTRAINT business_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT business_staff_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE,
    CONSTRAINT unique_business_user UNIQUE (business_id, user_id, location_id)
);

-- 6. Customer Loyalty Profiles (The unified connection "customer added this shop")
CREATE TABLE public.customer_loyalty (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at_location_id uuid, -- Where did they first scan?
    total_visits integer DEFAULT 0,
    total_spent numeric DEFAULT 0,
    current_points integer DEFAULT 0,
    last_visited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    meta jsonb,
    CONSTRAINT customer_loyalty_pkey PRIMARY KEY (id),
    CONSTRAINT customer_loyalty_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT customer_loyalty_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
    CONSTRAINT customer_loyalty_location_id_fkey FOREIGN KEY (joined_at_location_id) REFERENCES public.locations(id) ON DELETE SET NULL,
    CONSTRAINT unique_customer_business UNIQUE (business_id, user_id)
);

-- 7. Visit Logs (Immutable transaction logs of every check-out/scan)
CREATE TABLE public.visit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL,
    user_id uuid NOT NULL,
    scanned_by_staff_id uuid, -- Which staff validated the visit/discount?
    amount_spent numeric DEFAULT 0,
    points_earned integer DEFAULT 0,
    points_redeemed integer DEFAULT 0,
    discount_applied_amount numeric DEFAULT 0,
    visit_time timestamp with time zone DEFAULT now(),
    meta jsonb,
    CONSTRAINT visit_logs_pkey PRIMARY KEY (id),
    CONSTRAINT visit_logs_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
    CONSTRAINT visit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
    CONSTRAINT visit_logs_staff_id_fkey FOREIGN KEY (scanned_by_staff_id) REFERENCES public.business_staff(id)
);

-- 8. Campaigns / Offers
CREATE TABLE public.offers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    location_id uuid, -- If null, applies to all branches
    title text NOT NULL,
    description text,
    discount_type text CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_item')),
    discount_value numeric NOT NULL,
    is_welcome_offer boolean DEFAULT false,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL, -- staff who made it
    created_at timestamp with time zone DEFAULT now(),
    meta jsonb,
    CONSTRAINT offers_pkey PRIMARY KEY (id),
    CONSTRAINT offers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
    CONSTRAINT offers_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE,
    CONSTRAINT offers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- 9. User Coupons (Instances of an Offer given to a specific user)
CREATE TABLE public.user_coupons (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    offer_id uuid NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired')),
    redeemed_at timestamp with time zone,
    redeemed_at_location_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    meta jsonb,
    CONSTRAINT user_coupons_pkey PRIMARY KEY (id),
    CONSTRAINT user_coupons_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT user_coupons_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE CASCADE,
    CONSTRAINT user_coupons_location_id_fkey FOREIGN KEY (redeemed_at_location_id) REFERENCES public.locations(id)
);

-- 10. Notifications Audit Log
CREATE TABLE public.notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    user_id uuid NOT NULL,
    offer_id uuid, -- Optional, if tied to a specific coupon blast
    title text NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'read')),
    sent_at timestamp with time zone DEFAULT now(),
    meta jsonb,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT notifications_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL
);

-- Note: We will need a PostgreSQL Trigger to automatically insert a row in public.users when auth.users is created.

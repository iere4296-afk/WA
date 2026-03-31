-- Fix login issue for iere3703@gmail.com
-- This creates the necessary user profile and organization records

-- Step 1: Create user profile in custom users table
INSERT INTO users (
  id,
  email,
  role,
  created_at,
  updated_at
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'iere3703@gmail.com'),
  'iere3703@gmail.com',
  'owner',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Step 2: Create organization for the user
INSERT INTO organizations (
  id,
  name,
  slug,
  plan,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'WA Intelligence Organization',
  'wa-intelligence-org',
  'free',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Step 3: Add user to organization as owner
INSERT INTO org_members (
  id,
  org_id,
  user_id,
  role,
  created_at,
  updated_at
) SELECT 
  gen_random_uuid(),
  o.id,
  u.id,
  'owner',
  NOW(),
  NOW()
FROM organizations o, users u 
WHERE o.slug = 'wa-intelligence-org' 
  AND u.email = 'iere3703@gmail.com'
ON CONFLICT (user_id, org_id) DO UPDATE SET
  role = EXCLUDED.role,
  updated_at = NOW();

-- Step 4: Verify the setup
SELECT 
  u.email,
  u.role as user_role,
  o.name as org_name,
  o.plan,
  om.role as org_member_role
FROM users u
JOIN org_members om ON u.id = om.user_id
JOIN organizations o ON om.org_id = o.id
WHERE u.email = 'iere3703@gmail.com';

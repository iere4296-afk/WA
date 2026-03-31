-- Fix user ID mismatch
-- Update user profile to use the correct auth user ID

-- Step 1: Update the user profile to use the correct auth user ID
UPDATE users 
SET id = '933377eb-e6b0-4c0d-82f1-2c23527464d5'
WHERE email = 'iere3703@gmail.com';

-- Step 2: Create organization with the correct owner_id
INSERT INTO organizations (
  id,
  name,
  slug,
  plan,
  owner_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'WA Intelligence Organization',
  'wa-intelligence-org',
  'free',
  '933377eb-e6b0-4c0d-82f1-2c23527464d5',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Step 3: Add user to organization as owner
INSERT INTO org_members (
  id,
  org_id,
  user_id,
  role,
  joined_at,
  created_at,
  updated_at
) SELECT 
  gen_random_uuid(),
  o.id,
  u.id,
  'owner',
  NOW(),
  NOW(),
  NOW()
FROM organizations o, users u 
WHERE o.owner_id = u.id 
  AND u.email = 'iere3703@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM org_members om2 
    WHERE om2.user_id = u.id AND om2.org_id = o.id
  );

-- Step 4: Verify the fix
SELECT 
  u.email,
  u.id as user_id,
  u.role as user_role,
  o.name as org_name,
  o.plan,
  om.role as org_member_role,
  CASE 
    WHEN om.id IS NOT NULL THEN '✅ LOGIN SHOULD WORK NOW!'
    ELSE '❌ STILL NEEDS FIX'
  END as status
FROM users u
LEFT JOIN org_members om ON u.id = om.user_id
LEFT JOIN organizations o ON om.org_id = o.id
WHERE u.email = 'iere3703@gmail.com';

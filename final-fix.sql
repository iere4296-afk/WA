-- Final fix for login issue
-- User ID: c7a5df2d-1397-44df-b747-09fb1987d42a

-- Step 1: Create organization for the user
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
  'c7a5df2d-1397-44df-b747-09fb1987d42a',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Step 2: Add user to organization as owner
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

-- Step 3: Verify the fix
SELECT 
  u.email,
  u.role as user_role,
  o.name as org_name,
  o.plan,
  om.role as org_member_role,
  CASE 
    WHEN om.id IS NOT NULL THEN '✅ HAS ORG ACCESS - LOGIN SHOULD WORK NOW!'
    ELSE '❌ STILL MISSING ORG ACCESS'
  END as status
FROM users u
LEFT JOIN org_members om ON u.id = om.user_id
LEFT JOIN organizations o ON om.org_id = o.id
WHERE u.email = 'iere3703@gmail.com';

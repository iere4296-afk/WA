-- Check current state and fix login issue

-- Step 1: Check what exists
SELECT 'USERS TABLE' as table_name, id, email, role, created_at FROM users WHERE email = 'iere3703@gmail.com'
UNION ALL
SELECT 'ORG_MEMBERS TABLE' as table_name, user_id::text, email, role, created_at::text FROM org_members om
JOIN users u ON om.user_id = u.id WHERE u.email = 'iere3703@gmail.com'
UNION ALL  
SELECT 'ORGANIZATIONS TABLE' as table_name, owner_id::text, name, plan, created_at::text FROM organizations WHERE owner_id = '933377eb-e6b0-4c0d-82f1-2c23527464d5';

-- Step 2: Check if user has organization membership
SELECT 
  u.email,
  u.id as user_id,
  o.id as org_id,
  o.name as org_name,
  om.role as org_role,
  om.joined_at
FROM users u
LEFT JOIN org_members om ON u.id = om.user_id
LEFT JOIN organizations o ON om.org_id = o.id
WHERE u.email = 'iere3703@gmail.com';

-- Step 3: If organization membership is missing, create it
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

-- Step 4: Verify final state
SELECT 
  u.email,
  u.role as user_role,
  o.name as org_name,
  o.plan,
  om.role as org_member_role,
  CASE 
    WHEN om.id IS NOT NULL THEN 'HAS ORG ACCESS'
    ELSE 'MISSING ORG ACCESS'
  END as status
FROM users u
LEFT JOIN org_members om ON u.id = om.user_id
LEFT JOIN organizations o ON om.org_id = o.id
WHERE u.email = 'iere3703@gmail.com';

-- Debug authentication issue

-- Step 1: Check auth.users table
SELECT 'AUTH USERS' as source, id, email, created_at FROM auth.users WHERE email = 'iere3703@gmail.com';

-- Step 2: Check custom users table  
SELECT 'CUSTOM USERS' as source, id, email, role, created_at FROM users WHERE email = 'iere3703@gmail.com';

-- Step 3: Check organization membership
SELECT 'ORG_MEMBERS' as source, user_id, org_id, role, joined_at FROM org_members om
JOIN users u ON om.user_id = u.id 
WHERE u.email = 'iere3703@gmail.com';

-- Step 4: Check if there are any login history records
SELECT 'LOGIN_HISTORY' as source, user_id, success, failure_reason, created_at FROM login_history 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'iere3703@gmail.com') 
ORDER BY created_at DESC LIMIT 5;

-- Step 5: Verify complete auth flow
SELECT 
  au.id as auth_user_id,
  au.email as auth_email,
  au.created_at as auth_created,
  u.id as custom_user_id,
  u.email as custom_email,
  u.role as custom_role,
  om.id as org_member_id,
  om.role as org_role,
  o.id as org_id,
  o.name as org_name,
  CASE 
    WHEN u.id IS NULL THEN '❌ Missing custom user profile'
    WHEN om.id IS NULL THEN '❌ Missing organization membership'
    WHEN o.id IS NULL THEN '❌ Missing organization'
    ELSE '✅ All auth components present'
  END as auth_status
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
LEFT JOIN org_members om ON u.id = om.user_id  
LEFT JOIN organizations o ON om.org_id = o.id
WHERE au.email = 'iere3703@gmail.com';

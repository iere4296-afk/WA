-- Create initial user account
-- Replace 'your-email@example.com' with your actual email

INSERT INTO users (
  id,
  email,
  password_hash,
  role,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'your-email@example.com',
  '$2b$10$placeholder.hash.will.be.updated.on.first.login',
  'owner',
  NOW(),
  NOW()
);

-- Also create an organization for this user
INSERT INTO organizations (
  id,
  name,
  slug,
  plan,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Default Organization',
  'default-org',
  'free',
  NOW(),
  NOW()
);

-- Link user to organization
-- Note: You'll need to get the actual IDs from the previous inserts
INSERT INTO org_members (
  id,
  org_id,
  user_id,
  role,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM organizations WHERE slug = 'default-org'),
  (SELECT id FROM users WHERE email = 'your-email@example.com'),
  'owner',
  NOW(),
  NOW()
);

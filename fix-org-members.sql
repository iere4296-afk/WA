-- Fix missing columns in org_members table
ALTER TABLE org_members 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing rows to have proper timestamps
UPDATE org_members 
SET created_at = COALESCE(created_at, joined_at, NOW()),
    updated_at = COALESCE(updated_at, joined_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;

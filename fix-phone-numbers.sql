-- STEP 1: Check what invalid phones exist
SELECT id, phone, name
FROM contacts
WHERE phone NOT LIKE '+%'
   OR phone ~ '[A-Za-z]'   -- Contains letters (like "+AE...")
   OR length(replace(phone, '+', '')) < 7
LIMIT 50;

-- STEP 2: Fix UAE contacts stored as +AE... → +971...
-- The pattern +AE followed by digits → replace AE with 971
UPDATE contacts
SET phone = '+971' || regexp_replace(phone, '^\+AE', ''),
    updated_at = NOW()
WHERE phone ~ '^\+AE[0-9]';

-- STEP 3: Fix +SA (Saudi Arabia) → +966
UPDATE contacts
SET phone = '+966' || regexp_replace(phone, '^\+SA', ''),
    updated_at = NOW()
WHERE phone ~ '^\+SA[0-9]';

-- STEP 4: Fix +EG (Egypt) → +20
UPDATE contacts
SET phone = '+20' || regexp_replace(phone, '^\+EG', ''),
    updated_at = NOW()
WHERE phone ~ '^\+EG[0-9]';

-- STEP 5: Fix +IN (India) → +91
UPDATE contacts
SET phone = '+91' || regexp_replace(phone, '^\+IN', ''),
    updated_at = NOW()
WHERE phone ~ '^\+IN[0-9]';

-- STEP 6: Fix +PK (Pakistan) → +92
UPDATE contacts
SET phone = '+92' || regexp_replace(phone, '^\+PK', ''),
    updated_at = NOW()
WHERE phone ~ '^\+PK[0-9]';

-- STEP 7: Verify fix worked
SELECT phone, name FROM contacts
WHERE phone LIKE '+971%'
LIMIT 10;

-- STEP 8: Delete any remaining invalid contacts (letters in phone)
-- Run ONLY after you've fixed all known patterns above
DELETE FROM contacts
WHERE phone ~ '[A-Za-z]';

-- STEP 9: Verify campaign contacts
-- This will show you the phone numbers for your JVC campaign
SELECT c.phone, c.name, c.status
FROM campaigns ca
JOIN contacts c ON c.id = ANY(ca.contact_ids)
WHERE ca.name ILIKE '%jvc%'
LIMIT 20;

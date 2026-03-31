ALTER TABLE message_templates
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text'
  CHECK (type IN ('text', 'image', 'video', 'document'));

ALTER TABLE message_templates
ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_message_templates_org_type
  ON message_templates(org_id, type);

CREATE INDEX IF NOT EXISTS idx_message_templates_tags
  ON message_templates USING GIN(tags);

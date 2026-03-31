-- pgvector helpers (extension + embedding column + idx_contacts_embedding are in 001_schema.sql)
-- Avoid a second HNSW index on the same column — duplicate indexes waste space and slow writes.

-- Function to find similar contacts by embedding
CREATE OR REPLACE FUNCTION search_contacts_semantic(
  org_id_param UUID,
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  phone TEXT,
  name TEXT,
  similarity FLOAT
) AS $$
  SELECT
    c.id,
    c.phone,
    c.name,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM contacts c
  WHERE c.org_id = org_id_param
    AND c.deleted_at IS NULL
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE SQL STABLE;

-- Function to update contact embedding
CREATE OR REPLACE FUNCTION update_contact_embedding(
  contact_id UUID,
  new_embedding vector(1536)
)
RETURNS void AS $$
BEGIN
  UPDATE contacts
  SET embedding = new_embedding,
      updated_at = NOW()
  WHERE id = contact_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update embedding timestamp
CREATE OR REPLACE FUNCTION trigger_update_embedding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for contacts embedding updates
DROP TRIGGER IF EXISTS trg_contacts_embedding_updated ON contacts;
CREATE TRIGGER trg_contacts_embedding_updated
  BEFORE UPDATE OF embedding ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_embedding_timestamp();

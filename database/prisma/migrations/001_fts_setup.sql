-- database/prisma/migrations/001_initial/migration.sql
-- Initial migration: Create all tables and indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Full-text search index (applied after Prisma creates the table)
CREATE INDEX IF NOT EXISTS tenders_search_vector_idx 
ON tenders USING GIN(search_vector);

-- Function to auto-update search vector
CREATE OR REPLACE FUNCTION update_tender_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.reference_number, '') || ' ' ||
    coalesce(NEW.state, '') || ' ' ||
    coalesce(NEW.city, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search vector
DROP TRIGGER IF EXISTS tenders_search_vector_update ON tenders;
CREATE TRIGGER tenders_search_vector_update
  BEFORE INSERT OR UPDATE ON tenders
  FOR EACH ROW EXECUTE FUNCTION update_tender_search_vector();

-- Accent-insensitive customer search ("nguyen" matches "Nguyễn"). unaccent ships with
-- PostgreSQL and is a trusted extension, so the database owner can enable it.
CREATE EXTENSION IF NOT EXISTS unaccent;

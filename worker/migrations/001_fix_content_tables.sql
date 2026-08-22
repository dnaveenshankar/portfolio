-- One-time migration: the initial schema.sql for skills/experience/education/certifications/
-- achievements didn't match the real site's card+modal data shape. These tables are still
-- empty of real content, so it's safe to drop and recreate them with the corrected shape
-- (see schema.sql for the current definitions and comments).
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS experience;
DROP TABLE IF EXISTS education;
DROP TABLE IF EXISTS certifications;
DROP TABLE IF EXISTS achievements;

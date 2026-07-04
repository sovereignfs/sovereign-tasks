-- Tasks plugin — backfill existing lists to the default colour swatch ('black').
-- Colour is now mandatory at the app layer (every new list gets a colour on
-- create); this brings pre-existing rows created before that change in line.
-- The column stays nullable in the schema (SQLite ALTER COLUMN would require a
-- full table rebuild); listDotColor() still falls back defensively for any
-- future NULL.

UPDATE `tasks_lists` SET `color` = 'black' WHERE `color` IS NULL;

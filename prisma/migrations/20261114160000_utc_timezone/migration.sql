-- Store and compare all timestamps in UTC; the app converts to Europe/Sofia itself.
DO $$ BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END $$;

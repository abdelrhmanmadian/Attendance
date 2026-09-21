-- Runs once when the postgres container's data volume is first created.
-- The main "attendance" database comes from POSTGRES_DB; this adds the
-- second database used by the test suite so `npm test` works out of the box.
CREATE DATABASE attendance_test;

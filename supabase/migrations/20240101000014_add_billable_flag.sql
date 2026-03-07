-- Migration: Add billable flag to time entries
-- Supports billable/non-billable toggle for time entries

ALTER TABLE time_entries ADD COLUMN is_billable boolean NOT NULL DEFAULT false;

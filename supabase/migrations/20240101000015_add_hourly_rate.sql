-- Migration: Add hourly rate to categories
-- Supports per-category hourly rate for earnings calculation

ALTER TABLE categories ADD COLUMN hourly_rate numeric(10,2) DEFAULT NULL;

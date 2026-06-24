-- Migration: Add columns for case file import
-- These columns support the CSV import format with fields:
-- NextHearingDate, CaseNumber, CaseTitle, CNRNumber, FileNumber, CourtType,
-- CourtName, FilingDate, CaseStage, Stage, Client, CaseStatus, Lawyer,
-- LastHearingDate, caseImportedDate, CaseTag(s), CaseSide, DisposedDate,
-- DocumentSize, FIRNumer, policeStation, CaseNotes-1, CaseNotes-2

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS cnr_number text,
  ADD COLUMN IF NOT EXISTS file_number text,
  ADD COLUMN IF NOT EXISTS court_type text,
  ADD COLUMN IF NOT EXISTS case_stage text,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS last_hearing_date date,
  ADD COLUMN IF NOT EXISTS next_hearing_date date,
  ADD COLUMN IF NOT EXISTS case_imported_date date,
  ADD COLUMN IF NOT EXISTS case_tags text,
  ADD COLUMN IF NOT EXISTS case_side text,
  ADD COLUMN IF NOT EXISTS disposed_date date,
  ADD COLUMN IF NOT EXISTS document_size text,
  ADD COLUMN IF NOT EXISTS fir_number text,
  ADD COLUMN IF NOT EXISTS police_station text,
  ADD COLUMN IF NOT EXISTS case_notes_1 text,
  ADD COLUMN IF NOT EXISTS case_notes_2 text;

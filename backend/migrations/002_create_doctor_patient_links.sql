-- 002_create_doctor_patient_links.sql
-- Connects hospital_patient users to doctor users.
-- status lets a doctor accept/reject before the link is active.

CREATE TYPE link_status AS ENUM ('pending', 'active', 'revoked');

CREATE TABLE doctor_patient_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       link_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, patient_id)
);

CREATE INDEX idx_links_patient ON doctor_patient_links(patient_id);
CREATE INDEX idx_links_doctor ON doctor_patient_links(doctor_id);

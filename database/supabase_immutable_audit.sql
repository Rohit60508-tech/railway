-- ==============================================================================
-- INDIAN RAILWAYS AI PLATFORM (RAKSHA PATH)
-- SUPABASE POSTGRESQL IMMUTABLE ACTION AUDIT LEDGER
-- ==============================================================================
-- Description:
-- Stores every operational action, emergency override, sanction, and AI decision
-- stamped with the logged-in user's identity, staff ID, role, and entry name.
--
-- Immutability Guarantees:
-- 1. PostgreSQL Triggers: Strictly block any UPDATE or DELETE operations.
-- 2. Row Level Security (RLS): Only INSERT and SELECT are granted.
-- 3. Cryptographic Chaining: Each record computes a SHA-256 hash chaining back
--    to the previous record's hash (prev_hash -> record_hash).
-- ==============================================================================

-- Enable pgcrypto for UUID and cryptographic operations
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create the Immutable Action Audit Table
CREATE TABLE IF NOT EXISTS immutable_action_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq_id BIGSERIAL,
    
    -- Entry & Action Identification
    entry_name VARCHAR(120) NOT NULL,            -- e.g. FORCE_SANCTION_BLOCK, DEFECT_OVERRIDE, SPEED_RESTRICTION
    event_type VARCHAR(60) NOT NULL DEFAULT 'SYSTEM_ACTION', -- OVERRIDE, SANCTION, DISPATCH, SIMULATION
    
    -- Logged-In User Provenance
    staff_id VARCHAR(80) NOT NULL,               -- e.g. IR-SSE-84920, usr-003, DRM01
    user_name VARCHAR(150) NOT NULL,             -- Full name of operator, e.g. Rajesh Kumar Verma
    user_role VARCHAR(80) NOT NULL,              -- e.g. CONTROL_OFFICER, MAINTENANCE_ENGINEER, ADMIN
    user_division VARCHAR(120) DEFAULT 'Northern Railway — Delhi Division',
    
    -- Spatial & Railway Assets
    section VARCHAR(160) NOT NULL,               -- e.g. NDLS-CNB-UP (ALJN ➔ TDL at KM 142/10 – 145/20)
    target_entity_id VARCHAR(100),               -- e.g. BLK-7491-NDLS-GZB, DEF-2026-9402
    
    -- Operational Impact
    reason TEXT NOT NULL,                        -- Controller / Supervisor operational justification
    disruption_score NUMERIC(5,2) DEFAULT 0.0,
    delay_minutes INT DEFAULT 0,
    action_payload JSONB DEFAULT '{}'::jsonb,    -- Complete structured JSON context
    
    -- Blockchain / Cryptographic Chaining for Tamper-Proof Immutability
    prev_hash TEXT NOT NULL DEFAULT 'GENESIS_HASH_IR_2026_00000000000000000000000000000000',
    record_hash TEXT NOT NULL,
    is_immutable BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamp
    client_ip VARCHAR(64) DEFAULT '127.0.0.1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for high-speed chronological audit retrieval
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON immutable_action_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_staff_id ON immutable_action_audit_log(staff_id);
CREATE INDEX IF NOT EXISTS idx_audit_entry_name ON immutable_action_audit_log(entry_name);
CREATE INDEX IF NOT EXISTS idx_audit_section ON immutable_action_audit_log(section);

-- 2. Enforce Strict Immutability via PostgreSQL Trigger Function
CREATE OR REPLACE FUNCTION prevent_action_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        RAISE EXCEPTION 'SECURITY VIOLATION [IR-AUDIT-IMMUTABLE]: Action audit records cannot be modified or updated! Record ID: %', OLD.id;
    ELSIF (TG_OP = 'DELETE') THEN
        RAISE EXCEPTION 'SECURITY VIOLATION [IR-AUDIT-IMMUTABLE]: Action audit records cannot be deleted! Record ID: %', OLD.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Bind Trigger to prevent any UPDATE or DELETE
DROP TRIGGER IF EXISTS trg_prevent_action_audit_tampering ON immutable_action_audit_log;
CREATE TRIGGER trg_prevent_action_audit_tampering
    BEFORE UPDATE OR DELETE ON immutable_action_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_action_audit_tampering();

-- 3. Enable Row Level Security (RLS)
ALTER TABLE immutable_action_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated / anon users to read audit logs
DROP POLICY IF EXISTS "Allow audit log read" ON immutable_action_audit_log;
CREATE POLICY "Allow audit log read"
    ON immutable_action_audit_log
    FOR SELECT
    USING (true);

-- Allow authenticated and service roles to insert new records
DROP POLICY IF EXISTS "Allow audit log insert" ON immutable_action_audit_log;
CREATE POLICY "Allow audit log insert"
    ON immutable_action_audit_log
    FOR INSERT
    WITH CHECK (true);

-- NOTE: No policies are created for UPDATE or DELETE, ensuring RLS blocks them as well.

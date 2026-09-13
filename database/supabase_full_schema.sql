-- ==============================================================================
-- INDIAN RAILWAYS AI PLATFORM (RAKSHA PATH)
-- COMPLETE SUPABASE POSTGRESQL DATABASE MIGRATION SCRIPT
-- ==============================================================================
-- Run this complete SQL script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/surzryivaqezaoebvqsa/sql
-- ==============================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- TABLE 1: track_sections (Corridor Infrastructure & Topology Master)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS track_sections (
    section_id VARCHAR(50) PRIMARY KEY,
    division VARCHAR(50) NOT NULL,                        -- e.g., 'NR', 'NCR', 'WR'
    sub_division VARCHAR(50) DEFAULT 'MAIN',              -- e.g., 'DLI', 'CNB'
    start_station VARCHAR(10) NOT NULL,                   -- e.g., 'NDLS'
    end_station VARCHAR(10) NOT NULL,                     -- e.g., 'CNB'
    start_km NUMERIC(8, 3) NOT NULL,
    end_km NUMERIC(8, 3) NOT NULL,
    max_permissible_speed INT NOT NULL DEFAULT 130,       -- Kmph (up to 160 for Vande Bharat)
    line_type VARCHAR(20) NOT NULL DEFAULT 'UP',          -- 'UP', 'DOWN', 'THIRD', 'FOURTH'
    electrification_type VARCHAR(20) DEFAULT '25KV_AC',   -- '25KV_AC', '2X25KV_AC', 'NON_ELEC'
    traffic_density_gmt NUMERIC(6, 2) DEFAULT 45.0,      -- Gross Million Tonnes per annum
    track_structure VARCHAR(50) DEFAULT '60KG_PSC',       -- 60kg Rail on PSC Sleepers
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_track_sections_div ON track_sections(division, line_type);

-- Seed Track Sections
INSERT INTO track_sections (section_id, division, sub_division, start_station, end_station, start_km, end_km, max_permissible_speed, line_type)
VALUES 
    ('NDLS-CNB-UP', 'NR', 'DLI', 'NDLS', 'CNB', 0.000, 440.000, 160, 'UP'),
    ('NDLS-CNB-DN', 'NR', 'DLI', 'CNB', 'NDLS', 0.000, 440.000, 160, 'DOWN'),
    ('DLI-GZB-UP',  'NR', 'DLI', 'DLI',  'GZB', 0.000, 24.500,  110, 'UP'),
    ('GZB-ALJN-UP', 'NCR', 'ALJN', 'GZB', 'ALJN', 25.400, 126.100, 130, 'UP'),
    ('ALJN-TDL-UP', 'NCR', 'TDL', 'ALJN', 'TDL', 126.100, 204.300, 130, 'UP')
ON CONFLICT (section_id) DO NOTHING;

-- Enable RLS for track_sections
ALTER TABLE track_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public track_sections select" ON track_sections;
CREATE POLICY "Public track_sections select" ON track_sections FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service track_sections all" ON track_sections;
CREATE POLICY "Service track_sections all" ON track_sections FOR ALL USING (true);


-- ==============================================================================
-- TABLE 2: maintenance_defects (Defect Ingestion from TMS, SMMS, TDMS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS maintenance_defects (
    defect_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_ref_id VARCHAR(100),                        -- Original ID from TMS/SMMS/TDMS
    source_system VARCHAR(20) NOT NULL DEFAULT 'TMS',     -- 'TMS', 'SMMS', 'TDMS', 'USFD', 'IoT_TRC'
    department VARCHAR(30) NOT NULL DEFAULT 'CIVIL',      -- 'CIVIL', 'S&T', 'TRD_OHE', 'Engineering', 'Signal', 'Electrical'
    section_id VARCHAR(50) NOT NULL REFERENCES track_sections(section_id) ON DELETE CASCADE,
    start_km NUMERIC(8, 3) NOT NULL,
    end_km NUMERIC(8, 3) NOT NULL,
    defect_type VARCHAR(120) NOT NULL,                   -- 'Rail Flaw', 'Point Machine Overhaul', 'OHE Catenary Sag'
    severity VARCHAR(20) DEFAULT 'MEDIUM',               -- 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    criticality_score INT NOT NULL DEFAULT 5,
    days_overdue INT NOT NULL DEFAULT 0,
    priority_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0,   -- AI composite score (0-100)
    priority_category VARCHAR(10) DEFAULT 'P3',          -- 'P1' (24h), 'P2' (72h), 'P3' (7d), 'P4' (Routine)
    required_track_closure BOOLEAN DEFAULT TRUE,
    requires_power_cut BOOLEAN DEFAULT FALSE,
    estimated_duration_minutes INT NOT NULL DEFAULT 120,
    assigned_gang_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING',                -- 'PENDING', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'RECTIFIED'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    rectified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_defects_section_km ON maintenance_defects(section_id, start_km, end_km);
CREATE INDEX IF NOT EXISTS idx_defects_priority ON maintenance_defects(priority_category, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_defects_status ON maintenance_defects(status, department);

-- Enable RLS for maintenance_defects
ALTER TABLE maintenance_defects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public maintenance_defects select" ON maintenance_defects;
CREATE POLICY "Public maintenance_defects select" ON maintenance_defects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public maintenance_defects insert" ON maintenance_defects;
CREATE POLICY "Public maintenance_defects insert" ON maintenance_defects FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public maintenance_defects update" ON maintenance_defects;
CREATE POLICY "Public maintenance_defects update" ON maintenance_defects FOR UPDATE USING (true);


-- ==============================================================================
-- TABLE 3: block_schedules (AI Corridor Bundling & Sanctioned Blocks)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS block_schedules (
    block_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id VARCHAR(50) NOT NULL REFERENCES track_sections(section_id),
    start_km NUMERIC(8, 3) NOT NULL,
    end_km NUMERIC(8, 3) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL,
    status VARCHAR(20) DEFAULT 'PROPOSED',               -- 'PROPOSED', 'ACCEPTED', 'APPROVED', 'GRANTED', 'EXECUTED', 'REJECTED'
    departments_involved TEXT[] NOT NULL DEFAULT ARRAY['CIVIL'],
    efficiency_score NUMERIC(5, 2) DEFAULT 85.00,       -- CP-SAT solver synergy efficiency score (0-100%)
    closure_time_saved_minutes INT DEFAULT 0,
    tasks_bundled_count INT DEFAULT 1,
    bundled_task_ids UUID[],
    granted_by VARCHAR(80),
    granted_at TIMESTAMPTZ,
    override_reason TEXT,
    audit_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_block_schedules_time ON block_schedules(section_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_block_schedules_status ON block_schedules(status);

-- Enable RLS for block_schedules
ALTER TABLE block_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public block_schedules select" ON block_schedules;
CREATE POLICY "Public block_schedules select" ON block_schedules FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public block_schedules insert" ON block_schedules;
CREATE POLICY "Public block_schedules insert" ON block_schedules FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public block_schedules update" ON block_schedules;
CREATE POLICY "Public block_schedules update" ON block_schedules FOR UPDATE USING (true);


-- ==============================================================================
-- TABLE 4: corridor_windows (Train Timetable & Line Possession Gaps)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS corridor_windows (
    window_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id VARCHAR(50) NOT NULL REFERENCES track_sections(section_id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL,
    headway_buffer_minutes INT DEFAULT 15,
    traffic_density_score NUMERIC(4, 2) DEFAULT 0.0,
    conflicting_passenger_trains INT DEFAULT 0,
    conflicting_freight_trains INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'AVAILABLE',              -- 'AVAILABLE', 'RESERVED', 'LOCKED'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_corridor_windows_time ON corridor_windows(section_id, window_start, window_end);

-- Enable RLS for corridor_windows
ALTER TABLE corridor_windows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public corridor_windows select" ON corridor_windows;
CREATE POLICY "Public corridor_windows select" ON corridor_windows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public corridor_windows insert" ON corridor_windows;
CREATE POLICY "Public corridor_windows insert" ON corridor_windows FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public corridor_windows update" ON corridor_windows;
CREATE POLICY "Public corridor_windows update" ON corridor_windows FOR UPDATE USING (true);


-- ==============================================================================
-- TABLE 5: immutable_action_audit_log (Tamper-Proof Audit Ledger)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS immutable_action_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq_id BIGSERIAL,
    
    -- Entry & Action Identification
    entry_name VARCHAR(120) NOT NULL,
    event_type VARCHAR(60) NOT NULL DEFAULT 'SYSTEM_ACTION',
    
    -- Logged-In User Provenance
    staff_id VARCHAR(80) NOT NULL,
    user_name VARCHAR(150) NOT NULL,
    user_role VARCHAR(80) NOT NULL,
    user_division VARCHAR(120) DEFAULT 'Northern Railway — Delhi Division',
    
    -- Spatial & Railway Assets
    section VARCHAR(160) NOT NULL,
    target_entity_id VARCHAR(100),
    
    -- Operational Impact
    reason TEXT NOT NULL,
    disruption_score NUMERIC(5,2) DEFAULT 0.0,
    delay_minutes INT DEFAULT 0,
    action_payload JSONB DEFAULT '{}'::jsonb,
    
    -- Cryptographic Chaining
    prev_hash TEXT NOT NULL DEFAULT 'GENESIS_HASH_IR_2026_00000000000000000000000000000000',
    record_hash TEXT NOT NULL,
    is_immutable BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Metadata
    client_ip VARCHAR(64) DEFAULT '127.0.0.1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON immutable_action_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_staff_id ON immutable_action_audit_log(staff_id);
CREATE INDEX IF NOT EXISTS idx_audit_entry_name ON immutable_action_audit_log(entry_name);
CREATE INDEX IF NOT EXISTS idx_audit_section ON immutable_action_audit_log(section);

-- Immutability Trigger: Strictly block UPDATE or DELETE
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

DROP TRIGGER IF EXISTS trg_prevent_action_audit_tampering ON immutable_action_audit_log;
CREATE TRIGGER trg_prevent_action_audit_tampering
    BEFORE UPDATE OR DELETE ON immutable_action_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_action_audit_tampering();

-- RLS Policies for Audit Log
ALTER TABLE immutable_action_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow audit log read" ON immutable_action_audit_log;
CREATE POLICY "Allow audit log read" ON immutable_action_audit_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow audit log insert" ON immutable_action_audit_log;
CREATE POLICY "Allow audit log insert" ON immutable_action_audit_log FOR INSERT WITH CHECK (true);

-- Done!

-- ============================================================================
-- postgis_railway.sql
-- Indian Railways AI Platform (RAKSHA PATH)
-- PostGIS Linear Referencing & Multi-Department Maintenance Database Schema
-- ============================================================================

-- 1. Spatial & Cryptographic Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Track Sections & Linear Rail Corridor Topology
CREATE TABLE IF NOT EXISTS track_sections (
    section_id VARCHAR(50) PRIMARY KEY,
    division VARCHAR(50) NOT NULL,                      -- e.g., 'NR', 'NCR', 'WR'
    sub_division VARCHAR(50) DEFAULT 'MAIN',            -- e.g., 'DLI', 'CNB'
    start_station VARCHAR(10) NOT NULL,                 -- e.g., 'NDLS'
    end_station VARCHAR(10) NOT NULL,                   -- e.g., 'CNB'
    start_km NUMERIC(8, 3) NOT NULL,
    end_km NUMERIC(8, 3) NOT NULL,
    max_permissible_speed INT NOT NULL DEFAULT 130,     -- Kmph (up to 160 for Vande Bharat)
    line_type VARCHAR(20) NOT NULL DEFAULT 'UP',        -- 'UP', 'DOWN', 'THIRD', 'FOURTH'
    electrification_type VARCHAR(20) DEFAULT '25KV_AC', -- '25KV_AC', '2X25KV_AC', 'NON_ELEC'
    traffic_density_gmt NUMERIC(6, 2) DEFAULT 45.0,    -- Gross Million Tonnes per annum
    track_structure VARCHAR(50) DEFAULT '60KG_PSC',     -- 60kg Rail on PSC Sleepers
    geom GEOMETRY(LineString, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_track_sections_geom ON track_sections USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_track_sections_div ON track_sections(division, line_type);

-- 3. Consolidated Multi-Department Maintenance Defects
-- Ingested from:
--   - TMS: Track Management System (Civil / Engineering / P-Way)
--   - SMMS: Signal Maintenance Management System (S&T / Axle Counters / Points)
--   - TDMS: Traction Distribution Management System (Electrical / TRD / OHE)
CREATE TABLE IF NOT EXISTS maintenance_defects (
    defect_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_ref_id VARCHAR(100),                        -- Original ID from TMS/SMMS/TDMS
    source_system VARCHAR(10) NOT NULL CHECK (source_system IN ('TMS', 'SMMS', 'TDMS', 'IoT_TRC', 'USFD', 'OMS')),
    department VARCHAR(20) NOT NULL CHECK (department IN ('Engineering', 'Signal', 'Electrical', 'CIVIL', 'S&T', 'TRD_OHE')),
    section_id VARCHAR(50) NOT NULL REFERENCES track_sections(section_id) ON DELETE CASCADE,
    start_km NUMERIC(8, 3) NOT NULL,
    end_km NUMERIC(8, 3) NOT NULL,
    defect_type VARCHAR(100) NOT NULL,                  -- 'Rail Flaw', 'Point Machine Overhaul', 'OHE Catenary Sag'
    severity VARCHAR(20) DEFAULT 'MEDIUM',              -- 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    criticality_score INT NOT NULL CHECK (criticality_score BETWEEN 1 AND 10),
    days_overdue INT NOT NULL DEFAULT 0,
    priority_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0,   -- Calculated AI composite score (0-100)
    priority_category VARCHAR(10) DEFAULT 'P3',         -- 'P1' (24h), 'P2' (72h), 'P3' (7d), 'P4' (Routine)
    required_track_closure BOOLEAN DEFAULT TRUE,
    requires_power_cut BOOLEAN DEFAULT FALSE,
    estimated_duration_minutes INT NOT NULL DEFAULT 120,
    assigned_gang_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING',               -- 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'RECTIFIED'
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rectified_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_defects_section_km ON maintenance_defects(section_id, start_km, end_km);
CREATE INDEX IF NOT EXISTS idx_defects_priority ON maintenance_defects(priority_category, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_defects_status ON maintenance_defects(status, department);

-- 4. Train Timetable & Headway Corridor Windows (Ingested from COA / FOIS)
CREATE TABLE IF NOT EXISTS corridor_windows (
    window_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id VARCHAR(50) NOT NULL REFERENCES track_sections(section_id) ON DELETE CASCADE,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INT NOT NULL,
    headway_buffer_minutes INT DEFAULT 15,
    traffic_density_score NUMERIC(4, 2) DEFAULT 0.0,    -- Lower is better (fewer conflicting trains)
    conflicting_passenger_trains INT DEFAULT 0,
    conflicting_freight_trains INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'AVAILABLE',             -- 'AVAILABLE', 'RESERVED', 'LOCKED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_corridor_windows_time ON corridor_windows(section_id, window_start, window_end);

-- 5. AI-Generated & Approved Block Schedules (Mega-Blocks / Shadow Blocks)
CREATE TABLE IF NOT EXISTS block_schedules (
    block_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id VARCHAR(50) NOT NULL REFERENCES track_sections(section_id),
    start_km NUMERIC(8, 3) NOT NULL,
    end_km NUMERIC(8, 3) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INT NOT NULL,
    status VARCHAR(20) DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'APPROVED', 'GRANTED', 'REJECTED', 'CANCELLED', 'EXECUTED')),
    departments_involved TEXT[] NOT NULL,               -- e.g. ARRAY['Engineering', 'Signal', 'Electrical']
    efficiency_score NUMERIC(5, 2) DEFAULT 85.00,       -- Track possession savings metric
    closure_time_saved_minutes INT DEFAULT 0,
    tasks_bundled_count INT DEFAULT 1,
    bundled_task_ids UUID[],
    granted_by VARCHAR(50),
    granted_at TIMESTAMP WITH TIME ZONE,
    override_reason TEXT,
    audit_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_block_schedules_time ON block_schedules(section_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_block_schedules_status ON block_schedules(status);

-- 6. Sample Initial Corridor Data (New Delhi - Kanpur High Density Corridor)
INSERT INTO track_sections (section_id, division, start_station, end_station, start_km, end_km, max_permissible_speed, line_type, geom)
VALUES 
    ('NDLS-CNB-UP', 'NR', 'NDLS', 'CNB', 0.000, 440.000, 160, 'UP', ST_GeomFromText('LINESTRING(77.2167 28.6139, 80.3319 26.4499)', 4326)),
    ('NDLS-CNB-DN', 'NR', 'CNB', 'NDLS', 0.000, 440.000, 160, 'DOWN', ST_GeomFromText('LINESTRING(80.3319 26.4499, 77.2167 28.6139)', 4326)),
    ('DLI-GZB-UP', 'NR', 'DLI', 'GZB', 0.000, 24.500, 110, 'UP', ST_GeomFromText('LINESTRING(77.2289 28.6606, 77.4260 28.6692)', 4326))
ON CONFLICT (section_id) DO NOTHING;

-- Block section schema
CREATE TABLE IF NOT EXISTS blocks (id SERIAL PRIMARY KEY, section_id VARCHAR(20) NOT NULL, status VARCHAR(20) DEFAULT 'clear', allocated_to INTEGER, updated_at TIMESTAMPTZ DEFAULT NOW());

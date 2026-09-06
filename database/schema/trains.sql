-- Trains schema
CREATE TABLE IF NOT EXISTS trains (id SERIAL PRIMARY KEY, train_number VARCHAR(10), name VARCHAR(100), current_block VARCHAR(20), last_seen TIMESTAMPTZ);

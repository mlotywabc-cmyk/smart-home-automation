
CREATE TABLE IF NOT EXISTS app_users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    temperature DOUBLE PRECISION,
    humidity DOUBLE PRECISION,
    rain_detected BOOLEAN,
    motor_open BOOLEAN,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(30) NOT NULL
        CHECK (event_type IN (
            'RFID',
            'RAIN',
            'MOTOR',
            'TEMPERATURE',
            'SYSTEM'
        )),
    message VARCHAR(250) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_commands (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(10) NOT NULL
        CHECK (action IN ('OPEN', 'CLOSE')),
    status VARCHAR(15) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING',
            'SENT',
            'COMPLETED',
            'FAILED'
        )),
    requested_by BIGINT REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_created_at
    ON events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_commands_pending
    ON device_commands (status, created_at)
    WHERE status = 'PENDING';

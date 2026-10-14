
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pg from "pg";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : null;

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: (process.env.FRONTEND_URL || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean),
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Device-Token"],
}));
app.use(express.json({ limit: "20kb" }));

app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
}));

function requireDatabase(req, res, next) {
  if (!pool) {
    return res.status(503).json({
      error: "Database is not configured.",
    });
  }
  next();
}

function requireDevice(req, res, next) {
  const token = process.env.DEVICE_TOKEN;
  if (!token || req.get("X-Device-Token") !== token) {
    return res.status(401).json({
      error: "Invalid device credentials.",
    });
  }
  next();
}

function requireAuth(req, res, next) {
  const header = req.get("Authorization") || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired session.",
    });
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Smart Home Automation API",
    databaseConfigured: Boolean(pool),
  });
});

app.post("/api/auth/login", requireDatabase, async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Username and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT id, username, password_hash
       FROM app_users
       WHERE username = $1`,
      [username.trim()]
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: "Incorrect username or password.",
      });
    }

    const token = jwt.sign(
      { sub: String(user.id), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Login failed." });
  }
});

app.get("/api/status", requireAuth, requireDatabase, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT temperature, humidity, rain_detected,
              motor_open, updated_at
       FROM device_status
       WHERE id = 1`
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error("Status error:", error.message);
    res.status(500).json({ error: "Could not load device status." });
  }
});

app.get("/api/events", requireAuth, requireDatabase, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, event_type, message, details, created_at
       FROM events
       ORDER BY created_at DESC
       LIMIT 100`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Events error:", error.message);
    res.status(500).json({ error: "Could not load events." });
  }
});

app.post("/api/device/status", requireDevice, requireDatabase, async (req, res) => {
  try {
    const { temperature, humidity, rainDetected, motorOpen } = req.body || {};

    if (
      (temperature != null &&
        (typeof temperature !== "number" ||
          !Number.isFinite(temperature) ||
          temperature < -50 ||
          temperature > 100)) ||
      (humidity != null &&
        (typeof humidity !== "number" ||
          !Number.isFinite(humidity) ||
          humidity < 0 ||
          humidity > 100)) ||
      (rainDetected != null && typeof rainDetected !== "boolean") ||
      (motorOpen != null && typeof motorOpen !== "boolean")
    ) {
      return res.status(400).json({ error: "Invalid sensor data." });
    }

    await pool.query(
      `INSERT INTO device_status
        (id, temperature, humidity, rain_detected, motor_open, updated_at)
       VALUES (1, $1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         temperature = COALESCE(EXCLUDED.temperature, device_status.temperature),
         humidity = COALESCE(EXCLUDED.humidity, device_status.humidity),
         rain_detected = COALESCE(EXCLUDED.rain_detected, device_status.rain_detected),
         motor_open = COALESCE(EXCLUDED.motor_open, device_status.motor_open),
         updated_at = NOW()`,
      [
        temperature ?? null,
        humidity ?? null,
        rainDetected ?? null,
        motorOpen ?? null,
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Device status error:", error.message);
    res.status(500).json({ error: "Could not save device status." });
  }
});

app.post("/api/device/events", requireDevice, requireDatabase, async (req, res) => {
  try {
    const { eventType, message, details } = req.body || {};
    const allowedTypes = ["RFID", "RAIN", "MOTOR", "TEMPERATURE", "SYSTEM"];

    if (
      !allowedTypes.includes(eventType) ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 250
    ) {
      return res.status(400).json({ error: "Invalid event." });
    }

    const result = await pool.query(
      `INSERT INTO events (event_type, message, details)
       VALUES ($1, $2, $3)
       RETURNING id, event_type, message, details, created_at`,
      [
        eventType,
        message.trim(),
        details && typeof details === "object" ? details : {},
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Device event error:", error.message);
    res.status(500).json({ error: "Could not record event." });
  }
});

app.post("/api/commands", requireAuth, requireDatabase, async (req, res) => {
  try {
    const { action } = req.body || {};

    if (!["OPEN", "CLOSE"].includes(action)) {
      return res.status(400).json({
        error: "Action must be OPEN or CLOSE.",
      });
    }

    const result = await pool.query(
      `INSERT INTO device_commands (action, requested_by)
       VALUES ($1, $2)
       RETURNING id, action, status, created_at`,
      [action, req.user.sub]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Command error:", error.message);
    res.status(500).json({ error: "Could not queue command." });
  }
});

app.get("/api/device/commands", requireDevice, requireDatabase, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, action
       FROM device_commands
       WHERE status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.json({ command: null });
    }

    const command = result.rows[0];

    await pool.query(
      `UPDATE device_commands
       SET status = 'SENT', updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'`,
      [command.id]
    );

    res.json({ command });
  } catch (error) {
    console.error("Command retrieval error:", error.message);
    res.status(500).json({ error: "Could not retrieve commands." });
  }
});

app.post("/api/device/commands/:id/ack", requireDevice, requireDatabase, async (req, res) => {
  try {
    const { status } = req.body || {};

    if (!["COMPLETED", "FAILED"].includes(status)) {
      return res.status(400).json({ error: "Invalid command status." });
    }

    const result = await pool.query(
      `UPDATE device_commands
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'SENT'
       RETURNING id, status`,
      [status, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Command not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Command acknowledgement error:", error.message);
    res.status(500).json({ error: "Could not acknowledge command." });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Smart Home API listening on port ${PORT}`);
});

async function shutdown() {
  server.close();
  if (pool) await pool.end();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);


import React, { useState } from "react";

const initialEvents = [
  {
    id: 1,
    type: "System",
    message: "Dashboard initialized",
    time: new Date().toLocaleTimeString(),
  },
];

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [events, setEvents] = useState(initialEvents);
  const [motorOpen, setMotorOpen] = useState(false);
  const [temperature, setTemperature] = useState("--");
  const [humidity, setHumidity] = useState("--");
  const [rainDetected, setRainDetected] = useState(false);
  const [connection, setConnection] = useState("Not connected");

  function addEvent(message, type = "System") {
    setEvents((previous) => [
      {
        id: Date.now(),
        type,
        message,
        time: new Date().toLocaleTimeString(),
      },
      ...previous,
    ]);
  }

  function login(event) {
    event.preventDefault();

    if (username.trim() && password.length >= 4) {
      setLoggedIn(true);
      addEvent("Dashboard login successful");
    } else {
      alert("Enter a username and a password of at least 4 characters.");
    }
  }

  function controlMotor(open) {
    setMotorOpen(open);
    addEvent(
      `Motor ${open ? "open" : "close"} requested`,
      "Motor"
    );
  }

  if (!loggedIn) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={login}>
          <div className="brand-icon">⌂</div>
          <p className="eyebrow">SMART HOME AUTOMATION</p>
          <h1>Welcome home</h1>
          <p className="muted">
            Sign in to view your smart home dashboard.
          </p>

          <label htmlFor="username">Username</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoComplete="username"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            minLength={4}
            required
          />

          <button className="primary-button" type="submit">
            Sign in
          </button>
          <p className="demo-note">
            Prototype only: use any username and a password
            of at least 4 characters. Real authentication
            will be added through the backend.
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon small">⌂</span>
          <div>
            <h2>Smart Home</h2>
            <p>Automation Control Center</p>
          </div>
        </div>
        <button
          className="secondary-button"
          onClick={() => setLoggedIn(false)}
        >
          Sign out
        </button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">YOUR HOME AT A GLANCE</p>
          <h1>Dashboard</h1>
          <p className="muted">
            Monitor your home and manage connected devices.
          </p>
        </div>
        <span className="status-pill">{connection}</span>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-icon">🌡️</span>
          <p>Temperature</p>
          <h2>{temperature}{temperature === "--" ? "" : " °C"}</h2>
          <span className="muted">Waiting for ESP32</span>
        </article>

        <article className="stat-card">
          <span className="stat-icon">💧</span>
          <p>Humidity</p>
          <h2>{humidity}{humidity === "--" ? "" : " %"}</h2>
          <span className="muted">Waiting for sensor data</span>
        </article>

        <article className="stat-card">
          <span className="stat-icon">🌧️</span>
          <p>Rain detection</p>
          <h2>{rainDetected ? "Detected" : "Unknown"}</h2>
          <span className="muted">
            {rainDetected ? "Rain event reported" : "Waiting for ESP32"}
          </span>
        </article>

        <article className="stat-card">
          <span className="stat-icon">🚪</span>
          <p>Motor position</p>
          <h2>{motorOpen ? "Open" : "Closed"}</h2>
          <span className="muted">Prototype control state</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Device controls</h2>
              <p className="muted">
                Request an action from your smart home.
              </p>
            </div>
            <span className="device-icon">⚙️</span>
          </div>

          <div className="device-row">
            <div>
              <h3>Servo motor</h3>
              <p className="muted">
                Current prototype state: {motorOpen ? "Open" : "Closed"}
              </p>
            </div>
            <span className={motorOpen ? "toggle on" : "toggle"}>
              {motorOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>

          <div className="button-row">
            <button
              className="primary-button"
              onClick={() => controlMotor(true)}
            >
              Open motor
            </button>
            <button
              className="secondary-button"
              onClick={() => controlMotor(false)}
            >
              Close motor
            </button>
          </div>

          <p className="demo-note">
            These buttons currently change the dashboard display
            only. They do not move your physical motor yet.
          </p>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>System status</h2>
              <p className="muted">Connection overview</p>
            </div>
            <span className="device-icon">📡</span>
          </div>

          <div className="system-row">
            <span>ESP32 controller</span>
            <span className="status-pill offline">Not connected</span>
          </div>
          <div className="system-row">
            <span>Backend API</span>
            <span className="status-pill offline">Not configured</span>
          </div>
          <div className="system-row">
            <span>Event database</span>
            <span className="status-pill offline">Not configured</span>
          </div>
        </article>
      </section>

      <section className="panel events-panel">
        <div className="panel-heading">
          <div>
            <h2>Event history</h2>
            <p className="muted">
              Recent activity recorded in this browser session.
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={() => setEvents([])}
          >
            Clear history
          </button>
        </div>

        {events.length === 0 ? (
          <p className="empty-state">No events recorded yet.</p>
        ) : (
          <div className="event-list">
            {events.map((event) => (
              <div className="event-row" key={event.id}>
                <span className="event-dot" />
                <div className="event-details">
                  <strong>{event.message}</strong>
                  <p className="muted">{event.type}</p>
                </div>
                <time>{event.time}</time>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer>
        Smart Home Automation · Prototype version
      </footer>
    </main>
  );
}

export default App;

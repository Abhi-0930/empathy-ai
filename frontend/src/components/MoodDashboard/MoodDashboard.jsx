import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Calendar, TrendingUp } from "lucide-react";
import "./MoodDashboard.css";

const rangeOptions = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const MoodDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [totals, setTotals] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/auth");
          return;
        }

        // Fetch user profile to get user_id
        const profileRes = await fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profileData = await profileRes.json();
        if (!profileRes.ok) {
          navigate("/auth");
          return;
        }
        setUser(profileData);

        const trendsRes = await fetch(
          `http://127.0.0.1:5001/mood-trends?user_id=${encodeURIComponent(
            profileData._id
          )}&range=${range}`
        );
        if (!trendsRes.ok) {
          throw new Error("Failed to load mood trends");
        }
        const trends = await trendsRes.json();
        setBuckets(trends.buckets || []);
        setTotals(trends.totals || {});
      } catch (err) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [range, navigate]);

  const mostFrequentEmotion =
    Object.keys(totals).length > 0
      ? Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  const totalEntries = Object.values(totals).reduce(
    (sum, v) => sum + v,
    0
  );

  const daysTracked = buckets.length;

  const maxCountForScale =
    buckets.length > 0
      ? Math.max(
          ...buckets.map((b) =>
            Object.values(b.counts || {}).reduce(
              (s, v) => s + v,
              0
            )
          )
        )
      : 0;

  return (
    <div className="app-container light">
      <div className="mood-dashboard-layout">
        <header className="mood-dashboard-header">
          <button
            type="button"
            className="mood-back-btn"
            onClick={() => navigate("/chatbot-page")}
          >
            <ArrowLeft size={18} />
            <span>Back to chats</span>
          </button>
          <div className="mood-header-main">
            <div className="mood-header-title-row">
              <Activity size={24} className="mood-header-icon" />
              <div>
                <h1>Mood Trends</h1>
                <p>
                  Visual overview of how your emotions have been evolving
                  over time.
                </p>
              </div>
            </div>
            <div className="mood-range-toggle">
              {rangeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={
                    range === opt.value ? "range-chip active" : "range-chip"
                  }
                  onClick={() => setRange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="mood-dashboard-main">
          {loading ? (
            <div className="mood-loading-card">
              <div className="spinner" />
              <p>Loading your mood trends...</p>
            </div>
          ) : error ? (
            <div className="mood-error-card">
              <p>{error}</p>
            </div>
          ) : buckets.length === 0 ? (
            <div className="mood-empty-card">
              <h3>No data yet</h3>
              <p>
                Start a few chat sessions so we can build a picture of your
                emotional patterns.
              </p>
            </div>
          ) : (
            <>
              <section className="mood-summary-grid">
                <div className="mood-summary-card">
                  <h4>Most frequent emotion</h4>
                  <p className="mood-summary-value">
                    {mostFrequentEmotion || "—"}
                  </p>
                  <span className="mood-summary-label">
                    Based on all messages in this period
                  </span>
                </div>
                <div className="mood-summary-card">
                  <h4>Days tracked</h4>
                  <p className="mood-summary-value">{daysTracked}</p>
                  <span className="mood-summary-label">
                    Unique days with at least one message
                  </span>
                </div>
                <div className="mood-summary-card">
                  <h4>Total entries</h4>
                  <p className="mood-summary-value">{totalEntries}</p>
                  <span className="mood-summary-label">
                    Messages with an identified dominant emotion
                  </span>
                </div>
              </section>

              <section className="mood-content-grid">
                <div className="mood-card">
                  <div className="mood-card-header">
                    <h3>
                      <TrendingUp size={18} /> Daily mood timeline
                    </h3>
                    <span>
                      One bar per day, coloured by the dominant emotion
                    </span>
                  </div>
                  <div className="mood-timeline">
                    {buckets.map((bucket) => {
                      const totalForDay = Object.values(
                        bucket.counts || {}
                      ).reduce((s, v) => s + v, 0);
                      const maxBarHeightPx = 140; // within 180px container
                      const barHeight =
                        maxCountForScale > 0
                          ? (totalForDay / maxCountForScale) * maxBarHeightPx
                          : 0;
                      const emotion = bucket.dominant_emotion || "unknown";
                      return (
                        <div
                          key={bucket.date}
                          className="mood-timeline-item"
                        >
                          <div className="mood-timeline-bar-wrapper">
                            <div
                              className={`mood-timeline-bar mood-${emotion}`}
                              style={{
                                height: `${Math.max(40, barHeight)}px`,
                              }}
                              title={`${bucket.date} – ${emotion} (${totalForDay} entries)`}
                            />
                          </div>
                          <span className="mood-timeline-date">
                            {bucket.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mood-legend">
                    {Object.keys(totals).map((emotion) => (
                      <span key={emotion} className="mood-legend-item">
                        <span className={`mood-dot mood-${emotion}`} />
                        <span>{emotion}</span>
                      </span>
                    ))}
                  </div>
                  <table className="mood-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Dominant emotion</th>
                        <th>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.map((bucket) => {
                        const totalForDay = Object.values(
                          bucket.counts || {}
                        ).reduce((s, v) => s + v, 0);
                        return (
                          <tr key={bucket.date}>
                            <td>{bucket.date}</td>
                            <td>{bucket.dominant_emotion || "—"}</td>
                            <td>{totalForDay}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mood-card">
                  <div className="mood-card-header">
                    <h3>
                      <Calendar size={18} /> Emotion breakdown
                    </h3>
                    <span>How often each emotion has appeared</span>
                  </div>
                  <ul className="mood-breakdown-list">
                    {Object.entries(totals)
                      .sort((a, b) => b[1] - a[1])
                      .map(([emotion, count]) => {
                        const pct =
                          totalEntries > 0
                            ? Math.round((count / totalEntries) * 100)
                            : 0;
                        return (
                          <li
                            key={emotion}
                            className="mood-breakdown-item"
                          >
                            <div className="mood-breakdown-label">
                              <span
                                className={`mood-dot mood-${emotion}`}
                              />
                              <span>{emotion}</span>
                            </div>
                            <div className="mood-breakdown-bar">
                              <div
                                className="mood-breakdown-bar-fill"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="mood-breakdown-count">
                              {count} ({pct}%)
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default MoodDashboard;


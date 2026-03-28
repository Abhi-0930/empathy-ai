import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChartColumn, Flame, Brain } from "lucide-react";
import "./Insights.css";

const Insights = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [personalization, setPersonalization] = useState(null);
  const [exerciseSummary, setExerciseSummary] = useState([]);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/auth");
          return;
        }

        const profileRes = await fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!profileRes.ok) {
          navigate("/auth");
          return;
        }
        const profile = await profileRes.json();

        const [personalizationRes, exerciseRes] = await Promise.all([
          fetch(`/api/users/${profile._id}/personalization-summary`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/exercises/usage/summary/me", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!personalizationRes.ok) {
          throw new Error("Failed to load personalization summary");
        }
        if (!exerciseRes.ok) {
          throw new Error("Failed to load exercise insights");
        }

        const personalizationData = await personalizationRes.json();
        const exerciseData = await exerciseRes.json();

        setPersonalization(personalizationData);
        setExerciseSummary(
          (personalizationData?.exercise_preferences || []).length > 0
            ? personalizationData.exercise_preferences
            : exerciseData || []
        );
      } catch (err) {
        setError(err.message || "Unable to load insights");
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [navigate]);

  const topEmotion = useMemo(() => {
    const dist = personalization?.baseline?.emotion_distribution || [];
    return dist.length > 0 ? dist[0] : null;
  }, [personalization]);

  return (
    <div className="app-container light">
      <div className="insights-layout">
        <header className="insights-header">
          <button
            type="button"
            className="insights-back-btn"
            onClick={() => navigate("/chatbot-page")}
          >
            <ArrowLeft size={18} />
            <span>Back to chats</span>
          </button>
          <div className="insights-header-main">
            <div className="insights-header-title-row">
              <ChartColumn size={24} className="insights-header-icon" />
              <div>
                <h1>Advanced insights</h1>
                <p>
                  Your long-term emotional patterns, recurring topics, and exercise habits.
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="insights-main">
          {loading ? (
            <div className="insights-card">Loading insights...</div>
          ) : error ? (
            <div className="insights-card error">{error}</div>
          ) : (
            <>
              <section className="insights-grid">
                <div className="insights-card">
                  <h3>
                    <Brain size={17} /> Personalization snapshot
                  </h3>
                  <p className="insights-value">
                    {personalization?.summary || "No summary available yet."}
                  </p>
                </div>

                <div className="insights-card">
                  <h3>
                    <ChartColumn size={17} /> Baseline mood profile (30d)
                  </h3>
                  <p className="insights-value">
                    {topEmotion
                      ? `Most frequent emotion: ${topEmotion.emotion} (${topEmotion.percentage}%)`
                      : "Not enough mood data yet."}
                  </p>
                  <ul className="insights-list">
                    {(personalization?.baseline?.emotion_distribution || []).map((item) => (
                      <li key={item.emotion}>
                        {item.emotion}: {item.count} entries ({item.percentage}%)
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="insights-card">
                  <h3>
                    <Flame size={17} /> Exercise effectiveness signals
                  </h3>
                  {exerciseSummary.length === 0 ? (
                    <p className="insights-value">No completed exercise data yet.</p>
                  ) : (
                    <ul className="insights-list">
                      {exerciseSummary.slice(0, 6).map((entry) => (
                        <li key={entry.exerciseId}>
                          {entry.name || entry.exerciseId}: completed {entry.completed || entry.completedCount || 0} times
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="insights-card">
                  <h3>
                    <Brain size={17} /> Recurring conversation topics
                  </h3>
                  {(personalization?.recurring_topics || []).length === 0 ? (
                    <p className="insights-value">No strong recurring topics yet.</p>
                  ) : (
                    <div className="insights-tags">
                      {personalization.recurring_topics.map((topic) => (
                        <span key={topic} className="insights-tag">
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="insights-disclaimer">
                <p>
                  These insights are for self-reflection and wellness support only.
                  They are not a medical diagnosis or professional mental health advice.
                </p>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Insights;

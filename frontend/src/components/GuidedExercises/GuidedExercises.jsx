import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Activity, Clock, Play, CheckCircle2 } from "lucide-react";
import "./GuidedExercises.css";

const GuidedExercises = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [exercises, setExercises] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeExercise, setActiveExercise] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/exercises");
        if (!res.ok) {
          throw new Error("Failed to load exercises");
        }
        const data = await res.json();
        setExercises(data);

        const idFromQuery = searchParams.get("id");
        if (idFromQuery) {
          const found = data.find((e) => e.exerciseId === idFromQuery);
          if (found) {
            setActiveId(found.exerciseId);
            setActiveExercise(found);
            setStepIndex(0);
          }
        }
      } catch (err) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchParams]);

  const selectExercise = (exercise) => {
    setActiveId(exercise.exerciseId);
    setActiveExercise(exercise);
    setStepIndex(0);
  };

  const currentStep =
    activeExercise && activeExercise.steps && activeExercise.steps[stepIndex];

  const handleNextStep = async () => {
    if (!activeExercise) return;
    if (stepIndex < activeExercise.steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      // finished
      setStepIndex(stepIndex);
      const token = localStorage.getItem("token");
      if (token) {
        fetch(`/api/exercises/${activeExercise.exerciseId}/usage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "completed" }),
        }).catch(() => {});
      }
    }
  };

  return (
    <div className="app-container light">
      <div className="guided-layout">
        <header className="guided-header">
          <button
            type="button"
            className="guided-back-btn"
            onClick={() => navigate("/chatbot-page")}
          >
            <ArrowLeft size={18} />
            <span>Back to chats</span>
          </button>
          <div className="guided-header-main">
            <div className="guided-header-title-row">
              <Activity size={24} className="guided-header-icon" />
              <div>
                <h1>Guided exercises</h1>
                <p>
                  Short, structured activities to help you breathe, ground, and
                  relax.
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="guided-main">
          {loading ? (
            <div className="guided-loading">Loading exercises…</div>
          ) : error ? (
            <div className="guided-error">{error}</div>
          ) : (
            <div className="guided-grid">
              <aside className="guided-list">
                {exercises.map((ex) => (
                  <button
                    key={ex._id || ex.exerciseId}
                    type="button"
                    className={`guided-list-item ${
                      activeId === ex.exerciseId ? "active" : ""
                    }`}
                    onClick={() => selectExercise(ex)}
                  >
                    <div className="guided-list-title">{ex.name}</div>
                    <div className="guided-list-meta">
                      <span className={`tag tag-${ex.type}`}>
                        {ex.type.charAt(0).toUpperCase() + ex.type.slice(1)}
                      </span>
                      <span className="dot">•</span>
                      <span className="tag tag-muted">
                        {ex.difficulty || "easy"}
                      </span>
                      <span className="dot">•</span>
                      <span className="tag tag-muted">
                        <Clock size={12} />
                        <span>{ex.durationMinutes || 5} min</span>
                      </span>
                    </div>
                  </button>
                ))}
              </aside>

              <section className="guided-detail">
                {!activeExercise ? (
                  <div className="guided-empty">
                    <p>Select an exercise on the left to begin.</p>
                  </div>
                ) : (
                  <div className="guided-player">
                    <div className="guided-player-header">
                      <h2>{activeExercise.name}</h2>
                      <div className="guided-player-tags">
                        <span className={`tag tag-${activeExercise.type}`}>
                          {activeExercise.type}
                        </span>
                        <span className="tag tag-muted">
                          {activeExercise.difficulty} •{" "}
                          {activeExercise.durationMinutes || 5} min
                        </span>
                      </div>
                    </div>

                    {currentStep && (
                      <div className="guided-step-card">
                        <div className="guided-step-index">
                          Step {stepIndex + 1} of{" "}
                          {activeExercise.steps.length}
                        </div>
                        <h3>{currentStep.title}</h3>
                        <p>{currentStep.description}</p>
                      </div>
                    )}

                    <div className="guided-step-footer">
                      <div className="guided-step-progress">
                        {activeExercise.steps.map((_, i) => (
                          <span
                            key={i}
                            className={
                              i <= stepIndex
                                ? "guided-dot guided-dot-active"
                                : "guided-dot"
                            }
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="guided-next-btn"
                        onClick={handleNextStep}
                      >
                        {stepIndex < (activeExercise.steps?.length || 0) - 1 ? (
                          <>
                            <Play size={16} />
                            <span>Next step</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={16} />
                            <span>Finish exercise</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default GuidedExercises;


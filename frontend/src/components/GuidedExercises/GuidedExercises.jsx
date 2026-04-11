import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Flame, Clock, Play, CheckCircle2, Mic } from "lucide-react";
import Confetti from "react-confetti";
import "./GuidedExercises.css";
import { BACKEND_URL } from "../../api.config";

const GuidedExercises = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [exercises, setExercises] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeExercise, setActiveExercise] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [groundingNotes, setGroundingNotes] = useState({});
  const [isGroundingListening, setIsGroundingListening] = useState(false);
  const [isExerciseCompleted, setIsExerciseCompleted] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${BACKEND_URL}/api/exercises`);
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
    setIsExerciseCompleted(false);

    // Track start for analytics
    const token = localStorage.getItem("token");
    if (token) {
      fetch(`${BACKEND_URL}/api/exercises/${exercise.exerciseId}/usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "started" }),
      }).catch(() => {});
    }
  };

  const currentStep =
    activeExercise && activeExercise.steps && activeExercise.steps[stepIndex];

  const progressPercent =
    activeExercise && activeExercise.steps?.length
      ? Math.round(
          ((stepIndex + 1) / activeExercise.steps.length) * 100
        )
      : 0;

  const currentGroundingKey =
    activeExercise && activeExercise.exerciseId === "grounding-5-senses"
      ? `${activeExercise.exerciseId}-${stepIndex}`
      : null;

  const currentGroundingNote = currentGroundingKey
    ? groundingNotes[currentGroundingKey] || ""
    : "";

  const handleGroundingChange = (value) => {
    if (!currentGroundingKey) return;
    setGroundingNotes((prev) => ({
      ...prev,
      [currentGroundingKey]: value,
    }));
  };

  const handleGroundingDictate = () => {
    if (!currentGroundingKey) return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsGroundingListening(true);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setGroundingNotes((prev) => {
        const existing = prev[currentGroundingKey] || "";
        return {
          ...prev,
          [currentGroundingKey]: existing
            ? `${existing} ${transcript}`
            : transcript,
        };
      });
    };
    recognition.onerror = () => {
      setIsGroundingListening(false);
    };
    recognition.onend = () => {
      setIsGroundingListening(false);
    };
    recognition.start();
  };

  useEffect(() => {
    // Reset timer when exercise/step changes
    if (!activeExercise) {
      setCountdown(null);
      setIsTimerRunning(false);
      return;
    }
    const step =
      activeExercise.steps && activeExercise.steps[stepIndex]
        ? activeExercise.steps[stepIndex]
        : null;
    if (step && typeof step.durationSeconds === "number") {
      setCountdown(step.durationSeconds);
    } else {
      setCountdown(null);
    }
    setIsTimerRunning(false);
  }, [activeExercise, stepIndex]);

  useEffect(() => {
    if (!isExerciseCompleted) return;
    const timeoutId = setTimeout(() => {
      setIsExerciseCompleted(false);
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [isExerciseCompleted]);

  useEffect(() => {
    if (!isTimerRunning || countdown == null) return;
    if (countdown <= 0) {
      setIsTimerRunning(false);
      return;
    }
    const id = setTimeout(
      () => setCountdown((c) => (c > 0 ? c - 1 : 0)),
      1000
    );
    return () => clearTimeout(id);
  }, [isTimerRunning, countdown]);

  const handleToggleTimer = () => {
    if (countdown == null) return;
    setIsTimerRunning((prev) => !prev);
  };

  const handleNextStep = async () => {
    if (!activeExercise) return;
    if (stepIndex < activeExercise.steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      // finished
      setStepIndex(stepIndex);
      setIsExerciseCompleted(true);
      const token = localStorage.getItem("token");
      if (token) {
        fetch(`${BACKEND_URL}/api/exercises/${activeExercise.exerciseId}/usage`, {
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
              <Flame size={24} className="guided-header-icon" />
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

                    {currentStep && !isExerciseCompleted && (
                      <div className="guided-step-card">
                        <div className="guided-step-index">
                          Step {stepIndex + 1} of{" "}
                          {activeExercise.steps.length}
                        </div>
                        {typeof currentStep.durationSeconds === "number" && (
                          <div className="guided-timer">
                            <div className="guided-timer-circle">
                              <span>
                                {countdown ?? currentStep.durationSeconds}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="guided-timer-btn"
                              onClick={handleToggleTimer}
                            >
                              {isTimerRunning ? "Pause" : "Start"}
                            </button>
                          </div>
                        )}
                        <div className="guided-step-progress-bar">
                          <div
                            className="guided-step-progress-bar-fill"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <h3>{currentStep.title}</h3>
                        <p>{currentStep.description}</p>
                        {activeExercise.exerciseId === "grounding-5-senses" && (
                          <div className="guided-grounding-input">
                            <label>
                              Write or speak what you notice for this step:
                            </label>
                            <div className="guided-grounding-row">
                              <textarea
                                value={currentGroundingNote}
                                onChange={(e) =>
                                  handleGroundingChange(e.target.value)
                                }
                                placeholder="Type a few words…"
                              />
                              <button
                                type="button"
                                className={`guided-mic-btn ${
                                  isGroundingListening ? "listening" : ""
                                }`}
                                onClick={handleGroundingDictate}
                              >
                                <Mic size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!isExerciseCompleted && (
                      <div className="guided-step-footer">
                        <div className="guided-step-progress">
                          {activeExercise.steps.map((step, i) => (
                            <div
                              key={i}
                              className={
                                i < stepIndex
                                  ? "guided-step-pill completed"
                                  : i === stepIndex
                                  ? "guided-step-pill active"
                                  : "guided-step-pill"
                              }
                            >
                              <span className="guided-step-pill-index">
                                {i + 1}
                              </span>
                              <span className="guided-step-pill-title">
                                {step.title}
                              </span>
                            </div>
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
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>

        {isExerciseCompleted && (
          <div className="guided-complete-overlay">
            <div className="guided-complete-confetti-wrap" aria-hidden="true">
              <Confetti
                numberOfPieces={140}
                recycle={false}
                gravity={1.25}
                initialVelocityY={22}
                wind={0}
              />
            </div>
            <div className="guided-complete-modal">
              <h2 className="guided-complete-title">Hurray, you finished this exercise!</h2>
              <p className="guided-complete-text">
                Take a slow, deep breath and notice any small shift in how you feel.
                Moments like this are quiet wins for your mind.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuidedExercises;


import express from "express";
import Exercise from "../models/exercise.model.js";
import ExerciseUsage from "../models/exerciseUsage.model.js";
import { authenticateUser } from "../middleware/auth.middleware.js";

const router = express.Router();

// Seed a small set of default exercises if collection is empty
const defaultExercises = [
  {
    exerciseId: "breathing-box-1",
    name: "Box Breathing (4x4)",
    type: "breathing",
    difficulty: "easy",
    durationMinutes: 5,
    steps: [
      {
        title: "Inhale",
        description: "Breathe in slowly through your nose for a count of 4.",
        durationSeconds: 4,
      },
      {
        title: "Hold",
        description: "Gently hold your breath for a count of 4.",
        durationSeconds: 4,
      },
      {
        title: "Exhale",
        description: "Exhale slowly through your mouth for a count of 4.",
        durationSeconds: 4,
      },
      {
        title: "Pause",
        description: "Rest for a count of 4 before starting the next cycle.",
        durationSeconds: 4,
      },
    ],
    triggers: ["anxious", "overwhelmed", "stressed"],
  },
  {
    exerciseId: "grounding-5-senses",
    name: "5‑Senses Grounding",
    type: "grounding",
    difficulty: "easy",
    durationMinutes: 7,
    steps: [
      {
        title: "5 things you can see",
        description:
          "Look around and name five things you can see, saying them slowly in your mind or out loud.",
      },
      {
        title: "4 things you can feel",
        description:
          "Notice four things you can physically feel (e.g. your feet on the floor, your clothes on your skin).",
      },
      {
        title: "3 things you can hear",
        description:
          "Listen for three different sounds, near or far, and label them.",
      },
      {
        title: "2 things you can smell",
        description:
          "Notice two smells around you, or remember pleasant scents if none are present.",
      },
      {
        title: "1 thing you can taste",
        description:
          "Focus on one taste in your mouth, or imagine a favourite flavour.",
      },
    ],
    triggers: ["anxious", "dissociated"],
  },
  {
    exerciseId: "relaxation-body-scan",
    name: "Short Body Scan",
    type: "relaxation",
    difficulty: "easy",
    durationMinutes: 8,
    steps: [
      {
        title: "Find a comfortable position",
        description:
          "Sit or lie down somewhere comfortable. Let your shoulders drop and rest your hands loosely.",
      },
      {
        title: "Scan from head to toe",
        description:
          "Slowly move your attention from the top of your head down to your toes, noticing any tension.",
      },
      {
        title: "Release tension",
        description:
          "Where you notice tightness, breathe in gently and exhale while imagining the muscle softening.",
      },
      {
        title: "Finish with three slow breaths",
        description:
          "Take three deeper breaths, in through the nose and out through the mouth, before opening your eyes.",
      },
    ],
    triggers: ["tense", "difficulty-sleeping"],
  },
  {
    exerciseId: "mindfulness-gratitude-3",
    name: "3‑Point Gratitude Check‑In",
    type: "mindfulness",
    difficulty: "easy",
    durationMinutes: 6,
    steps: [
      {
        title: "Pause and breathe",
        description:
          "Take three slow breaths. Let your shoulders drop and bring your attention to this moment.",
      },
      {
        title: "Grateful for yourself",
        description:
          "Think of one thing you appreciate about yourself today (a small action, quality, or effort).",
      },
      {
        title: "Grateful for someone else",
        description:
          "Bring to mind one person (or pet) you feel thankful for and why.",
      },
      {
        title: "Grateful for your surroundings",
        description:
          "Notice one thing in your environment you’re glad to have right now (light, object, comfort).",
      },
    ],
    triggers: ["low-mood", "self-criticism"],
  },
  {
    exerciseId: "visualisation-safe-place",
    name: "Safe Place Visualisation",
    type: "relaxation",
    difficulty: "medium",
    durationMinutes: 10,
    steps: [
      {
        title: "Close your eyes gently",
        description:
          "Find a comfortable position and allow your eyes to close or soften your gaze.",
      },
      {
        title: "Imagine a safe place",
        description:
          "Picture a place where you feel completely safe and at ease. It can be real or imagined.",
      },
      {
        title: "Engage your senses",
        description:
          "Notice what you can see, hear, feel, and smell in this place. Add as many calming details as you like.",
      },
      {
        title: "Anchor the feeling",
        description:
          "Notice how your body feels in this safe place. Take a slow breath and imagine saving this feeling as an inner ‘snapshot’.",
      },
    ],
    triggers: ["anxious", "before-sleep"],
  },
  {
    exerciseId: "micro-reset-posture",
    name: "1‑Minute Posture Reset",
    type: "grounding",
    difficulty: "easy",
    durationMinutes: 1,
    steps: [
      {
        title: "Notice your posture",
        description:
          "Without judging, observe how you’re sitting or standing right now.",
      },
      {
        title: "Lengthen and soften",
        description:
          "Gently lengthen your spine, roll your shoulders back and down, and unclench your jaw.",
      },
      {
        title: "Connect with the ground",
        description:
          "Feel your feet on the floor and the support beneath you. Take one slow breath in and out.",
      },
    ],
    triggers: ["tension", "screen-fatigue"],
  },
];

async function ensureSeeded() {
  const count = await Exercise.countDocuments();
  if (count === 0) {
    await Exercise.insertMany(defaultExercises);
  }
}

// List all exercises (public)
router.get("/", async (req, res) => {
  try {
    await ensureSeeded();
    const exercises = await Exercise.find({}).sort({ type: 1, name: 1 });
    res.status(200).json(exercises);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get single exercise by exerciseId
router.get("/:exerciseId", async (req, res) => {
  try {
    await ensureSeeded();
    const { exerciseId } = req.params;
    const exercise = await Exercise.findOne({ exerciseId });
    if (!exercise) {
      return res.status(404).json({ message: "Exercise not found" });
    }
    res.status(200).json(exercise);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Track exercise usage (start / complete)
router.post("/:exerciseId/usage", authenticateUser, async (req, res) => {
  try {
    const { exerciseId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const now = new Date();

    if (status === "completed") {
      const usage = await ExerciseUsage.findOneAndUpdate(
        { userId, exerciseId, status: "started" },
        {
          status: "completed",
          completedAt: now,
        },
        { new: true }
      );
      if (!usage) {
        return res.status(201).json(
          await ExerciseUsage.create({
            userId,
            exerciseId,
            status: "completed",
            startedAt: now,
            completedAt: now,
          })
        );
      }
      return res.status(200).json(usage);
    }

    // default: record a started entry
    const usage = await ExerciseUsage.create({
      userId,
      exerciseId,
      status: "started",
      startedAt: now,
    });
    res.status(201).json(usage);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;


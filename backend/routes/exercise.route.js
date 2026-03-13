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


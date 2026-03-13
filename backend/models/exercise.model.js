import mongoose from "mongoose";

const exerciseSchema = new mongoose.Schema(
  {
    exerciseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["breathing", "grounding", "relaxation", "mindfulness"],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },
    durationMinutes: {
      type: Number,
      default: 5,
    },
    steps: [
      {
        title: String,
        description: String,
        durationSeconds: Number,
      },
    ],
    triggers: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Exercise = mongoose.model("Exercise", exerciseSchema);

export default Exercise;


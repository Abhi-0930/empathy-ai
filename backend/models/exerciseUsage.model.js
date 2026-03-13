import mongoose from "mongoose";

const exerciseUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    exerciseId: {
      type: String,
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["started", "completed", "abandoned"],
      default: "started",
    },
  },
  {
    timestamps: true,
  }
);

const ExerciseUsage = mongoose.model("ExerciseUsage", exerciseUsageSchema);

export default ExerciseUsage;


import mongoose from "mongoose";

const usersChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    shareId: {
      type: String,
      default: null,
      index: true,
    },
    shareExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const UsersChat = mongoose.model("UsersChat", usersChatSchema);

export default UsersChat;
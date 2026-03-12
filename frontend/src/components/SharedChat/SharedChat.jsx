import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "../Chatbot/Chatbot.css";

const SharedChat = () => {
  const { shareId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const loadSharedChat = async () => {
      try {
        // Resolve shareId to session info
        const metaRes = await fetch(
          `/api/chats/shared/${shareId}`
        );
        if (!metaRes.ok) {
          throw new Error("Shared chat not found or expired");
        }
        const metaData = await metaRes.json();
        setMeta(metaData);

        // Fetch full history from Python API (public session history)
        const histRes = await axios.get(
          `http://127.0.0.1:5001/sessions/${metaData.sessionId}/history`
        );

        const history = histRes.data.messages || [];
        const flattened = [];
        history.forEach((entry, index) => {
          const ts = entry.timestamp ? new Date(entry.timestamp) : new Date();
          flattened.push({
            id: index * 2 + 1,
            text: entry.user_message,
            sender: "user",
            timestamp: ts,
          });
          flattened.push({
            id: index * 2 + 2,
            text: entry.ai_response,
            sender: "bot",
            timestamp: ts,
          });
        });
        setMessages(flattened);
      } catch (err) {
        setError(err.message || "Failed to load shared chat");
      } finally {
        setLoading(false);
      }
    };

    loadSharedChat();
  }, [shareId]);

  const formatTime = (date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (loading) {
    return (
      <div className="app-container light">
        <div className="main-content">
          <div className="chat-header">
            <h3>Loading shared chat...</h3>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container light">
        <div className="main-content">
          <div className="chat-header">
            <h3>Shared Chat</h3>
          </div>
          <div className="messages-container">
            <div className="message bot-message">
              <div className="message-content">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container light">
      <div className="main-content">
        <div className="chat-header">
          <div className="chat-info">
            <h3>{meta?.title || "Shared Session"}</h3>
          </div>
        </div>

        <div className="messages-container">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.sender === "user" ? "user-message" : "bot-message"
              }`}
            >
              <div className="message-content">
                <p>{message.text}</p>
              </div>
              <div className="message-time">
                {formatTime(message.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SharedChat;


import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, Mic } from "lucide-react";
import "../Chatbot/Chatbot.css";
import { BACKEND_URL } from "../../api.config";

const SharedChat = () => {
  const { shareId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const loadSharedChat = async () => {
      try {
        const sharedRes = await fetch(`${BACKEND_URL}/api/chats/shared/${shareId}/history`);
        if (!sharedRes.ok) {
          throw new Error("Shared chat not found or expired");
        }
        const metaData = await sharedRes.json();
        setMeta(metaData);

        const history = metaData.messages || [];
        const flattened = [];
        history.forEach((entry, index) => {
          const ts = entry.timestamp ? new Date(entry.timestamp) : new Date();

          let userMode = "text";
          let userText = entry.user_message || "";

          if (!userText) {
            if (entry.voice_emotion) {
              userMode = "voice";
            } else {
              userMode = "video";
            }
          } else if (
            typeof userText === "string" &&
            userText.toLowerCase().startsWith("error in transcription")
          ) {
            userMode = "voice";
            userText = "";
          }

          flattened.push({
            id: index * 2 + 1,
            text: userText,
            sender: "user",
            mode: userMode,
            timestamp: ts,
          });
          flattened.push({
            id: index * 2 + 2,
            text: entry.ai_response,
            sender: "bot",
            mode: "text",
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
            {meta?.expiresAt ? (
              <p className="chat-shared-expiry">
                Link expires on {new Date(meta.expiresAt).toLocaleString()}
              </p>
            ) : null}
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
                {message.sender === "bot" ? (
                  <p>{message.text}</p>
                ) : message.mode === "video" ? (
                  <div className="message-media-label">
                    <Camera size={16} />
                    <span>Video emotion analysis</span>
                  </div>
                ) : message.mode === "voice" ? (
                  <div className="message-media-label">
                    <Mic size={16} />
                    <span>Voice emotion analysis</span>
                  </div>
                ) : (
                  <p>{message.text}</p>
                )}
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


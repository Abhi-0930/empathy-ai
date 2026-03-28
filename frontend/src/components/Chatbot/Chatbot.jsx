import React, { useState, useEffect, useRef } from "react";
import {
  MessageCircle,
  Plus,
  Search,
  Send,
  Image,
  Video,
  Mic,
  User,
  Moon,
  Sun,
  LogOut,
  Edit,
  Settings,
  Menu,
  X,
  AlertTriangle,
  Trash2,
  Camera,
  Share2,
  MoreVertical,
  Copy,
  Check,
  Activity,
  Flame,
  Download,
  ChartColumn,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./Chatbot.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import logoImage from "../../assets/logo.jpg";

const KNOWN_EXERCISE_IDS = [
  "breathing-box-1",
  "grounding-5-senses",
  "relaxation-body-scan",
  "mindfulness-gratitude-3",
  "visualisation-safe-place",
  "micro-reset-posture",
];

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractSuggestedExerciseIds = (text) => {
  if (!text || typeof text !== "string") {
    return [];
  }

  return KNOWN_EXERCISE_IDS.filter((id) => {
    const pattern = new RegExp(`\\b${escapeRegExp(id)}\\b`, "i");
    return pattern.test(text);
  });
};

const MentalHealthChatbot = () => {
  // State management
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [inputMode, setInputMode] = useState("text");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const textInputRef = useRef(null);
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const messageIdRef = useRef(0);
  const [lastInputType, setLastInputType] = useState("text"); // "text" | "video" | "voice"
  const [voicePhase, setVoicePhase] = useState("idle"); // "idle" | "starting" | "recording" | "ending"
  const [voiceLevel, setVoiceLevel] = useState(0); // 0–1 audio intensity
  const [videoPhase, setVideoPhase] = useState("idle"); // "idle" | "starting" | "recording" | "ending"
  const [videoCountdown, setVideoCountdown] = useState(null);
  const [notification, setNotification] = useState(null); // { type: 'info' | 'error', message: string }
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [openChatMenuId, setOpenChatMenuId] = useState(null);
  const [renameModal, setRenameModal] = useState({ open: false, chatId: null, currentTitle: "" });
  const [renameInput, setRenameInput] = useState("");
  const [deleteModal, setDeleteModal] = useState({ open: false, chatId: null });
  const [shareModal, setShareModal] = useState({
    open: false,
    chatId: null,
    url: null,
    expiresAt: null,
  });
  const [copiedShare, setCopiedShare] = useState(false);

  const getNextMessageId = () => {
    messageIdRef.current += 1;
    return messageIdRef.current;
  };

  // Video and audio state and refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [streamInterval, setStreamInterval] = useState(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const levelAnimationRef = useRef(null);
  const videoTimeoutRef = useRef(null);
  const profileRef = useRef(null);

  const showNotification = (message, type = "info", durationMs = 4000) => {
    setNotification({ message, type });
    if (durationMs > 0) {
      setTimeout(() => {
        setNotification(null);
      }, durationMs);
    }
  };

  // Fetch user profile and chats on component mount
  useEffect(() => {
    const fetchUserAndChats = async () => {
      const token = localStorage.getItem("token");

      // Fetch user profile
      const userResponse = await fetch(
        "/api/auth/profile",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const userData = await userResponse.json();
      if (userResponse.ok) {
        setUser(userData);
      } else {
        navigate("/");
        return;
      }

      // Fetch chats
      const chatsResponse = await fetch("/api/chats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const chatsData = await chatsResponse.json();
      if (chatsResponse.ok) {
        setChats(chatsData);
      } else {
        console.error("Failed to fetch chats:", chatsData.message);
      }
    };

    fetchUserAndChats();
  }, [navigate]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setShowProfileDropdown(false);
      }
    };

    if (showProfileDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileDropdown]);

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Theme toggling
  useEffect(() => {
    document.body.className = darkMode ? "dark-mode" : "light-mode";
  }, [darkMode]);

  // Handle sending a message (text mode, via Python unified_emotion for memory)
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    if (!activeChat || !user) {
      showNotification(
        "Please create or select a chat session to send messages.",
        "error"
      );
      return;
    }

    setLastInputType("text");
    const textToSend = input;
    setInput("");

    const userMessage = {
      id: getNextMessageId(),
      text: textToSend,
      sender: "user",
      mode: "text",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      setIsBotTyping(true);
      const formData = new FormData();
      formData.append("user_id", user._id);
      formData.append("session_id", activeChat);
      formData.append("text", textToSend);

      const res = await axios.post(
        "http://127.0.0.1:5001/unified_emotion",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const botResponse = {
        id: getNextMessageId(),
        text: res.data.chatbot_response,
        sender: "bot",
        mode: "text",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botResponse]);

      // Update chat list last message
      setChats((prev) =>
        prev.map((chat) =>
          chat._id === activeChat
            ? {
                ...chat,
                lastMessage:
                  botResponse.text.length > 40
                    ? botResponse.text.substring(0, 40) + "..."
                    : botResponse.text,
              }
            : chat
        )
      );
    } catch (error) {
      console.error("Error sending text message:", error);
    } finally {
      setIsBotTyping(false);
    }
  };

  // Handle creating a new chat
  const handleNewChat = async () => {
    const token = localStorage.getItem("token");
    const newChat = {
      title: `New Session ${chats.length + 1}`,
      lastMessage: "",
    };

    const response = await fetch("/api/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newChat),
    });

    if (response.ok) {
      const data = await response.json();
      setChats((prev) => [data, ...prev]);
      setActiveChat(data._id);
      setMessages([]);
    } else {
      console.error("Failed to create new chat");
    }
  };

  // Load history when changing active chat
  useEffect(() => {
    const loadHistory = async () => {
      if (!activeChat || !user) {
        setMessages([]);
        return;
      }
      try {
        const res = await axios.get(
          `http://127.0.0.1:5001/sessions/${activeChat}/history`,
          {
            params: { user_id: user._id },
          }
        );
        const history = res.data.messages || [];
        const flattened = [];
        history.forEach((entry) => {
          const ts = entry.timestamp ? new Date(entry.timestamp) : new Date();

          // Infer the user bubble mode for history:
          // - If user_message is empty and voice_emotion exists → voice analysis bubble.
          // - If user_message is empty and no voice_emotion → video analysis bubble.
          // - If user_message contains an old transcription error string → treat as voice analysis.
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
            id: getNextMessageId(),
            text: userText,
            sender: "user",
            mode: userMode,
            timestamp: ts,
          });

          flattened.push({
            id: getNextMessageId(),
            text: entry.ai_response,
            sender: "bot",
            mode: "text",
            timestamp: ts,
          });
        });
        setMessages(flattened);
      } catch (error) {
        console.error("Failed to load session history:", error);
      }
    };

    loadHistory();
  }, [activeChat, user]);

  // Sample responses
  // (Random response helper removed; responses now come from the backend)

  // Format timestamp
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  // Filter chats based on search query
  const filteredChats = chats.filter(
    (chat) =>
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleShareChat = async (chatId) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/chats/${chatId}/share`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        console.error("Failed to create share link");
        return;
      }
      const data = await res.json();
      setShareModal({
        open: true,
        chatId,
        url: data.url,
        expiresAt: data.expiresAt || null,
      });
      setCopiedShare(false);
    } catch (error) {
      console.error("Error creating share link:", error);
    }
  };

  const handleExportPdf = async (chatId) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/chats/${chatId}/export/pdf`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        console.error("Failed to export chat");
        showNotification("Failed to export chat as PDF.", "error");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-${chatId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting chat:", error);
      showNotification("Error exporting chat as PDF.", "error");
    }
  };

  const copyShareLink = () => {
    if (shareModal.url) {
      navigator.clipboard.writeText(shareModal.url);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const handleRevokeShare = async () => {
    if (!shareModal.chatId) {
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/chats/${shareModal.chatId}/share`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        showNotification("Failed to revoke share link.", "error");
        return;
      }

      showNotification("Share link revoked.", "info");
      setShareModal({
        open: false,
        chatId: null,
        url: null,
        expiresAt: null,
      });
    } catch (error) {
      console.error("Error revoking share link:", error);
      showNotification("Error revoking share link.", "error");
    }
  };

  const handleStartExercise = (exerciseId) => {
    navigate(`/guided-exercises?id=${encodeURIComponent(exerciseId)}`);
  };

  const openRenameModal = (chatId) => {
    const chat = chats.find((c) => c._id === chatId);
    if (chat) {
      setRenameModal({ open: true, chatId, currentTitle: chat.title });
      setRenameInput(chat.title);
    }
  };

  const submitRename = async () => {
    const { chatId } = renameModal;
    const newTitle = renameInput.trim();
    if (!chatId || !newTitle) {
      setRenameModal({ open: false, chatId: null, currentTitle: "" });
      return;
    }
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!res.ok) {
        console.error("Failed to rename chat");
        return;
      }
      const updated = await res.json();
      setChats((prev) =>
        prev.map((chat) => (chat._id === chatId ? updated : chat))
      );
    } catch (error) {
      console.error("Error renaming chat:", error);
    }
    setRenameModal({ open: false, chatId: null, currentTitle: "" });
    setRenameInput("");
  };

  const openDeleteModal = (chatId) => {
    setDeleteModal({ open: true, chatId });
  };

  const confirmDelete = async () => {
    const { chatId } = deleteModal;
    if (!chatId) {
      setDeleteModal({ open: false, chatId: null });
      return;
    }
    const token = localStorage.getItem("token");
    const response = await fetch(`/api/chats/${chatId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const updatedChats = chats.filter((chat) => chat._id !== chatId);
      setChats(updatedChats);
      if (activeChat === chatId) {
        setActiveChat(null);
        setMessages([]);
      }
    } else {
      console.error("Failed to delete chat");
    }
    setDeleteModal({ open: false, chatId: null });
  };

  // Video and audio functionality
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing webcam:", error);
    }
  };

  const captureAndSendFrame = async () => {
    if (!canvasRef.current || !videoRef.current || !user || !activeChat) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        const formData = new FormData();
        formData.append("face", blob, "frame.jpg");
        formData.append("user_id", user._id);
        formData.append("session_id", activeChat);

        try {
          setLastInputType("video");
          setIsBotTyping(true);
          const res = await axios.post(
            "http://127.0.0.1:5001/unified_emotion",
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
            }
          );

          const botResponse = {
            id: getNextMessageId(),
            text: res.data.chatbot_response,
            sender: "bot",
            mode: "text",
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, botResponse]);
        } catch (error) {
          console.error("Error sending frame:", error);
        } finally {
          setIsBotTyping(false);
        }
      },
      "image/jpeg"
    );
  };

  const startStreaming = () => {
    if (!user || !activeChat) {
      showNotification(
        "Please create or select a chat session before starting Live Video Analysis.",
        "error"
      );
      return;
    }

    // If already streaming, act as a manual stop
    if (isStreaming) {
      if (streamInterval) {
        clearInterval(streamInterval);
        setStreamInterval(null);
      }
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
        videoTimeoutRef.current = null;
      }
      setIsStreaming(false);
      setVideoPhase("idle");
      setVideoCountdown(null);
      return;
    }

    // Avoid double-start during starting phase
    if (videoPhase !== "idle") return;

    setVideoPhase("starting");
    let secondsLeft = 3;
    setVideoCountdown(secondsLeft);

    const prepTimer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(prepTimer);

        // Add a user bubble indicating video analysis
        setMessages((prev) => [
          ...prev,
          {
            id: getNextMessageId(),
            text: "",
            sender: "user",
            mode: "video",
            timestamp: new Date(),
          },
        ]);

        setVideoCountdown(null);
        setIsStreaming(true);
        setVideoPhase("recording");
        setStreamInterval(null);

        // Automatically stop after a fixed duration with an ending countdown (similar to voice)
        const recordingDurationSeconds = 10;
        const endingCountdownSeconds = 3;
        const endingStartMs =
          (recordingDurationSeconds - endingCountdownSeconds) * 1000;

        videoTimeoutRef.current = setTimeout(() => {
          setVideoPhase("ending");
          let secondsLeft = endingCountdownSeconds;
          setVideoCountdown(secondsLeft);

          const countdownTimer = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
              clearInterval(countdownTimer);
              captureAndSendFrame();
              setIsStreaming(false);
              setVideoPhase("idle");
              setVideoCountdown(null);
              videoTimeoutRef.current = null;
            } else {
              setVideoCountdown(secondsLeft);
            }
          }, 1000);
        }, endingStartMs);
      } else {
        setVideoCountdown(secondsLeft);
      }
    }, 1000);
  };

  const handleStartRecording = () => {
    if (!user || !activeChat) {
      showNotification(
        "Please create or select a chat session before using Voice Analysis.",
        "error"
      );
      return;
    }
    // Show a user bubble indicating voice analysis
    setMessages((prev) => [
      ...prev,
      {
        id: getNextMessageId(),
        text: "",
        sender: "user",
        mode: "voice",
        timestamp: new Date(),
      },
    ]);
    setVoicePhase("starting");

    let secondsLeft = 3;
    setCountdown(secondsLeft);

    const prepTimer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(prepTimer);
        setCountdown(null);
        startRecording();
      } else {
        setCountdown(secondsLeft);
      }
    }, 1000);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up Web Audio analyser for live level visualization
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;
        source.connect(analyser);

        const updateLevel = () => {
          if (!analyserRef.current || !dataArrayRef.current) return;
          analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const v = (dataArrayRef.current[i] - 128) / 128; // -1..1
            sum += v * v;
          }
          const rms = Math.sqrt(sum / bufferLength);
          const level = Math.min(1, rms * 5); // scale up a bit
          setVoiceLevel(level);
          levelAnimationRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      }

      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);

      let audioChunks = [];
      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        const formData = new FormData();
        formData.append("voice", audioBlob, "voice.wav");
        if (user && activeChat) {
          formData.append("user_id", user._id);
          formData.append("session_id", activeChat);
        }

        try {
          setLastInputType("voice");
          setIsBotTyping(true);
          const res = await axios.post(
            "http://127.0.0.1:5001/unified_emotion",
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
            }
          );

          const botResponse = {
            id: getNextMessageId(),
            text: res.data.chatbot_response,
            sender: "bot",
            mode: "text",
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, botResponse]);
        } catch (error) {
          console.error("Error sending voice:", error);
        } finally {
          setIsBotTyping(false);
        }
        
        // Close audio stream and audio context
        stream.getTracks().forEach((track) => track.stop());
        if (levelAnimationRef.current) {
          cancelAnimationFrame(levelAnimationRef.current);
          levelAnimationRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        analyserRef.current = null;
        dataArrayRef.current = null;
        setVoiceLevel(0);
      };

      recorder.start();
      setIsRecording(true);
      setVoicePhase("recording");
      setCountdown(null);

      const recordingDurationSeconds = 10; // total recording time
      const endingCountdownSeconds = 3; // last seconds to show countdown

      // Start ending countdown near the end of recording
      const endingStartMs =
        (recordingDurationSeconds - endingCountdownSeconds) * 1000;

      setTimeout(() => {
        setVoicePhase("ending");
        let secondsLeft = endingCountdownSeconds;
        setCountdown(secondsLeft);

        const countdownTimer = setInterval(() => {
          secondsLeft -= 1;
          if (secondsLeft <= 0) {
            clearInterval(countdownTimer);
            recorder.stop();
            setIsRecording(false);
            setVoicePhase("idle");
            setCountdown(null);
          } else {
            setCountdown(secondsLeft);
          }
        }, 1000);
      }, endingStartMs);
    } catch (error) {
      console.error("Error recording audio:", error);
      setIsRecording(false);
      setVoicePhase("idle");
      setCountdown(null);
    }
  };

  // Handle video mode
  useEffect(() => {
    if (inputMode === "video") {
      startCamera();
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
      if (streamInterval) {
        clearInterval(streamInterval);
        setStreamInterval(null);
      }
      setIsStreaming(false);
    }
    
    // Cleanup function
    return () => {
      if (streamInterval) {
        clearInterval(streamInterval);
      }
    };
  }, [inputMode]);

  // Clean up streams when component unmounts
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
      if (streamInterval) {
        clearInterval(streamInterval);
      }
    };
  }, []);

  return (
    <div className={`app-container ${darkMode ? "dark" : "light"}`}>
      {/* Mobile menu toggle */}
      <button
        type="button"
        className="mobile-menu-toggle"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
      >
        {isMobileMenuOpen ? (
          <X size={22} strokeWidth={2} />
        ) : (
          <Menu size={22} strokeWidth={2} />
        )}
      </button>

      {/* Backdrop: tap outside to close sidebar on mobile */}
      <div
        className={`sidebar-backdrop ${isMobileMenuOpen ? "visible" : ""}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Left sidebar */}
      <div className={`sidebar ${isMobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">Empathy AI</h2>
          <button className="new-chat-btn" onClick={handleNewChat}>
            <Plus size={20} />
            <span>New Chat</span>
          </button>
          <button
            type="button"
            className="mood-dashboard-btn"
            onClick={() => navigate("/mood-dashboard")}
          >
            <Activity size={16} />
            <span>Mood trends</span>
          </button>
          <button
            type="button"
            className="mood-dashboard-btn"
            onClick={() => navigate("/guided-exercises")}
          >
            <Flame size={16} />
            <span>Guided exercises</span>
          </button>
          <button
            type="button"
            className="mood-dashboard-btn"
            onClick={() => navigate("/insights")}
          >
            <ChartColumn size={16} />
            <span>Insights</span>
          </button>
        </div>

        <div className="search-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="chats-list">
          {filteredChats.map((chat) => (
            <div
              key={chat._id}
              className={`chat-item ${activeChat === chat._id ? "active" : ""}`}
              onClick={() => setActiveChat(chat._id)}
            >
              <div className="chat-icon">
                <MessageCircle size={20} />
              </div>
              <div className="chat-details">
                <div className="chat-title">{chat.title}</div>
                <div className="chat-message">{chat.lastMessage}</div>
              </div>
              <div className="chat-meta">
                <div className="chat-time">
                  {formatDate(new Date(chat.updatedAt || chat.createdAt))}
                </div>
                <div className="chat-actions-menu">
                  <button
                    className="icon-button chat-actions-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenChatMenuId(
                        openChatMenuId === chat._id ? null : chat._id
                      );
                    }}
                    title="More actions"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {openChatMenuId === chat._id && (
                    <div className="chat-actions-dropdown">
                      <button
                        className="chat-actions-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenChatMenuId(null);
                          openRenameModal(chat._id);
                        }}
                      >
                        <Edit size={14} />
                        <span>Rename</span>
                      </button>
                      <button
                        className="chat-actions-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenChatMenuId(null);
                          handleShareChat(chat._id);
                        }}
                      >
                        <Share2 size={14} />
                        <span>Share</span>
                      </button>
                      <button
                        className="chat-actions-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenChatMenuId(null);
                          handleExportPdf(chat._id);
                        }}
                      >
                        <Download size={14} />
                        <span>Export PDF</span>
                      </button>
                      <button
                        className="chat-actions-item destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenChatMenuId(null);
                          openDeleteModal(chat._id);
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="main-content">
        <div className="chat-header">
          <div className="chat-header-left">
            {activeChat ? (
              <div className="chat-session-info">
                <MessageCircle size={20} className="session-icon" />
                <span className="chat-session-title">
                  {chats.find((c) => c._id === activeChat)?.title || "Chat"}
                </span>
              </div>
            ) : null}
          </div>
          <div className="profile-container">
            <div className="emergency-button">
              <AlertTriangle size={20} />
              <span>Emergency</span>
            </div>
            <div className="profile-wrapper" ref={profileRef}>
              <div
                className="profile-icon"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              >
                <User size={24} />
              </div>
              {showProfileDropdown && (
                <div className="profile-dropdown">
                  <div className="dropdown-item">
                    <Edit size={16} />
                    <span>Edit Profile</span>
                  </div>
                  <div className="dropdown-item">
                    <Settings size={16} />
                    <span>Settings</span>
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => setDarkMode(!darkMode)}
                  >
                    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                    <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
                  </div>
                  <div className="dropdown-item">
                    <LogOut size={16} />
                    <span
                      onClick={() => {
                        localStorage.removeItem("token");
                        navigate("/");
                      }}
                    >
                      Logout
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="messages-container">
          {!activeChat ? (
            <div className="chat-empty-state">
              <div className="chat-empty-icon">
                <MessageCircle size={48} strokeWidth={1.5} />
              </div>
              <h3 className="chat-empty-title">No conversation selected</h3>
              <p className="chat-empty-text">
                Choose a chat from the sidebar or start a new conversation to begin.
              </p>
              <button className="chat-empty-cta" onClick={handleNewChat}>
                <Plus size={20} />
                <span>New Chat</span>
              </button>
            </div>
          ) : (
            <>
              {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.sender === "user" ? "user-message" : "bot-message"
              }`}
            >
              <div className="message-content">
                {message.sender === "bot" ? (() => {
                  const suggestedExerciseIds = extractSuggestedExerciseIds(
                    message.text
                  );

                  return (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.text}
                      </ReactMarkdown>
                      {suggestedExerciseIds.length > 0 ? (
                        <div className="exercise-suggestion-row">
                          {suggestedExerciseIds.map((exerciseId) => (
                            <button
                              key={exerciseId}
                              type="button"
                              className="exercise-suggestion-btn"
                              onClick={() => handleStartExercise(exerciseId)}
                            >
                              Start {exerciseId}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  );
                })() : message.mode === "video" ? (
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
          {isBotTyping && (
            <div className="typing-container">
              <div className="typing-icon">
                <img src={logoImage} alt="Empathy AI" />
              </div>
              <div className="typing-lines">
                <div className="typing-line line1" />
                <div className="typing-line line2" />
                <div className="typing-line line3" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="input-container">
          {notification && (
            <div className={`notification-bar ${notification.type}`}>
              {notification.message}
            </div>
          )}
          {activeChat ? (
            <>
          <div className="input-mode-selector">
            <button
              className={`input-mode-btn ${
                inputMode === "text" ? "active" : ""
              }`}
              onClick={() => setInputMode("text")}
            >
              <MessageCircle size={20} />
              <span>Text</span>
            </button>
            <button
              className={`input-mode-btn ${
                inputMode === "video" ? "active" : ""
              }`}
              onClick={() => setInputMode("video")}
            >
              <Video size={20} />
              <span>Video</span>
            </button>
            <button
              className={`input-mode-btn ${
                inputMode === "voice" ? "active" : ""
              }`}
              onClick={() => setInputMode("voice")}
            >
              <Mic size={20} />
              <span>Voice</span>
            </button>
          </div>

          {inputMode === "video" ? (
            <div
              className={`video-input-wrapper ${
                isStreaming ? "streaming-active" : ""
              }`}
            >
              <div
                className="video-status"
                style={{
                  display: videoPhase !== "idle" ? "flex" : "none",
                }}
              >
                <div className="status-dot"></div>
                <span>
                  {videoPhase === "starting" && videoCountdown !== null
                    ? `Starting in ${videoCountdown}...`
                    : videoPhase === "ending" && videoCountdown !== null
                    ? `Ending in ${videoCountdown}...`
                    : "Live Analysis"}
                </span>
              </div>

              <video
                ref={videoRef}
                autoPlay
                playsInline
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current.style.animation =
                      "video-fade-in 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards";
                  }
                }}
              ></video>

              <canvas
                ref={canvasRef}
                style={{ display: "none" }}
                width="400"
                height="300"
              ></canvas>

              <div className="video-overlay">
                <div className="overlay-icon">
                  <Camera size={40} color="white" opacity={0.8} />
                </div>
              </div>

              <div className="video-controls">
                <button
                  onClick={startStreaming}
                  className={isStreaming ? "active" : ""}
                >
                  <Video size={18} />
                  <span>
                    {isStreaming ? "Stop Live Analysis" : "Start Live Analysis"}
                  </span>
                </button>
              </div>
            </div>
          ) : inputMode === "voice" ? (
            <div className="voice-input-wrapper">
              <p className="voice-helper-text">
                Tap below to record a short voice note. We’ll analyse your tone
                and respond back with support.
              </p>
              <div
                className={`voice-visualizer ${
                  voicePhase === "recording" || voicePhase === "ending"
                    ? "active"
                    : ""
                }`}
              >
                <div
                  className="voice-bar"
                  style={{
                    transform: `scaleY(${0.3 + voiceLevel * 0.7})`,
                  }}
                />
              </div>
              <button
                onClick={handleStartRecording}
                disabled={voicePhase !== "idle"}
                className={voicePhase !== "idle" ? "recording" : ""}
              >
                <Mic size={18} />
                <span>
                  {voicePhase === "starting" && countdown !== null
                    ? `Starting in ${countdown}...`
                    : voicePhase === "ending" && countdown !== null
                    ? `Ending in ${countdown}...`
                    : voicePhase === "recording"
                    ? "Recording..."
                    : "Start Voice Analysis"}
                </span>
              </button>
            </div>
          ) : (
            <div className="text-input-wrapper">
              <input
                type="text"
                className="text-input"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                ref={textInputRef}
              />
              <button
                className="send-btn"
                onClick={handleSendMessage}
                disabled={!input.trim()}
              >
                <Send size={20} />
              </button>
            </div>
          )}
            </>
          ) : null}
        </div>
      </div>

      {/* Rename modal */}
      {renameModal.open && (
        <div className="modal-overlay" onClick={() => setRenameModal({ open: false, chatId: null, currentTitle: "" })}>
          <div className="modal-content rename-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename chat</h3>
            <input
              type="text"
              className="modal-input"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Chat title"
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setRenameModal({ open: false, chatId: null, currentTitle: "" })}>Cancel</button>
              <button className="modal-btn primary" onClick={submitRename}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ open: false, chatId: null })}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Delete chat?</h3>
            <p className="modal-text">This conversation will be permanently deleted. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setDeleteModal({ open: false, chatId: null })}>Cancel</button>
              <button className="modal-btn destructive" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareModal.open && shareModal.url && (
        <div
          className="modal-overlay"
          onClick={() =>
            setShareModal({
              open: false,
              chatId: null,
              url: null,
              expiresAt: null,
            })
          }
        >
          <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Share chat</h3>
            <p className="modal-text">Anyone with this link can view the conversation.</p>
            {shareModal.expiresAt ? (
              <p className="modal-text share-expiry-text">
                This link expires on {new Date(shareModal.expiresAt).toLocaleString()}.
              </p>
            ) : null}
            <div className="share-link-row">
              <input type="text" className="modal-input share-link-input" readOnly value={shareModal.url} />
              <button type="button" className="modal-btn primary copy-btn" onClick={copyShareLink}>
                {copiedShare ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedShare ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="modal-actions">
              <button className="modal-btn destructive" onClick={handleRevokeShare}>
                Revoke link
              </button>
              <button
                className="modal-btn secondary"
                onClick={() =>
                  setShareModal({
                    open: false,
                    chatId: null,
                    url: null,
                    expiresAt: null,
                  })
                }
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentalHealthChatbot;
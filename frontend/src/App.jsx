import { Routes, Route } from "react-router-dom";
import AuthForm from "./components/AuthForm/Auth.jsx";
import Main from "./components/Main/Main.jsx";
import Chatbot from "./components/Chatbot/Chatbot.jsx";
import SharedChat from "./components/SharedChat/SharedChat.jsx";
import GuidedExercises from "./components/GuidedExercises/GuidedExercises.jsx";
import MoodDashboard from "./components/MoodDashboard/MoodDashboard.jsx";
import Insights from "./components/Insights/Insights.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Main />} />
      <Route path="/auth" element={<AuthForm />} />
      <Route path="/chatbot-page" element={<Chatbot />} />
      <Route path="/shared/:shareId" element={<SharedChat />} />
      <Route path="/guided-exercises" element={<GuidedExercises />} />
      <Route path="/mood-dashboard" element={<MoodDashboard />} />
      <Route path="/insights" element={<Insights />} />
    </Routes>
  );
}

export default App;

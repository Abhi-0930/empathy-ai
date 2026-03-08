import { Routes, Route } from "react-router-dom";
import AuthForm from "./components/AuthForm/Auth.jsx";
import Main from "./components/Main/Main.jsx";
import Chatbot from "./components/Chatbot/Chatbot.jsx";
import SharedChat from "./components/SharedChat/SharedChat.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Main />} />
      <Route path="/auth" element={<AuthForm />} />
      <Route path="/chatbot-page" element={<Chatbot />} />
      <Route path="/shared/:shareId" element={<SharedChat />} />
    </Routes>
  );
}

export default App;

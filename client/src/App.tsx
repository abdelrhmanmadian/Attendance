import { Routes, Route } from "react-router-dom";
import CheckIn from "./pages/CheckIn";
import Login from "./pages/Login";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CheckIn />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}

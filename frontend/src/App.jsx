import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import CRDashboard from './pages/CRDashboard.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

function ProtectedRoute({ allow, children }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/" replace />;
  if (!allow.includes(auth.role)) {
    // Backend also rejects this at the API level — this is just UX.
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/student" element={
        <ProtectedRoute allow={['student']}><StudentDashboard /></ProtectedRoute>
      } />
      <Route path="/cr" element={
        <ProtectedRoute allow={['cr']}><CRDashboard /></ProtectedRoute>
      } />
      <Route path="/teacher" element={
        <ProtectedRoute allow={['teacher']}><TeacherDashboard /></ProtectedRoute>
      } />

      {/* Admin entry point is a separate, unlinked path — never surfaced in student/CR/teacher UI */}
      <Route path="/portal-admin" element={<AdminLogin />} />
      <Route path="/admin" element={
        <ProtectedRoute allow={['admin']}><AdminDashboard /></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

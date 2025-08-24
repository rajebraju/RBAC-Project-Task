import { Routes, Route, Navigate } from 'react-router-dom';
import Notification from './components/Notification';
import Login from './pages/Login';
import DashboardRouter from './pages/DashboardRouter';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <Notification>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardRouter key={user?.role} />
            </ProtectedRoute>
          }
        />
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Notification>
  );
}

export default App;

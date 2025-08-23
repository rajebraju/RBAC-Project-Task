import AdminDashboard from './AdminDashboard';
import ManagerDashboard from './ManagerDashboard';
import MemberDashboard from './MemberDashboard';
import { useAuth } from '../context/AuthContext';

export default function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.role.toLowerCase()) {
    case 'admin': return <AdminDashboard />;
    case 'manager': return <ManagerDashboard />;
    case 'member': return <MemberDashboard />;
    default: return <MemberDashboard />;
  }
}

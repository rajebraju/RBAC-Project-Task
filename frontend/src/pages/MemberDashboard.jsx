import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocket, initSocket } from '../socket';
import UserList from '../components/UserList';
import { useNavigate } from 'react-router-dom';

export default function MemberDashboard() {
  const { user, setUser, logout } = useAuth();
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');

    let socket = getSocket();
    if (!socket) socket = initSocket(token, user);

    fetch('/api/tasks/my-tasks', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []));

    const handleTaskCreated = (task) => {
      setTasks((prev) => {
        if (prev.find((t) => t._id === task._id)) return prev;
        return [...prev, task];
      });
      setNotifications((prev) => [
        { type: 'task', message: `New task assigned: ${task.title}` },
        ...prev,
      ]);
    };

    const handleTaskUpdated = (task) => {
      setTasks((prev) => {
        const exists = prev.some((t) => String(t._id) === String(task._id));
        return exists
          ? prev.map((t) => (String(t._id) === String(task._id) ? task : t))
          : [...prev, task];
      });
    };

    const handleNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev]);
    };

    if (!socket) return;
    const handleTasksDeleted = (deletedTaskIds) => {
      setTasks(prev => prev.filter(t => !deletedTaskIds.includes(t._id)));
    };

    socket.on('online-users', (users) => {
      setOnlineUsers(users);
    });

    socket.on('role-updated', (data) => {
      setUser(prev => ({ ...prev, role: data.role }));
      setToast(data.message);
    });

    socket.on('task-created', handleTaskCreated);
    socket.on('task-updated', handleTaskUpdated);
    socket.on('notification', handleNotification);
    socket.on('tasks-deleted', handleTasksDeleted);

    return () => {
      socket.off('task-created', handleTaskCreated);
      socket.off('task-updated', handleTaskUpdated);
      socket.off('notification', handleNotification);
      socket.off('tasks-deleted', handleTasksDeleted);
      socket.off('role-updated');
    };

  }, [user]);

  const updateTask = async (id, status) => {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ status }),
    });
  };

  if (!user) return null;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        margin: 0,
        padding: '20px',
        boxSizing: 'border-box',
        backgroundColor: '#f7f9fc',
        color: '#333',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <header style={{ marginBottom: '20px' }}>
          <h1 style={{ margin: '0 0 10px 0' }}>🧑‍💻 Member Dashboard</h1>
          <p style={{ margin: '5px 0' }}>
            Welcome, <strong>{user.name}</strong> (Role: <strong>{user.role}</strong>)
          </p>
          <button
            onClick={logout}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </header>

        {/* Notifications */}
        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ marginBottom: '15px' }}>Notifications</h2>
          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: '6px',
              backgroundColor: '#fff',
              padding: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            {notifications.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>No notifications</p>
            ) : (
              notifications.map((n, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid #eee',
                    fontSize: '14px',
                  }}
                >
                  {n.message}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Tasks */}
        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ marginBottom: '15px' }}>Your Tasks</h2>
          {tasks.length === 0 ? (
            <p>No tasks assigned yet.</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task._id}
                style={{
                  border: '1px solid #ddd',
                  padding: '12px',
                  margin: '10px 0',
                  borderRadius: '6px',
                  backgroundColor: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <div>
                  Project: <strong>{task.project?.name || 'N/A'}</strong> |
                  Task: <strong>{task.title}</strong> |
                  Assigned By: <strong>{task.createdBy?.name || 'N/A'}</strong>
                </div>
                <div style={{ marginTop: '4px' }}>
                  Status: <strong>{task.status}</strong>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <select
                    value={task.status}
                    onChange={(e) => updateTask(task._id, e.target.value)}
                    style={{
                      padding: '6px',
                      fontSize: '14px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      marginRight: '8px',
                    }}
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Testing" disabled>Testing</option>
                    <option value="Review" disabled>Review</option>
                    <option value="Completed">Completed</option>
                  </select>

                  <button
                    onClick={() => updateTask(task._id, 'Completed')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '14px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Complete
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Online Users */}
        <section>
          <h2 style={{ marginBottom: '15px' }}>Online Team Members</h2>
          <UserList users={onlineUsers} />
        </section>
      </div>
    </div>
  );
}
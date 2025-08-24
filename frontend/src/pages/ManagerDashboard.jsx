import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocket, initSocket } from '../socket';
import UserList from '../components/UserList';
import { useNavigate } from 'react-router-dom';

export default function ManagerDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignedTo: '', projectId: '', status: 'To Do' });
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    let socket = getSocket();
    if (!socket) socket = initSocket(token, user);

    const fetchData = async () => {
      try {
        const [projectsRes, membersRes] = await Promise.all([
          fetch('/api/projects/assigned', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
          fetch('/api/users/members', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        ]);

        setProjects(Array.isArray(projectsRes.projects) ? projectsRes.projects : []);
        setTasks(Array.isArray(projectsRes.tasks) ? projectsRes.tasks : []);
        setMembers(Array.isArray(membersRes) ? membersRes : []);
      } catch (err) {
        console.error('Fetch error', err);
      }
    };

    fetchData();

    // --- SOCKET HANDLERS ---
    const handleProjectUpdated = (updatedProject) => {
      console.log('Received update:', updatedProject);
      const token = localStorage.getItem('token');
      fetch('/api/projects/assigned', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          setProjects(data.projects || []);
          setTasks(data.tasks || []);
        });

      setNotifications(prev => [
        { type: 'project', message: `Project updated: ${updatedProject.name} → ${updatedProject.status}` },
        ...prev
      ]);
    };

    const handleProjectDeleted = (id) => {
      setProjects(prev => prev.filter(p => p._id !== id));
      setNotifications(prev => [{ type: 'project', message: `A project was deleted` }, ...prev]);
    };

    const handleTaskCreated = (task) => {
      if (String(task.assignedTo?._id) === String(user.id)) {
        setTasks(prev => {
          if (prev.find(t => t._id === task._id)) return prev;
          return [...prev, task];
        });
        setNotifications(prev => [{ type: 'task', message: `Task assigned to you: ${task.title}` }, ...prev]);
      }
    };

    const handleTaskUpdated = (task) => {
      setTasks(prev => {
        const exists = prev.some(t => t._id === task._id);
        return exists ? prev.map(t => (t._id === task._id ? task : t)) : [...prev, task];
      });

      // Notify only if manager created this task
      if (String(task.createdBy?._id) === String(user.id)) {
        setNotifications(prev => [{ type: 'task', message: `Task updated: ${task.title} → ${task.status}` }, ...prev]);
      }
    };

    const handleNotification = (notif) => {
      setNotifications(prev => [notif, ...prev]);
    };

    socket.on('online-users', (users) => {
      setOnlineUsers(users);
    });

    socket.on('role-updated', (data) => {
      setUser(prev => ({ ...prev, role: data.role }));
      setToast(data.message);
    });

    if (!socket) return;
    const handleTasksDeleted = (deletedTaskIds) => {
      setTasks(prev => prev.filter(t => !deletedTaskIds.includes(t._id)));
    };
    if (socket) {
      socket.on('project-updated', handleProjectUpdated);
      socket.on('project-deleted', handleProjectDeleted);
      socket.on('task-created', handleTaskCreated);
      socket.on('notification', handleNotification);
      socket.on('task-updated', handleTaskUpdated);
      socket.on('tasks-deleted', handleTasksDeleted);
    }
    return () => {
      if (socket) {
        socket.off('project-updated', handleProjectUpdated);
        socket.off('project-deleted', handleProjectDeleted);
        socket.off('task-created', handleTaskCreated);
        socket.off('notification', handleNotification);
        socket.off('task-updated', handleTaskUpdated);
        socket.off('tasks-deleted', handleTasksDeleted);
        socket.off('role-updated');
      }
    };
  }, [user]);

  if (!user) return null;

  // --- UPDATE PROJECT STATUS ---
  const updateProjectStatus = async (projectId, status) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${projectId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      const updatedProject = await res.json();
      setProjects(prev => prev.map(p => (p._id === updatedProject._id ? updatedProject : p)));
    } catch (err) {
      console.error(err);
    }
  };

  // --- UPDATE TASK STATUS ---
  const updateTaskStatus = async (taskId, status) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      const updatedTask = await res.json();

      // Update tasks list
      setTasks((prev) =>
        prev.map((t) => (String(t._id) === String(updatedTask._id) ? updatedTask : t))
      );

    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  // --- CREATE TASK ---  
  const createTask = async () => {
    if (!newTask.projectId || !newTask.title || !newTask.assignedTo) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description,
          assignedTo: newTask.assignedTo,
          projectId: newTask.projectId,
          status: newTask.status,
        }),
      });
      const createdTask = await res.json();
      setTasks((prev) => [...prev, createdTask]);
      setNewTask({
        title: '',
        description: '',
        assignedTo: '',
        projectId: '',
        status: 'To Do',
      });
    } catch (err) {
      console.error(err);
    }
  };

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
          <h1 style={{ margin: '0 0 10px 0' }}>👩‍💼 Manager Dashboard</h1>
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

        {/* Projects with Tasks */}
        <section style={{ marginBottom: '30px' }} key={refreshKey}>
          <h2 style={{ marginBottom: '15px' }}>Projects & Tasks</h2>
          {projects.length === 0 ? (
            <p>No projects assigned yet.</p>
          ) : (
            projects.map((project) => {
              const projectTasks = tasks.filter(task => String(task.project?._id) === String(project._id));
              return (
                <div
                  key={project._id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    backgroundColor: '#fff',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                  }}
                >
                  {/* Project Header */}
                  <div
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #eee',
                      backgroundColor: '#f5f9ff',
                      borderRadius: '8px 8px 0 0',
                    }}
                  >
                    <h3 style={{ margin: '0 0 4px 0' }}>{project.name}</h3>
                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#555' }}>
                      {project.description || 'No description'}
                    </p>
                    <small>
                      Status:{' '}
                      <strong>{project.status}</strong>
                    </small>
                    <select
                      value={project.status}
                      onChange={(e) => updateProjectStatus(project._id, e.target.value)}
                      style={{
                        marginLeft: '10px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                      }}
                    >
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  {/* Tasks for Project */}
                  <div style={{ padding: '10px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Tasks</h4>
                    {projectTasks.length === 0 ? (
                      <p style={{ color: '#888', fontSize: '14px', fontStyle: 'italic' }}>
                        No tasks in this project.
                      </p>
                    ) : (
                      projectTasks.map((task) => (
                        <div
                          key={task._id}
                          style={{
                            border: '1px solid #eee',
                            padding: '10px',
                            margin: '8px 0',
                            borderRadius: '6px',
                            backgroundColor: '#f9f9f9',
                          }}
                        >
                          <p style={{ margin: '0 0 6px 0' }}>
                            <strong>{task.title}</strong>
                          </p>
                          <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#555' }}>
                            {task.description || 'No description'}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <small>
                              Assigned to: <strong>{task.assignedTo?.name || 'Unassigned'}</strong>
                            </small>
                            <select
                              value={task.status}
                              onChange={(e) => updateTaskStatus(task._id, e.target.value)}
                              style={{
                                padding: '4px',
                                fontSize: '12px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                minWidth: '100px',
                              }}
                            >
                              <option value="To Do" disabled>To Do</option>
                              <option value="In Progress" disabled>In Progress</option>
                              <option value="Completed" disabled>Completed</option>
                              <option value="Testing">Testing</option>
                              <option value="Review">Review </option>
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Create Task */}
        <section style={{ marginBottom: '30px' }}>
          <h2 style={{ marginBottom: '15px' }}>Create Task</h2>
          <div
            style={{
              display: 'grid',
              gap: '12px',
              maxWidth: '500px',
              backgroundColor: '#fff',
              padding: '10px',
              borderRadius: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <select
              value={newTask.projectId}
              onChange={e => setNewTask({ ...newTask, projectId: e.target.value })}
              style={selectStyle}
            >
              <option value="">Select Project</option>
              {projects.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>

            <select
              value={newTask.status}
              onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
              style={selectStyle}
            >
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Testing">Testing</option>
              <option value="Review">Review</option>
              <option value="Completed">Completed</option>
            </select>

            <input
              placeholder="Task Title"
              value={newTask.title}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              style={inputStyle}
            />

            <input
              placeholder="Description"
              value={newTask.description}
              onChange={e => setNewTask({ ...newTask, description: e.target.value })}
              style={inputStyle}
            />

            <select
              value={newTask.assignedTo}
              onChange={e => setNewTask({ ...newTask, assignedTo: e.target.value })}
              style={selectStyle}
            >
              <option value="">Assign to Member</option>
              {members.length > 0 ? (
                members.map(m => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))
              ) : (
                <option disabled>No members available</option>
              )}
            </select>

            <button
              onClick={createTask}
              disabled={!newTask.projectId || !newTask.title || !newTask.assignedTo}
              style={{
                padding: '10px 16px',
                fontSize: '14px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '8px',
                opacity: !newTask.projectId || !newTask.title || !newTask.assignedTo ? 0.6 : 1,
              }}
            >
              Create Task
            </button>
          </div>
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

// === Reusable Styles ===
const inputStyle = {
  padding: '10px',
  fontSize: '14px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  width: '96%',
};

const selectStyle = {
  padding: '10px',
  fontSize: '14px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  backgroundColor: '#fff',
  width: '100%',
};
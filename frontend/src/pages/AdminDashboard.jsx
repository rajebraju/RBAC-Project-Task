import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocket, initSocket } from '../socket';
import UserList from '../components/UserList';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [newProject, setNewProject] = useState({ name: '', description: '', managerId: '' });
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    let socket = getSocket();
    if (!socket) { socket = initSocket(token); }

    // Fetch all data
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const [projectsRes, usersRes, tasksRes, auditRes] = await Promise.all([
          fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
          fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
          fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
          fetch('/api/projects/audit', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        ]);

        const projectsWithManager = projectsRes.map(p => ({ ...p, manager: p.manager || null }));

        setProjects(projectsWithManager);
        setUsers(usersRes);
        setTasks(Array.isArray(tasksRes) ? tasksRes : []);
        setAuditLogs(Array.isArray(auditRes) ? auditRes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) : []);
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };

    fetchData();

    const onProjectCreated = (newProject) => {
      const projectWithManager = {
        ...newProject,
        manager: newProject.manager || null
      };

      setProjects(prev => [projectWithManager, ...prev]);
    };

    // Real-time handlers
    const onProjectUpdated = (updatedProject) => {
      const projectWithManager = {
        ...updatedProject,
        manager: updatedProject.manager || null
      };

      setProjects(prev => {
        const exists = prev.some(p => p._id === updatedProject._id);
        return exists
          ? prev.map(p => (p._id === updatedProject._id ? projectWithManager : p))
          : [projectWithManager, ...prev];
      });
    };

    // Delete project
    const onProjectDeleted = (id) => {
      setProjects(prev => prev.filter(p => p._id !== id));
    };

    // New or updated task
    const onTaskUpdated = (task) => {
      setTasks(prev => {
        const exists = prev.some(t => t._id === task._id);
        return exists
          ? prev.map(t => (t._id === task._id ? task : t))
          : [...prev, task];
      });
    };

    // New audit log
    const onAuditLog = (log) => {
      setAuditLogs((prev) => [
        { ...log, timestamp: new Date(log.timestamp) },
        ...prev,
      ]);
    };

    const onNotification = (data) => {
      if (data.type === 'project-update' || data.type === 'project-assigned' || data.type === 'project-deleted') {
        alert(data.message);
      }
    };

    socket.on('online-users', (users) => {
      setOnlineUsers(users);
    });

    socket.on("audit-log", onAuditLog);
    socket.on('project-created', onProjectCreated);
    socket.on('project-updated', onProjectUpdated);
    socket.on('project-deleted', onProjectDeleted);
    socket.on('notification', onNotification);
    socket.on('task-created', onTaskUpdated);
    socket.on('task-updated', onTaskUpdated);

    return () => {
      socket.off('project-created', onProjectCreated);
      socket.off('project-updated', onProjectUpdated);
      socket.off('project-deleted', onProjectDeleted);
      socket.off('notification', onNotification);
      socket.off("audit-log", onAuditLog);
      socket.off('task-updated', onTaskUpdated);
      socket.off('task-created', onTaskUpdated);
    };
  }, [user]);

  if (!user) {
    window.location.href = '/';
    return null;
  }

  // --- UPDATE PROJECT STATUS ---
  const updateProjectStatus = async (projectId, status) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${projectId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const updatedProject = await res.json();
      setProjects(prev => prev.map(p => (p._id === updatedProject._id ? updatedProject : p)));
    } catch (err) {
      console.error(err);
    }
  };

  // --- CREATE PROJECT ---
  const createProject = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(newProject)
    });

    if (res.ok) {
      setNewProject({ name: '', description: '', managerId: '' });
      alert(`Project "${newProject.name}" created!`);
    } else {
      const error = await res.json();
      alert(`Error: ${error.message}`);
    }
  };

  const deleteProject = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      alert(`Project deleted: ${data.message}`);
      setProjects(prev => prev.filter(p => p._id !== id));
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  const changeRole = async (userId, newRole) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ role: newRole })
    });

    alert(`Role updated to ${newRole}`);
    // Refresh users list
    const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
    const usersRes = await res.json();
    setUsers(usersRes);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9f9fb',
        color: '#333',
        fontFamily: 'Arial, sans-serif',
        padding: '20px',
        boxSizing: 'border-box',
        maxWidth: '1200px',
        margin: '0 auto'
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 10px 0' }}>👨‍💼 Admin Dashboard</h1>
        <p style={{ margin: '5px 0' }}>
          Welcome, <strong>{user.name}</strong> (Role: <strong>{user.role}</strong>)
        </p>
        <button
          onClick={logout}
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            backgroundColor: '#d9534f',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </header>

      {/* Create Project Section */}
      <section style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#fff', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: '0 0 15px 0' }}>Create Project</h2>
        <input
          placeholder="Name"
          value={newProject.name}
          onChange={e => setNewProject({ ...newProject, name: e.target.value })}
          style={{
            display: 'block',
            margin: '8px 0',
            padding: '10px',
            width: '100%',
            maxWidth: '300px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
        <input
          placeholder="Description"
          value={newProject.description}
          onChange={e => setNewProject({ ...newProject, description: e.target.value })}
          style={{
            display: 'block',
            margin: '8px 0',
            padding: '10px',
            width: '100%',
            maxWidth: '300px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
        <select
          value={newProject.managerId}
          onChange={e => setNewProject({ ...newProject, managerId: e.target.value })}
          style={{
            display: 'block',
            margin: '8px 0',
            padding: '10px',
            width: '100%',
            maxWidth: '300px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        >
          <option value="">Assign Manager</option>
          {users.filter(u => u.role === 'Manager').map(u => (
            <option key={u._id} value={u._id}>{u.name}</option>
          ))}
        </select>
        <button
          onClick={createProject}
          style={{
            padding: '10px 16px',
            fontSize: '14px',
            backgroundColor: '#5cb85c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Create Project
        </button>
      </section>

      {/* Projects & Tasks */}
      <section style={sectionStyle}>
        <h2>Projects & Tasks</h2>
        {projects.length === 0 ? (
          <p>No projects yet.</p>
        ) : (
          projects.map(project => {
            // const projectTasks = tasks.filter(task => String(task.project?._id) === String(project._id));
            const projectTasks = tasks.filter(task => task.project && String(task.project._id) === String(project._id));
            return (
              <div
                key={project._id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  backgroundColor: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                {/* Project Header */}
                <div style={{
                  padding: '12px',
                  borderBottom: '1px solid #eee',
                  backgroundColor: '#f5f9ff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0' }}>{project.name}</h3>
                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#555' }}>
                      {project.description || 'No description'}
                    </p>
                    <small>
                      Manager: <strong>{project.manager?.name || 'Unassigned'}</strong> |
                      Status: <strong>{project.status}</strong>
                    </small>
                  </div>
                  <select
                    value={project.status}
                    onChange={(e) => updateProjectStatus(project._id, e.target.value)}
                    style={{
                      padding: '6px',
                      fontSize: '14px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                    }}
                  >
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                {/* Tasks */}
                <div style={{ padding: '10px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Tasks</h4>
                  {projectTasks.length === 0 ? (
                    <p style={{ color: '#888', fontSize: '14px' }}>No tasks in this project.</p>
                  ) : (
                    projectTasks.map(task => (
                      <div
                        key={task._id}
                        style={{
                          border: '1px solid #eee',
                          padding: '8px',
                          margin: '6px 0',
                          borderRadius: '4px',
                          backgroundColor: '#f9f9f9',
                          fontSize: '14px',
                        }}
                      >
                        <strong>{task.title}</strong> — {task.description || 'No description'} <br />
                        <small>
                          Assigned to: <strong>{task.assignedTo?.name || 'Unassigned'}</strong> |
                          Status: <strong>{task.status}</strong>
                        </small>
                      </div>
                    ))
                  )}
                </div>

                {/* Delete Project */}
                <div style={{ padding: '10px', borderTop: '1px solid #eee' }}>
                  <button onClick={() => deleteProject(project._id)} style={btnDanger}>
                    Delete Project
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Users Table */}
      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ marginBottom: '15px' }}>Users & Role Management</h2>
        <div style={{ overflowX: 'auto' }}>
          <table
            border="1"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderRadius: '6px',
              overflow: 'hidden'
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Role</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{u.name}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{u.email}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{u.role}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    {u.role !== 'Admin' && (
                      <select
                        onChange={e => changeRole(u._id, e.target.value)}
                        style={{
                          padding: '6px',
                          fontSize: '14px',
                          border: '1px solid #ccc',
                          borderRadius: '4px'
                        }}
                      >
                        <option value="">Change to...</option>
                        <option value="Manager">Manager</option>
                        <option value="Member">Member</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <UserList users={onlineUsers} />

      {/* Audit Log */}
      <section>
        <h2 style={{ marginBottom: '15px' }}>Audit Log</h2>
        <ul style={{ listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto', backgroundColor: '#fff', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '10px' }}>
          {auditLogs.length === 0 ? (
            <li>No audit logs available.</li>
          ) : (
            auditLogs.map(log => (
              <li key={log._id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <small>{log.details} — <em>{new Date(log.timestamp).toLocaleString()}</em></small>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

// === STYLES ===
const sectionStyle = {
  marginBottom: '30px',
  padding: '15px',
  backgroundColor: '#fff',
  borderRadius: '6px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
};

const btnDanger = {
  padding: '6px 10px',
  fontSize: '12px',
  backgroundColor: '#d9534f',
  color: 'white',
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer'
};

const inputStyle = {
  display: 'block',
  margin: '8px 0',
  padding: '10px',
  width: '100%',
  maxWidth: '300px',
  fontSize: '14px',
  border: '1px solid #ccc',
  borderRadius: '4px'
};

const selectStyle = {
  display: 'block',
  margin: '8px 0',
  padding: '10px',
  width: '100%',
  maxWidth: '300px',
  fontSize: '14px',
  border: '1px solid #ccc',
  borderRadius: '4px'
};

export default AdminDashboard;
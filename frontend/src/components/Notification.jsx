import React, { useState } from 'react';

let id = 0;
const generateId = () => ++id;

export default function Notification({ children }) {
  const [notifications, setNotifications] = useState([]);

  // Expose addNotification to global context (or use context later)
  window.showNotification = (message, type = 'info') => {
    const notification = { id: generateId(), message, type };
    setNotifications(prev => [notification, ...prev]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  return (
    <div style={{}}>
      {notifications.map(n => (
        <div
          key={n.id}
          style={{
            margin: '8px 0',
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: n.type === 'error' ? '#ffebee' : '#e8f5e9',
            color: n.type === 'error' ? '#c62828' : '#2e7d32',
            border: `1px solid ${n.type === 'error' ? '#ef9a9a' : '#a5d6a7'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            maxWidth: '300px'
          }}
        >
          {n.message}
        </div>
      ))}

      {children}
    </div>
  );
}
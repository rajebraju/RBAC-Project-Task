import React from 'react';

const roleIcons = {
  admin: '👨‍💼',
  manager: '👩‍💼',
  member: '🧑‍💻'
};

export default function UserList({ users }) {
  return (
    <div style={{
      border: '1px solid #eee',
      borderRadius: '8px',
      padding: '12px',
      backgroundColor: '#f0f8ff',
      marginTop: '20px'
    }}>
      <h3>👥 Online Users</h3>
      {users.length === 0 ? (
        <p><em>No users online</em></p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {users.map(user => (
            <li key={user.userId} style={{ padding: '6px 0' }}>
              {roleIcons[user.role] || '👤'}{" "}
              <strong>
                {user.userId === 'You' ? 'You' : user.name}
              </strong>{" "}
              ({user.role})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

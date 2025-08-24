import { io } from 'socket.io-client';

let socket;

export const initSocket = (token, user) => {
  if (socket) socket.disconnect();
  const apiUrl = import.meta.env.VITE_API_URL;

  socket = io(apiUrl, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  socket.on('connect', () => {
    console.log('Connected to socket server:', socket.id);
    // Register user with backend
    socket.emit('register', { id: user.id, role: user.role, name: user.name });
  });

  // Optional: log errors (helps catch auth/role issues)
  socket.on('connect_error', (e) => {
    console.error('Socket connect_error:', e.message);
  });

  return socket;
};

export const getSocket = () => socket;
import jwt from 'jsonwebtoken';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import { protect } from './middleware/authMiddleware.js';
import User from './models/User.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Fix: Use specific origin, not "true"
app.use(cors({
  // origin: "http://localhost:5173",
  origin: "https://ptfront-psi.vercel.app",
  credentials: true
}));
app.use(express.json());

// Socket.IO Setup
import { Server } from 'socket.io';
const io = new Server(server, {
  cors: {
    origin: "https://ptfront-psi.vercel.app",
    // origin: "http://localhost:5173",
    methods: ["GET", "POST", "PATCH"],
    credentials: true
  }
});

// Store online users
// key = userId (string), value = { socketId, userId, role, name }
const onlineUsers = new Map();

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication error"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Ensure  have fresh role/name from DB (prevents stale JWT role or case mismatch)
    const u = await User.findById(decoded.id).select('name role');
    if (!u) return next(new Error("User not found"));

    socket.user = {
      id: String(decoded.id),
      role: (u.role || decoded.role || '').toLowerCase(),
      name: u.name || decoded.name || 'User'
    };

    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on('connection', (socket) => {
  const userId = String(socket.user.id);
  onlineUsers.set(userId, {
    socketId: socket.id,
    userId,
    role: socket.user.role,
    name: socket.user.name
  });

  // Broadcast updated online users list
  io.emit('online-users', Array.from(onlineUsers.values()));

  // Listen for explicit registration (redundant but safe)
  socket.on('register', (data) => {
    console.log(`User registered via event:`, data);
    if (data.id === userId) {
      onlineUsers.set(userId, {
        socketId: socket.id,
        userId: data.id,
        role: data.role.toLowerCase(),
        name: data.name,
      });
      io.emit('online-users', Array.from(onlineUsers.values()));
    }
  });

  socket.on('join-project', (projectId) => {
    if (projectId) socket.join(`project-${projectId}`);
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    io.emit('online-users', Array.from(onlineUsers.values()));
  });
});

// Make io + online users available in routes
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = onlineUsers;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// Test route
app.get('/api/protected', protect, (req, res) => {
  res.json({ user: req.userObj }); 
});

// Connect DB & Start Server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('DB Connected');
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.log('DB Error:', err);
  });

export { server, app, io };

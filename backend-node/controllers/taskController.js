import Task from '../models/Task.js';
import AuditLog from '../models/AuditLog.js';

// Emit to all admins
const emitToAdmins = (onlineUsers, io, event, payload) => {
  onlineUsers.forEach(u => {
    if (u.role === 'admin') {
      io.to(u.socketId).emit(event, payload);
    }
  });
};

// CREATE TASK
export const createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, projectId, status } = req.body;
    if (!title || !projectId) return res.status(400).json({ message: 'Title and projectId required' });

    const task = new Task({
      title,
      description,
      assignedTo,
      project: projectId,
      createdBy: req.user.id,
      status: status || 'To Do',
    });

    await task.save();
    // Populate after save
    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name')
      .populate('project', 'name manager');

    // Emit populated task
    if (assignedTo && req.onlineUsers.has(assignedTo)) {
      const memberSocket = req.onlineUsers.get(assignedTo);
      req.io.to(memberSocket.socketId).emit('task-created', populatedTask);
      req.io.to(memberSocket.socketId).emit('notification', {
        message: `New task assigned: "${task.title}" (Status: ${task.status})`,
        type: 'task-assigned',
      });
    }

    // Audit
    const audit = await AuditLog.create({
      action: 'Task Assigned',
      performedBy: req.user.id,
      details: `${req.userObj.name} assigned task "${task.title}"`
    });

    // --- Notify admins ---
    emitToAdmins(req.onlineUsers, req.io, 'task-created', populatedTask);
    emitToAdmins(req.onlineUsers, req.io, 'audit-log', audit);

    res.json(populatedTask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const updateTask = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  let task = await Task.findById(id)
    .populate('assignedTo', 'name email role')
    .populate('project', 'name manager')
    .populate('createdBy', 'name role');

  if (!task) return res.status(404).json({ error: 'Task not found' });

  const oldStatus = task.status;
  task.status = status || task.status;
  await task.save();

  // Refetch with populate
  const updatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email')
    .populate('project', 'name manager')
    .populate('createdBy', 'name role');

  // --- Audit log ---
  const audit = await AuditLog.create({
    action: 'Task Update',
    performedBy: req.user.id,
    details: `${req.userObj.name} updated Task "${task.title}" from "${oldStatus}" to "${task.status}"`
  });

  // --- Real-time updates ---
  const io = req.io;
  const onlineUsers = req.onlineUsers;
  const updaterId = String(req.user.id);

  // Notify assigned member
  if (updatedTask.assignedTo) {
    const memberId = String(updatedTask.assignedTo._id);
    const memberSocket = onlineUsers.get(memberId);

    if (memberSocket) {
      io.to(memberSocket.socketId).emit('task-updated', updatedTask);

      // Only send notification if updater is NOT the member
      if (updaterId !== memberId) {
        io.to(memberSocket.socketId).emit('notification', {
          message: `Your task "${updatedTask.title}" status was updated to: ${updatedTask.status}`,
          type: 'task-status',
        });
      }
    }
  }

  /// Notify project manager (if exists and different from updater)
  if (updatedTask.project?.manager) {
    const managerId = String(updatedTask.project.manager);
    const managerSocket = onlineUsers.get(managerId);

    if (managerSocket) {
      io.to(managerSocket.socketId).emit('task-updated', updatedTask);

      // Only send notification if updater is the member
      if (updaterId === String(updatedTask.assignedTo?._id)) {
        io.to(managerSocket.socketId).emit('notification', {
          message: `Task "${updatedTask.title}" (by ${updatedTask.assignedTo?.name}) moved to: ${updatedTask.status}`,
          type: 'task-updated-by-member',
        });
      }
    }
  }

  // --- Notify admins ---
  emitToAdmins(req.onlineUsers, req.io, 'task-updated', task);
  emitToAdmins(req.onlineUsers, req.io, 'audit-log', audit);

  res.json(updatedTask);
};

// GET MY TASKS
export const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user.id })
      .populate('project', 'name role')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignedTo', 'name email')
      .populate('project', 'name')
      .populate('createdBy', 'name');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

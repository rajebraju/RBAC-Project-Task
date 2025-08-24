import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

// Change user role (Admin only)
export const changeRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const oldRole = user.role;
    user.role = role;
    await user.save();

    // Audit Log
    await AuditLog.create({
      action: 'Role Changed',
      performedBy: req.user.id,
      targetUser: id,
      details: `${user.name} changed from ${oldRole} → ${role} by ${req.userObj.name}`
    });

    // Real-time: Tell user their role changed
    const userSocket = req.onlineUsers.get(id);
    if (userSocket) {
      req.io.to(userSocket.socketId).emit('role-updated', {
        role: role,
        message: `You were promoted to ${role}!`,
        performedBy: req.userObj.name
      });
    }

    res.json({ message: 'Role updated', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, '_id name email role');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all members (to populate dropdown)
export const getAllMembers = async (req, res) => {
  try {
    const members = await User.find({ role: 'Member' }).select('_id name email');
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

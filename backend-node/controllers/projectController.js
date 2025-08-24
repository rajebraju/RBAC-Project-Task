import Project from '../models/Project.js';
import Task from '../models/Task.js';
import AuditLog from '../models/AuditLog.js';

const emitToAdmins = (onlineUsers, io, event, payload) => {
  onlineUsers.forEach(u => {
    if (u.role === 'admin') {
      io.to(u.socketId).emit(event, payload);
    }
  });
};

// --- Create Project ---
export const createProject = async (req, res) => {
  try {
    const { name, description, managerId } = req.body;

    let project = new Project({
      name,
      description,
      createdBy: req.user.id,
      manager: managerId
    });
    await project.save();

    const populatedProject = await Project.findById(project._id).populate('manager', 'name email');

    const audit = await AuditLog.create({
      action: 'Project Created',
      performedBy: req.user.id,
      details: `${req.userObj.name} created project "${name}"`
    });

    // Notify assigned manager
    const managerSocket = req.onlineUsers.get(managerId);
    if (managerSocket) {
      req.io.to(managerSocket.socketId).emit('notification', { message: `You were assigned as Manager for "${name}"`, type: 'project-assigned' });
      req.io.to(managerSocket.socketId).emit('project-updated', project);
    }
    emitToAdmins(req.onlineUsers, req.io, 'project-created', populatedProject);
    emitToAdmins(req.onlineUsers, req.io, 'audit-log', audit);

    // Populate before sending response
    project = await Project.findById(project._id).populate('manager', 'name email');
    res.json(project);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// --- Update Project Status ---
export const updateProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    let project = await Project.findById(id).populate('manager', 'name email');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const oldStatus = project.status;
    project.status = status || project.status;
    await project.save();

    // Audit log
    const audit = await AuditLog.create({
      action: 'Project Status Updated',
      performedBy: req.user.id,
      details: `${req.userObj.name} changed "${project.name}" from ${oldStatus} → ${status}`
    });

    const updatedProject = await Project.findById(project._id).populate('manager', 'name email');

    const updaterId = String(req.user.id);
    const managerId = String(project.manager._id);

    // If updater is Admin, notify manager
    if (req.user.role.toLowerCase() === 'admin' && updaterId !== managerId) {
      const managerSocket = req.onlineUsers.get(managerId);
      if (managerSocket) {
        req.io.to(managerSocket.socketId).emit('project-updated', updatedProject);
        req.io.to(managerSocket.socketId).emit('notification', {
          message: `Project "${project.name}" status updated to ${status} by ${req.userObj.name}`,
          type: 'project-status'
        });
      }
    }

    // Always emit to all admins for audit/log update
    for (const [userId, userSocket] of req.onlineUsers) {
      if (userSocket.role.toLowerCase() === 'admin') {
        req.io.to(userSocket.socketId).emit('project-updated', updatedProject);
        req.io.to(userSocket.socketId).emit('audit-log', audit);
      }
    }

    res.json(updatedProject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id).populate('manager', 'name email');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Find all tasks under this project
    const tasksToDelete = await Task.find({ project: project._id });

    // Delete tasks
    const deletedTasks = await Task.deleteMany({ project: project._id });
    const deletedTaskIds = tasksToDelete.map(t => t._id.toString());

    // Delete project
    await project.deleteOne();

    // Audit log
    await AuditLog.create({
      action: 'Project Deleted',
      performedBy: req.user.id,
      details: `"${project.name}" deleted by ${req.userObj.name}. ${deletedTasks.deletedCount} tasks removed.`
    });

    // Notify manager
    const managerSocket = req.onlineUsers.get(project.manager._id.toString());
    if (managerSocket) {
      req.io.to(managerSocket.socketId).emit('project-deleted', project._id);
      req.io.to(managerSocket.socketId).emit('notification', {
        message: `Project "${project.name}" was deleted along with ${deletedTasks.deletedCount} tasks`,
        type: 'project-delete'
      });
      // Notify manager to remove tasks from their dashboard
      req.io.to(managerSocket.socketId).emit('tasks-deleted', deletedTaskIds);
    }

    // Notify all assigned members
    tasksToDelete.forEach(task => {
      if (task.assignedTo && req.onlineUsers.has(task.assignedTo.toString())) {
        const memberSocket = req.onlineUsers.get(task.assignedTo.toString()).socketId;
        req.io.to(memberSocket).emit('tasks-deleted', deletedTaskIds);
        req.io.to(memberSocket).emit('notification', {
          message: `Tasks from deleted project "${project.name}" were removed`,
          type: 'task-delete'
        });
      }
    });

    // Notify admins
    for (const [userId, userSocket] of req.onlineUsers) {
      if (userSocket.role === 'Admin') {
        req.io.to(userSocket.socketId).emit('project-deleted', project._id);
        req.io.to(userSocket.socketId).emit('notification', {
          message: `Project "${project.name}" was deleted by ${req.userObj.name}. ${deletedTasks.deletedCount} tasks removed.`,
          type: 'project-delete-admin'
        });
        req.io.to(userSocket.socketId).emit('tasks-deleted', deletedTaskIds);
      }
    }

    res.json({ message: `Project and ${deletedTasks.deletedCount} related tasks deleted` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// --- Get Assigned Projects for Manager ---
export const getAssignedProjects = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ message: 'Unauthorized' });

    const managerId = req.user.id;
    const projects = await Project.find({ manager: managerId })
      .populate('manager', '_id name email')
      .populate('members', '_id name email');

    const projectIds = projects.map(p => p._id);
    const tasks = await Task.find({
      $or: [
        { project: { $in: projectIds } },
        { assignedTo: managerId }
      ]
    }).populate('assignedTo', '_id name email')
      .populate('project', '_id name');

    res.json({ projects, tasks });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// --- Get All Projects for Admin ---
export const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('manager', 'name email')
      .populate('createdBy', 'name');
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// --- Get Audit Logs ---
export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('performedBy', 'name role')
      .sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

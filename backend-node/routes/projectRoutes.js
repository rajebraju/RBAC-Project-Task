import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { createProject, deleteProject, updateProjectStatus, getAllProjects, getAuditLogs, getAssignedProjects }
    from '../controllers/projectController.js';

const router = Router();

router.get('/', protect, getAllProjects);
router.post('/', protect, authorize('Admin'), createProject);
router.get('/assigned', protect, authorize('Manager'), getAssignedProjects);
router.delete('/:id', protect, authorize('Admin'), deleteProject);
router.patch('/:id/status', protect, authorize('Manager', 'Admin'), updateProjectStatus);
router.get('/audit', protect, authorize('Admin'), getAuditLogs);

export default router;
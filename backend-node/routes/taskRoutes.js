import { Router } from 'express';
import { createTask, updateTask, getMyTasks, getAllTasks } from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', protect, createTask);
router.patch('/:id', protect, updateTask);
router.get('/my-tasks', protect, getMyTasks);
router.get('/', getAllTasks);

export default router;
import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { changeRole, getAllUsers, getAllMembers } from '../controllers/userController.js';

const router = Router();

router.get('/', protect, authorize('Admin', 'Manager','Member'), getAllUsers);
router.get('/members', protect, authorize('Admin','Manager'), getAllMembers);
router.patch('/:id/role', protect, authorize('Admin'), changeRole);

export default router;
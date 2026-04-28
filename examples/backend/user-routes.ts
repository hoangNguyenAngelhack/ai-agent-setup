import { Router } from 'express';
import { userController } from './user-controller';
import { authenticate, authorize } from './auth-middleware';

const router = Router();

router.get('/', authenticate, userController.list);
router.get('/:id', authenticate, userController.getById);
router.post('/', authenticate, authorize('ADMIN'), userController.create);
router.patch('/:id', authenticate, userController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), userController.delete);

export { router as userRoutes };

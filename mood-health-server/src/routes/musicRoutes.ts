import { Router } from 'express';
import { 
  getMusicList, 
  getMusicById, 
  createMusic, 
  updateMusic, 
  deleteMusic 
} from '../controllers/musicController';
import { authenticate } from '../middleware/auth';

const router = Router();

// 公开路由
router.get('/', getMusicList);
router.get('/:id', getMusicById);

// 需要认证的路由（管理员功能）
router.post('/', authenticate, createMusic);
router.put('/:id', authenticate, updateMusic);
router.delete('/:id', authenticate, deleteMusic);

export default router;
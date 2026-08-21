import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { listNotifications, markAsRead } from '../services/notificationService.js';

const router = Router();
router.use(requireAuth);

/** GET /notifications?unread=true */
router.get('/', asyncHandler(async (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const notifications = await listNotifications(req.user.userId, { unreadOnly });
  res.json({ notifications });
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const updated = await markAsRead(req.params.id, req.user.userId);
  if (!updated) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  res.json({ notification: updated });
}));

export default router;

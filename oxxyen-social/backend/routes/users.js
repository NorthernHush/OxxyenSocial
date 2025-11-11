const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { encryptSessionKey, decryptSessionKey } = require('../utils/e2eEncryption');
const { friendRequestLimiter, uploadLimiter } = require('../middleware/rateLimit');
const logger = require('../utils/logger');

const router = express.Router();

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    res.json(user.getPublicProfile());
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Update profile
router.put('/me', [
  body('username').optional().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('description').optional().isLength({ max: 500 }),
  body('isPrivate').optional().isBoolean(),
  body('notifications').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { username, description, isPrivate, notifications } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Check username uniqueness
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'Username уже занят' });
      }
      user.username = username;
    }

    if (description !== undefined) user.description = description;
    if (isPrivate !== undefined) user.isPrivate = isPrivate;
    if (notifications) {
      user.notifications = { ...user.notifications, ...notifications };
    }

    user.updatedAt = new Date();
    await user.save();

    logger.info(`Profile updated: ${user.username}`);

    res.json({
      message: 'Профиль обновлён',
      user: user.getPublicProfile()
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Update user status
router.put('/me/status', [
  body('status').isIn(['online', 'offline', 'away'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { status } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    await user.updateStatus(status);

    logger.info(`Status updated: ${user.username} -> ${status}`);

    res.json({ message: 'Статус обновлён' });
  } catch (error) {
    logger.error('Update status error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Block user
router.post('/:username/block', async (req, res) => {
  try {
    const { username } = req.params;
    const targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Нельзя заблокировать себя' });
    }

    const currentUser = await User.findById(req.user._id);

    if (currentUser.isBlocked(targetUser._id)) {
      return res.status(400).json({ message: 'Пользователь уже заблокирован' });
    }

    await currentUser.blockUser(targetUser._id);

    logger.info(`${currentUser.username} blocked ${targetUser.username}`);

    res.json({ message: 'Пользователь заблокирован' });
  } catch (error) {
    logger.error('Block user error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Unblock user
router.delete('/:username/block', async (req, res) => {
  try {
    const { username } = req.params;
    const targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const currentUser = await User.findById(req.user._id);

    if (!currentUser.isBlocked(targetUser._id)) {
      return res.status(400).json({ message: 'Пользователь не заблокирован' });
    }

    await currentUser.unblockUser(targetUser._id);

    logger.info(`${currentUser.username} unblocked ${targetUser.username}`);

    res.json({ message: 'Пользователь разблокирован' });
  } catch (error) {
    logger.error('Unblock user error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Upload avatar
router.post('/me/avatar', uploadLimiter, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Delete old avatar if exists
    if (user.avatar) {
      const fs = require('fs');
      const path = require('path');
      const oldAvatarPath = path.join(__dirname, '../../uploads', user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    user.avatar = req.file.filename;
    await user.save();

    logger.info(`Avatar uploaded: ${user.username}`);

    res.json({
      message: 'Аватар загружен',
      avatar: user.avatar
    });
  } catch (error) {
    logger.error('Avatar upload error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Upload banner
router.post('/me/banner', uploadLimiter, upload.single('banner'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Delete old banner if exists
    if (user.banner) {
      const fs = require('fs');
      const path = require('path');
      const oldBannerPath = path.join(__dirname, '../../uploads', user.banner);
      if (fs.existsSync(oldBannerPath)) {
        fs.unlinkSync(oldBannerPath);
      }
    }

    user.banner = req.file.filename;
    await user.save();

    logger.info(`Banner uploaded: ${user.username}`);

    res.json({
      message: 'Баннер загружен',
      banner: user.banner
    });
  } catch (error) {
    logger.error('Banner upload error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Update developer status
router.put('/me/developer', [
  body('isDeveloper').isBoolean(),
  body('developerSignature').optional().isLength({ max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { isDeveloper, developerSignature } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    user.isDeveloper = isDeveloper;
    if (developerSignature !== undefined) {
      user.developerSignature = developerSignature;
    }

    user.updatedAt = new Date();
    await user.save();

    logger.info(`Developer status updated: ${user.username}`);

    res.json({
      message: 'Статус разработчика обновлён',
      user: user.getPublicProfile()
    });
  } catch (error) {
    logger.error('Update developer status error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get user by username
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Check privacy
    if (user.isPrivate && (!req.user || req.user._id.toString() !== user._id.toString())) {
      // Check if current user is friend
      const isFriend = user.friends.includes(req.user._id);
      if (!isFriend) {
        return res.status(403).json({ message: 'Профиль приватный' });
      }
    }

    res.json(user.getPublicProfile());
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Follow user
router.post('/:username/follow', async (req, res) => {
  try {
    const { username } = req.params;
    const targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Нельзя подписаться на себя' });
    }

    const currentUser = await User.findById(req.user._id);

    // Check if already following
    if (currentUser.following.includes(targetUser._id)) {
      return res.status(400).json({ message: 'Уже подписаны' });
    }

    // If target user is private, don't auto-follow
    if (targetUser.isPrivate) {
      // Add to following (pending)
      currentUser.following.push(targetUser._id);
      await currentUser.save();

      return res.json({ message: 'Запрос на подписку отправлен' });
    }

    // Public profile - auto-follow
    currentUser.following.push(targetUser._id);
    targetUser.followers.push(currentUser._id);

    // Check if mutual follow (become friends)
    if (targetUser.following.includes(currentUser._id)) {
      if (!currentUser.friends.includes(targetUser._id)) {
        currentUser.friends.push(targetUser._id);
      }
      if (!targetUser.friends.includes(currentUser._id)) {
        targetUser.friends.push(currentUser._id);
      }
    }

    await currentUser.save();
    await targetUser.save();

    logger.info(`${currentUser.username} followed ${targetUser.username}`);

    res.json({ message: 'Подписка оформлена' });
  } catch (error) {
    logger.error('Follow user error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Unfollow user
router.delete('/:username/follow', async (req, res) => {
  try {
    const { username } = req.params;
    const targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const currentUser = await User.findById(req.user._id);

    // Remove from following
    currentUser.following = currentUser.following.filter(id => id.toString() !== targetUser._id.toString());
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUser._id.toString());

    // Remove from friends if mutual
    currentUser.friends = currentUser.friends.filter(id => id.toString() !== targetUser._id.toString());
    targetUser.friends = targetUser.friends.filter(id => id.toString() !== currentUser._id.toString());

    await currentUser.save();
    await targetUser.save();

    logger.info(`${currentUser.username} unfollowed ${targetUser.username}`);

    res.json({ message: 'Подписка отменена' });
  } catch (error) {
    logger.error('Unfollow user error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get followers
router.get('/:username/followers', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).populate('followers', 'username avatar description');

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Check privacy
    if (user.isPrivate && (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(403).json({ message: 'Профиль приватный' });
    }

    res.json(user.followers);
  } catch (error) {
    logger.error('Get followers error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get following
router.get('/:username/following', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).populate('following', 'username avatar description');

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Check privacy
    if (user.isPrivate && (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(403).json({ message: 'Профиль приватный' });
    }

    res.json(user.following);
  } catch (error) {
    logger.error('Get following error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get friends
router.get('/:username/friends', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).populate('friends', 'username avatar description status lastSeen isDeveloper developerSignature');

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Check privacy
    if (user.isPrivate && (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(403).json({ message: 'Профиль приватный' });
    }

    res.json(user.friends);
  } catch (error) {
    logger.error('Get friends error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Delete account
router.delete('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Delete all user data
    const fs = require('fs');
    const path = require('path');

    // Delete avatar
    if (user.avatar) {
      const avatarPath = path.join(__dirname, '../../uploads', user.avatar);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    // Delete banner
    if (user.banner) {
      const bannerPath = path.join(__dirname, '../../uploads', user.banner);
      if (fs.existsSync(bannerPath)) {
        fs.unlinkSync(bannerPath);
      }
    }

    // Delete from database (cascade delete would be handled by mongoose middleware if implemented)
    await User.findByIdAndDelete(req.user._id);

    logger.info(`Account deleted: ${user.username}`);

    res.json({ message: 'Аккаунт удалён' });
  } catch (error) {
    logger.error('Delete account error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Send friend request
router.post('/:username/friend-request', friendRequestLimiter, async (req, res) => {
  try {
    const { username } = req.params;
    const targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Нельзя отправить запрос самому себе' });
    }

    const currentUser = await User.findById(req.user._id);

    // Check if already friends
    if (currentUser.friends.includes(targetUser._id)) {
      return res.status(400).json({ message: 'Уже друзья' });
    }

    // Check if request already exists
    const existingRequest = targetUser.friendRequests.find(
      req => req.from.toString() === currentUser._id.toString() && req.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({ message: 'Запрос уже отправлен' });
    }

    // Add friend request
    targetUser.friendRequests.push({
      from: currentUser._id,
      status: 'pending'
    });

    await targetUser.save();

    logger.info(`Friend request sent from ${currentUser.username} to ${targetUser.username}`);

    res.json({ message: 'Запрос в друзья отправлен' });
  } catch (error) {
    logger.error('Send friend request error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Accept friend request
router.post('/friend-request/:requestId/accept', async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUser = await User.findById(req.user._id);

    const friendRequest = currentUser.friendRequests.id(requestId);
    if (!friendRequest || friendRequest.status !== 'pending') {
      return res.status(404).json({ message: 'Запрос не найден' });
    }

    const requester = await User.findById(friendRequest.from);
    if (!requester) {
      return res.status(404).json({ message: 'Отправитель не найден' });
    }

    // Accept request
    friendRequest.status = 'accepted';

    // Add to friends lists
    if (!currentUser.friends.includes(requester._id)) {
      currentUser.friends.push(requester._id);
    }
    if (!requester.friends.includes(currentUser._id)) {
      requester.friends.push(currentUser._id);
    }

    // Exchange public keys for E2E encryption
    // Note: Private keys are handled client-side

    await currentUser.save();
    await requester.save();

    logger.info(`Friend request accepted: ${requester.username} and ${currentUser.username} are now friends`);

    res.json({
      message: 'Запрос принят',
      friend: requester.getPublicProfile()
    });
  } catch (error) {
    logger.error('Accept friend request error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Reject friend request
router.post('/friend-request/:requestId/reject', async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUser = await User.findById(req.user._id);

    const friendRequest = currentUser.friendRequests.id(requestId);
    if (!friendRequest || friendRequest.status !== 'pending') {
      return res.status(404).json({ message: 'Запрос не найден' });
    }

    friendRequest.status = 'rejected';
    await currentUser.save();

    logger.info(`Friend request rejected by ${currentUser.username}`);

    res.json({ message: 'Запрос отклонён' });
  } catch (error) {
    logger.error('Reject friend request error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get friend requests
router.get('/me/friend-requests', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friendRequests.from', 'username avatar description');

    res.json(user.friendRequests);
  } catch (error) {
    logger.error('Get friend requests error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Remove friend
router.delete('/:username/friend', async (req, res) => {
  try {
    const { username } = req.params;
    const targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const currentUser = await User.findById(req.user._id);

    // Remove from friends
    currentUser.friends = currentUser.friends.filter(id => id.toString() !== targetUser._id.toString());
    targetUser.friends = targetUser.friends.filter(id => id.toString() !== currentUser._id.toString());

    await currentUser.save();
    await targetUser.save();

    logger.info(`Friend removed: ${currentUser.username} and ${targetUser.username}`);

    res.json({ message: 'Друг удалён' });
  } catch (error) {
    logger.error('Remove friend error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;

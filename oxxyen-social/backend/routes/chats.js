const express = require('express');
const { body, validationResult } = require('express-validator');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { generateSessionKey, encryptMessage, decryptMessage, encryptSessionKey, decryptSessionKey } = require('../utils/e2eEncryption');
const { messageLimiter } = require('../middleware/rateLimit');
const logger = require('../utils/logger');

const router = express.Router();

// Get user's chats
router.get('/', async (req, res) => {
  try {
    const chats = await Chat.find({
      'participants.user': req.user._id,
      isActive: true
    })
    .populate('participants.user', 'username avatar status lastSeen')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    logger.error('Get chats error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Create direct chat
router.post('/direct/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Нельзя создать чат с собой' });
    }

    // Check if chat already exists
    const existingChat = await Chat.findOne({
      type: 'direct',
      'participants.user': { $all: [req.user._id, targetUser._id] }
    });

    if (existingChat) {
      return res.json(existingChat);
    }

    // Create new chat
    const chat = new Chat({
      type: 'direct',
      participants: [
        { user: req.user._id, role: 'admin' },
        { user: targetUser._id, role: 'admin' }
      ],
      createdBy: req.user._id
    });

    await chat.save();
    await chat.populate('participants.user', 'username avatar status lastSeen');

    logger.info(`Direct chat created between ${req.user.username} and ${username}`);

    res.status(201).json(chat);
  } catch (error) {
    logger.error('Create direct chat error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Create group chat
router.post('/group', [
  body('name').isLength({ min: 1, max: 100 }),
  body('participants').isArray({ min: 1, max: 499 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { name, description, participants } = req.body;

    // Add creator to participants
    const allParticipants = [...new Set([...participants, req.user._id.toString()])];

    // Validate participants exist
    const users = await User.find({ _id: { $in: allParticipants } });
    if (users.length !== allParticipants.length) {
      return res.status(400).json({ message: 'Один или несколько участников не найдены' });
    }

    const chat = new Chat({
      type: 'group',
      name,
      description: description || '',
      participants: allParticipants.map(userId => ({
        user: userId,
        role: userId === req.user._id.toString() ? 'admin' : 'member'
      })),
      createdBy: req.user._id
    });

    await chat.save();
    await chat.populate('participants.user', 'username avatar status lastSeen');

    logger.info(`Group chat created: ${name} by ${req.user.username}`);

    res.status(201).json(chat);
  } catch (error) {
    logger.error('Create group chat error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get chat by ID
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId)
      .populate('participants.user', 'username avatar status lastSeen')
      .populate('lastMessage');

    if (!chat || !chat.isParticipant(req.user._id)) {
      return res.status(404).json({ message: 'Чат не найден' });
    }

    res.json(chat);
  } catch (error) {
    logger.error('Get chat error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Update group chat
router.put('/:chatId', [
  body('name').optional().isLength({ min: 1, max: 100 }),
  body('description').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { chatId } = req.params;
    const { name, description } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isParticipant(req.user._id) || !chat.isAdmin(req.user._id)) {
      return res.status(403).json({ message: 'Нет доступа' });
    }

    if (name) chat.name = name;
    if (description !== undefined) chat.description = description;
    chat.updatedAt = new Date();

    await chat.save();

    logger.info(`Group chat updated: ${chatId}`);

    res.json({ message: 'Чат обновлён', chat });
  } catch (error) {
    logger.error('Update chat error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Add participant to group
router.post('/:chatId/participants', [
  body('userId').isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { chatId } = req.params;
    const { userId } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat || chat.type !== 'group' || !chat.isAdmin(req.user._id)) {
      return res.status(403).json({ message: 'Нет доступа' });
    }

    if (chat.participants.length >= 500) {
      return res.status(400).json({ message: 'Максимум 500 участников' });
    }

    await chat.addParticipant(userId);
    await chat.populate('participants.user', 'username avatar status lastSeen');

    logger.info(`User ${userId} added to chat ${chatId}`);

    res.json({ message: 'Участник добавлен', chat });
  } catch (error) {
    logger.error('Add participant error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Remove participant from group
router.delete('/:chatId/participants/:userId', async (req, res) => {
  try {
    const { chatId, userId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat || chat.type !== 'group') {
      return res.status(404).json({ message: 'Чат не найден' });
    }

    // Check permissions
    const isSelf = userId === req.user._id.toString();
    const isAdmin = chat.isAdmin(req.user._id);

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: 'Нет доступа' });
    }

    await chat.removeParticipant(userId);

    logger.info(`User ${userId} removed from chat ${chatId}`);

    res.json({ message: 'Участник удалён' });
  } catch (error) {
    logger.error('Remove participant error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Send message (E2E encrypted)
router.post('/:chatId/messages', messageLimiter, [
  body('encryptedContent').exists(),
  body('sessionKey').exists(),
  body('iv').exists(),
  body('authTag').exists(),
  body('type').optional().isIn(['text', 'image', 'file', 'emoji'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { chatId } = req.params;
    const { encryptedContent, sessionKey, iv, authTag, type = 'text', fileUrl, fileName, fileSize, encryptedFileKey } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isParticipant(req.user._id)) {
      return res.status(404).json({ message: 'Чат не найден' });
    }

    // For direct chats, encrypt session key for recipient
    let encryptedSessionKey = null;
    if (chat.type === 'direct') {
      const recipient = chat.participants.find(p => p.user.toString() !== req.user._id.toString());
      const recipientUser = await User.findById(recipient.user);
      if (recipientUser && recipientUser.publicKey) {
        encryptedSessionKey = encryptSessionKey(Buffer.from(sessionKey, 'hex'), recipientUser.publicKey);
      }
    }

    const message = new Message({
      chat: chatId,
      sender: req.user._id,
      encryptedContent,
      sessionKey: encryptedSessionKey,
      iv,
      authTag,
      type,
      fileUrl,
      fileName,
      fileSize,
      encryptedFileKey
    });

    await message.save();
    await message.populate('sender', 'username avatar');

    // Update chat's last message
    await chat.updateLastMessage(message._id);

    logger.info(`E2E encrypted message sent in chat ${chatId} by ${req.user.username}`);

    res.status(201).json(message);
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get chat messages
router.get('/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isParticipant(req.user._id)) {
      return res.status(404).json({ message: 'Чат не найден' });
    }

    const messages = await Message.find({
      chat: chatId,
      deletedFor: { $ne: req.user._id }
    })
    .populate('sender', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    res.json(messages.reverse());
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Delete message for everyone
router.delete('/:chatId/messages/:messageId/everyone', async (req, res) => {
  try {
    const { chatId, messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message || message.chat.toString() !== chatId) {
      return res.status(404).json({ message: 'Сообщение не найдено' });
    }

    // Only sender can delete for everyone
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Нет доступа' });
    }

    await message.deleteForEveryone();

    logger.info(`Message ${messageId} deleted for everyone from chat ${chatId}`);

    res.json({ message: 'Сообщение удалено для всех' });
  } catch (error) {
    logger.error('Delete message for everyone error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Delete message for self
router.delete('/:chatId/messages/:messageId', async (req, res) => {
  try {
    const { chatId, messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message || message.chat.toString() !== chatId) {
      return res.status(404).json({ message: 'Сообщение не найдено' });
    }

    await message.deleteForUser(req.user._id);

    logger.info(`Message ${messageId} deleted for user ${req.user._id} from chat ${chatId}`);

    res.json({ message: 'Сообщение удалено' });
  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Add reaction to message
router.post('/:chatId/messages/:messageId/reactions', [
  body('emoji').isLength({ min: 1, max: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { chatId, messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message || message.chat.toString() !== chatId) {
      return res.status(404).json({ message: 'Сообщение не найдено' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Нет доступа к чату' });
    }

    await message.addReaction(emoji, req.user._id);

    logger.info(`Reaction ${emoji} added to message ${messageId} by ${req.user.username}`);

    res.json({ message: 'Реакция добавлена' });
  } catch (error) {
    logger.error('Add reaction error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Remove reaction from message
router.delete('/:chatId/messages/:messageId/reactions/:emoji', async (req, res) => {
  try {
    const { chatId, messageId, emoji } = req.params;

    const message = await Message.findById(messageId);
    if (!message || message.chat.toString() !== chatId) {
      return res.status(404).json({ message: 'Сообщение не найдено' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Нет доступа к чату' });
    }

    await message.removeReaction(emoji, req.user._id);

    logger.info(`Reaction ${emoji} removed from message ${messageId} by ${req.user.username}`);

    res.json({ message: 'Реакция удалена' });
  } catch (error) {
    logger.error('Remove reaction error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Search messages in chat
router.get('/:chatId/search', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Минимальная длина запроса - 2 символа' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Нет доступа к чату' });
    }

    // Note: This is a basic search. In production, implement client-side decryption
    // and search through decrypted content for true E2E search
    const messages = await Message.find({
      chat: chatId,
      deletedFor: { $ne: req.user._id },
      $or: [
        { content: { $regex: q, $options: 'i' } },
        { fileName: { $regex: q, $options: 'i' } }
      ]
    })
    .populate('sender', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    res.json(messages);
  } catch (error) {
    logger.error('Search messages error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Leave group chat
router.delete('/:chatId/leave', async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat || chat.type !== 'group' || !chat.isParticipant(req.user._id)) {
      return res.status(404).json({ message: 'Чат не найден' });
    }

    await chat.removeParticipant(req.user._id);

    // If no participants left, deactivate chat
    if (chat.participants.length === 0) {
      chat.isActive = false;
      await chat.save();
    }

    logger.info(`User ${req.user._id} left chat ${chatId}`);

    res.json({ message: 'Вы вышли из чата' });
  } catch (error) {
    logger.error('Leave chat error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;

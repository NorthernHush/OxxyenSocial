require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const User = require('./models/User');

require('dotenv').config(); 
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/oxxyen_social";

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const postRoutes = require('./routes/posts');

// Middleware
const { authenticateToken } = require('./middleware/auth');
const { errorHandler } = require('./middleware/security');

// Utils
const logger = require('./utils/logger');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3002",
    methods: ["GET", "POST"]
  }
});


// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');
app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', authLimiter);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3002",
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', authenticateToken, userRoutes);
app.use('/api/v1/chats', authenticateToken, chatRoutes);
app.use('/api/v1/posts', authenticateToken, postRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Error handling
app.use(errorHandler);

// Socket.IO for real-time chat
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', async (socket) => {
  logger.info(`User connected: ${socket.userId}`);

  // Update user status to online
  try {
    const user = await User.findById(socket.userId);
    if (user) {
      await user.updateStatus('online');
      // Broadcast status update to friends
      const friends = await User.find({ _id: { $in: user.friends } });
      friends.forEach(friend => {
        io.to(friend._id.toString()).emit('user_status_update', {
          userId: user._id,
          status: 'online'
        });
      });
    }
  } catch (error) {
    logger.error('Error updating user status:', error);
  }

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    logger.info(`User ${socket.userId} joined chat ${chatId}`);
  });

  socket.on('leave_chat', (chatId) => {
    socket.leave(chatId);
    logger.info(`User ${socket.userId} left chat ${chatId}`);
  });

  socket.on('typing_start', (chatId) => {
    socket.to(chatId).emit('user_typing', {
      userId: socket.userId,
      chatId,
      typing: true
    });
  });

  socket.on('typing_stop', (chatId) => {
    socket.to(chatId).emit('user_typing', {
      userId: socket.userId,
      chatId,
      typing: false
    });
  });

  socket.on('send_message', async (data) => {
    try {
      const { chatId, encryptedContent, sessionKey, iv, authTag, type, fileUrl, fileName, fileSize, encryptedFileKey } = data;
      const Message = require('./models/Message');
      const Chat = require('./models/Chat');

      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(socket.userId)) {
        socket.emit('error', 'Нет доступа к чату');
        return;
      }

      // For direct chats, encrypt session key for recipient
      let encryptedSessionKey = null;
      if (chat.type === 'direct') {
        const recipient = chat.participants.find(p => p.user.toString() !== socket.userId.toString());
        const recipientUser = await User.findById(recipient.user);
        if (recipientUser && recipientUser.publicKey) {
          const { encryptSessionKey } = require('./utils/e2eEncryption');
          encryptedSessionKey = encryptSessionKey(Buffer.from(sessionKey, 'hex'), recipientUser.publicKey);
        }
      }

      const message = new Message({
        chat: chatId,
        sender: socket.userId,
        encryptedContent,
        sessionKey: encryptedSessionKey,
        iv,
        authTag,
        type: type || 'text',
        fileUrl,
        fileName,
        fileSize,
        encryptedFileKey
      });

      await message.save();
      await message.populate('sender', 'username avatar');

      // Update chat's last message
      await chat.updateLastMessage(message._id);

      io.to(chatId).emit('new_message', message);
      logger.info(`E2E encrypted message sent in chat ${chatId} by user ${socket.userId}`);
    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('error', 'Ошибка отправки сообщения');
    }
  });

  socket.on('disconnect', async () => {
    logger.info(`User disconnected: ${socket.userId}`);

    // Update user status to offline
    try {
      const user = await User.findById(socket.userId);
      if (user) {
        await user.updateStatus('offline');
        // Broadcast status update to friends
        const friends = await User.find({ _id: { $in: user.friends } });
        friends.forEach(friend => {
          io.to(friend._id.toString()).emit('user_status_update', {
            userId: user._id,
            status: 'offline',
            lastSeen: user.lastSeen
          });
        });
      }
    } catch (error) {
      logger.error('Error updating user status on disconnect:', error);
    }
  });
});

// Database connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log("[INFO] MongoDB connected"))
  .catch(err => {
    console.error("[ERROR] MongoDB connection error:", err.message || err);
    process.exit(1); // завершить сервер при ошибке
  });

// Start server
const PORT = process.env.PORT || 3004;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

module.exports = { app, server, io };

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  // E2E Encryption fields
  encryptedContent: {
    type: String, // AES-256-GCM encrypted content
    default: null
  },
  sessionKey: {
    type: String, // RSA-encrypted session key for recipient
    default: null
  },
  iv: {
    type: String, // Initialization vector for AES-GCM
    default: null
  },
  authTag: {
    type: String, // Authentication tag for AES-GCM
    default: null
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'emoji'],
    default: 'text'
  },
  fileUrl: {
    type: String, // For attachments
    default: null
  },
  fileName: {
    type: String,
    default: null
  },
  fileSize: {
    type: Number,
    default: null
  },
  // File encryption
  encryptedFileKey: {
    type: String, // Encrypted file encryption key
    default: null
  },
  // Message reactions
  reactions: [{
    emoji: {
      type: String,
      required: true
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  // Thread support
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  deletedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for performance
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ createdAt: -1 });

// Mark as read by user
messageSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(read => read.user.toString() === userId.toString());
  if (!existingRead) {
    this.readBy.push({ user: userId });
  }
  return this.save();
};

// Check if read by user
messageSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(read => read.user.toString() === userId.toString());
};

// Soft delete for user
messageSchema.methods.deleteForUser = function(userId) {
  if (!this.deletedFor.includes(userId)) {
    this.deletedFor.push(userId);
  }
  return this.save();
};

// Check if deleted for user
messageSchema.methods.isDeletedFor = function(userId) {
  return this.deletedFor.includes(userId);
};

// Add reaction to message
messageSchema.methods.addReaction = function(emoji, userId) {
  let reaction = this.reactions.find(r => r.emoji === emoji);
  if (!reaction) {
    reaction = { emoji, users: [] };
    this.reactions.push(reaction);
  }
  if (!reaction.users.includes(userId)) {
    reaction.users.push(userId);
  }
  return this.save();
};

// Remove reaction from message
messageSchema.methods.removeReaction = function(emoji, userId) {
  const reactionIndex = this.reactions.findIndex(r => r.emoji === emoji);
  if (reactionIndex !== -1) {
    const reaction = this.reactions[reactionIndex];
    const userIndex = reaction.users.indexOf(userId);
    if (userIndex !== -1) {
      reaction.users.splice(userIndex, 1);
      if (reaction.users.length === 0) {
        this.reactions.splice(reactionIndex, 1);
      }
    }
  }
  return this.save();
};

// Check if user reacted with emoji
messageSchema.methods.hasReaction = function(emoji, userId) {
  const reaction = this.reactions.find(r => r.emoji === emoji);
  return reaction && reaction.users.includes(userId);
};

// Add reply to thread
messageSchema.methods.addReply = function(replyId) {
  if (!this.replies.includes(replyId)) {
    this.replies.push(replyId);
  }
  return this.save();
};

// Delete message for everyone (within time limit)
messageSchema.methods.deleteForEveryone = function() {
  const timeLimit = 24 * 60 * 60 * 1000; // 24 hours
  if (Date.now() - this.createdAt.getTime() <= timeLimit) {
    this.deletedAt = new Date();
    return this.save();
  }
  throw new Error('Message can only be deleted within 24 hours');
};

module.exports = mongoose.model('Message', messageSchema);

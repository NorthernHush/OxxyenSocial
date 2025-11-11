const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  // E2E Encryption for posts
  encryptedContent: {
    type: String, // AES-256-GCM encrypted content
    default: null
  },
  sessionKey: {
    type: String, // RSA-encrypted session key
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
  media: [{
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    }
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 500
    },
    // E2E Encryption for comments
    encryptedContent: {
      type: String, // AES-256-GCM encrypted content
      default: null
    },
    sessionKey: {
      type: String, // RSA-encrypted session key
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
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reposts: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  originalPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  isRepost: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  visibility: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public'
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
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ visibility: 1 });

// Virtual for like count
postSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for comment count
postSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Virtual for repost count
postSchema.virtual('repostCount').get(function() {
  return this.reposts.length;
});

// Check if liked by user
postSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Add like
postSchema.methods.addLike = function(userId) {
  if (!this.isLikedBy(userId)) {
    this.likes.push({ user: userId });
  }
  return this.save();
};

// Remove like
postSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(like => like.user.toString() !== userId.toString());
  return this.save();
};

// Add comment
postSchema.methods.addComment = function(userId, content) {
  this.comments.push({
    user: userId,
    content: content,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return this.save();
};

// Add repost
postSchema.methods.addRepost = function(userId) {
  if (!this.isRepostedBy(userId)) {
    this.reposts.push({ user: userId });
  }
  return this.save();
};

// Check if reposted by user
postSchema.methods.isRepostedBy = function(userId) {
  return this.reposts.some(repost => repost.user.toString() === userId.toString());
};

// Remove repost
postSchema.methods.removeRepost = function(userId) {
  this.reposts = this.reposts.filter(repost => repost.user.toString() !== userId.toString());
  return this.save();
};

module.exports = mongoose.model('Post', postSchema);

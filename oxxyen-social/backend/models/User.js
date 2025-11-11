const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String, // URL to uploaded avatar
    default: null
  },
  banner: {
    type: String, // URL to uploaded banner/cover photo
    default: null
  },
  isDeveloper: {
    type: Boolean,
    default: false
  },
  developerSignature: {
    type: String,
    maxlength: 100,
    default: ''
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  // User roles and permissions
  role: {
    type: String,
    enum: ['user', 'moderator', 'developer'],
    default: 'user'
  },
  // Blocked users
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Notification settings
  notifications: {
    pushEnabled: {
      type: Boolean,
      default: true
    },
    soundEnabled: {
      type: Boolean,
      default: true
    },
    messageNotifications: {
      type: Boolean,
      default: true
    },
    friendRequestNotifications: {
      type: Boolean,
      default: true
    },
    postLikeNotifications: {
      type: Boolean,
      default: false
    }
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: null
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  // E2E Encryption keys
  publicKey: {
    type: String, // RSA public key (PEM format)
    default: null
  },
  encryptedPrivateKey: {
    type: String, // Encrypted RSA private key
    default: null
  },
  privateKeySalt: {
    type: String, // Salt for private key encryption
    default: null
  },
  privateKeyIv: {
    type: String, // IV for private key encryption
    default: null
  },
  // Email verification
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  // Friend system
  friendRequests: [{
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
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
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update last seen
userSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  return this.save();
};

// Get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  return {
    _id: this._id,
    email: this.email,
    username: this.username,
    avatar: this.avatar,
    banner: this.banner,
    isDeveloper: this.isDeveloper,
    developerSignature: this.developerSignature,
    description: this.description,
    status: this.status,
    lastSeen: this.lastSeen,
    role: this.role,
    isPrivate: this.isPrivate,
    followers: this.followers,
    following: this.following,
    friends: this.friends,
    createdAt: this.createdAt
  };
};

// Update user status
userSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  if (newStatus === 'offline') {
    this.lastSeen = new Date();
  }
  return this.save();
};

// Check if user is blocked
userSchema.methods.isBlocked = function(userId) {
  return this.blockedUsers.includes(userId);
};

// Block user
userSchema.methods.blockUser = function(userId) {
  if (!this.blockedUsers.includes(userId)) {
    this.blockedUsers.push(userId);
  }
  return this.save();
};

// Unblock user
userSchema.methods.unblockUser = function(userId) {
  const index = this.blockedUsers.indexOf(userId);
  if (index !== -1) {
    this.blockedUsers.splice(index, 1);
  }
  return this.save();
};

// Check if user has permission
userSchema.methods.hasPermission = function(permission) {
  const rolePermissions = {
    user: ['read', 'write'],
    moderator: ['read', 'write', 'moderate'],
    developer: ['read', 'write', 'moderate', 'admin']
  };

  return rolePermissions[this.role]?.includes(permission) || false;
};

module.exports = mongoose.model('User', userSchema);

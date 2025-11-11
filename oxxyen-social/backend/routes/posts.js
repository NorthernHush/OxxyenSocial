const express = require('express');
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const User = require('../models/User');
const upload = require('../middleware/upload');
const logger = require('../utils/logger');

const router = express.Router();

// Get feed (chronological, no algorithm)
router.get('/feed', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const user = await User.findById(req.user._id);

    // Get posts from followed users and public posts
    const followedUsers = user.following.map(id => id.toString());
    followedUsers.push(req.user._id.toString()); // Include own posts

    const posts = await Post.find({
      $or: [
        { author: { $in: followedUsers } },
        { visibility: 'public' }
      ]
    })
    .populate('author', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    res.json(posts);
  } catch (error) {
    logger.error('Get feed error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get user's posts
router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Check privacy
    if (user.isPrivate && (!req.user || req.user._id.toString() !== user._id.toString())) {
      const isFriend = user.friends.includes(req.user._id);
      if (!isFriend) {
        return res.status(403).json({ message: 'Профиль приватный' });
      }
    }

    const posts = await Post.find({ author: user._id })
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json(posts);
  } catch (error) {
    logger.error('Get user posts error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Create post
router.post('/', upload.array('media', 10), [
  body('content').isLength({ min: 1, max: 2000 }),
  body('visibility').optional().isIn(['public', 'friends', 'private'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { content, visibility = 'public' } = req.body;
    const media = [];

    // Process uploaded files
    if (req.files) {
      for (const file of req.files) {
        const type = file.mimetype.startsWith('image/') ? 'image' : 'video';
        media.push({
          type,
          url: `/uploads/${file.filename}`,
          filename: file.filename
        });
      }
    }

    const post = new Post({
      author: req.user._id,
      content,
      media,
      visibility
    });

    await post.save();
    await post.populate('author', 'username avatar');

    logger.info(`Post created by ${req.user.username}`);

    res.status(201).json(post);
  } catch (error) {
    logger.error('Create post error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get post by ID
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).populate('author', 'username avatar');

    if (!post) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    // Check visibility
    if (post.visibility === 'private' && post.author._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Нет доступа' });
    }

    if (post.visibility === 'friends') {
      const author = await User.findById(post.author._id);
      const isFriend = author.friends.includes(req.user._id);
      if (!isFriend && post.author._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Нет доступа' });
      }
    }

    res.json(post);
  } catch (error) {
    logger.error('Get post error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Update post
router.put('/:postId', [
  body('content').optional().isLength({ min: 1, max: 2000 }),
  body('visibility').optional().isIn(['public', 'friends', 'private'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { postId } = req.params;
    const { content, visibility } = req.body;

    const post = await Post.findById(postId);
    if (!post || post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Нет доступа' });
    }

    if (content) post.content = content;
    if (visibility) post.visibility = visibility;
    post.updatedAt = new Date();

    await post.save();

    logger.info(`Post updated: ${postId}`);

    res.json({ message: 'Пост обновлён', post });
  } catch (error) {
    logger.error('Update post error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Delete post
router.delete('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);

    if (!post || post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Нет доступа' });
    }

    // Delete media files
    const fs = require('fs');
    const path = require('path');
    for (const media of post.media) {
      const filePath = path.join(__dirname, '../../uploads', media.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Post.findByIdAndDelete(postId);

    logger.info(`Post deleted: ${postId}`);

    res.json({ message: 'Пост удалён' });
  } catch (error) {
    logger.error('Delete post error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Like/Unlike post
router.post('/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    if (post.isLikedBy(req.user._id)) {
      await post.removeLike(req.user._id);
      res.json({ message: 'Лайк удалён' });
    } else {
      await post.addLike(req.user._id);
      res.json({ message: 'Лайк добавлен' });
    }
  } catch (error) {
    logger.error('Like post error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Add comment
router.post('/:postId/comments', [
  body('content').isLength({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { postId } = req.params;
    const { content } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    await post.addComment(req.user._id, content);

    logger.info(`Comment added to post ${postId}`);

    res.status(201).json({ message: 'Комментарий добавлен' });
  } catch (error) {
    logger.error('Add comment error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Get comments
router.get('/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    const comments = post.comments
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice((page - 1) * limit, page * limit);

    // Populate user data
    const populatedComments = await Promise.all(
      comments.map(async (comment) => {
        const user = await User.findById(comment.user).select('username avatar');
        return {
          ...comment.toObject(),
          user
        };
      })
    );

    res.json(populatedComments.reverse());
  } catch (error) {
    logger.error('Get comments error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Repost
router.post('/:postId/repost', async (req, res) => {
  try {
    const { postId } = req.params;
    const originalPost = await Post.findById(postId);

    if (!originalPost) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    if (originalPost.isRepostedBy(req.user._id)) {
      await originalPost.removeRepost(req.user._id);
      res.json({ message: 'Репост удалён' });
    } else {
      await originalPost.addRepost(req.user._id);
      res.json({ message: 'Репост добавлен' });
    }
  } catch (error) {
    logger.error('Repost error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;

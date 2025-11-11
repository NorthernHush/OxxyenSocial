const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

describe('Chat System', () => {
  let token1, token2, user1, user2;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Chat.deleteMany({});
    await Message.deleteMany({});

    // Create test users
    user1 = await User.create({
      email: 'user1@example.com',
      username: 'user1',
      password: 'password123'
    });

    user2 = await User.create({
      email: 'user2@example.com',
      username: 'user2',
      password: 'password123'
    });

    // Generate tokens
    const jwt = require('jsonwebtoken');
    token1 = jwt.sign({ userId: user1._id }, process.env.JWT_SECRET);
    token2 = jwt.sign({ userId: user2._id }, process.env.JWT_SECRET);
  });

  describe('POST /api/v1/chats/direct/:username', () => {
    it('should create a new chat', async () => {
      const response = await request(app)
        .post(`/api/v1/chats/direct/${user2.username}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.type).toBe('direct');
      expect(response.body.participants).toHaveLength(2);
    });
  });

  describe('POST /api/v1/chats/:chatId/messages', () => {
    let chatId;

    beforeEach(async () => {
      const chat = await Chat.create({
        type: 'direct',
        participants: [{ user: user1._id }, { user: user2._id }],
        createdBy: user1._id
      });
      chatId = chat._id;
    });

    it('should send a message', async () => {
      const response = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${token1}`)
        .send({
          content: 'Hello, world!',
          type: 'text'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.content).toBe('Hello, world!');
      expect(response.body.sender._id).toBe(user1._id.toString());
    });

    it('should not send message to non-participant chat', async () => {
      const otherUser = await User.create({
        email: 'other@example.com',
        username: 'other',
        password: 'password123'
      });

      const jwt = require('jsonwebtoken');
      const otherToken = jwt.sign({ userId: otherUser._id }, process.env.JWT_SECRET);

      const response = await request(app)
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          content: 'Hello!',
          type: 'text'
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Чат не найден');
    });
  });

  describe('GET /api/v1/chats/:chatId/messages', () => {
    let chatId;

    beforeEach(async () => {
      const chat = await Chat.create({
        type: 'direct',
        participants: [{ user: user1._id }, { user: user2._id }],
        createdBy: user1._id
      });
      chatId = chat._id;

      await Message.create([
        {
          chat: chatId,
          sender: user1._id,
          content: 'Message 1',
          type: 'text'
        },
        {
          chat: chatId,
          sender: user2._id,
          content: 'Message 2',
          type: 'text'
        }
      ]);
    });

    it('should get chat messages', async () => {
      const response = await request(app)
        .get(`/api/v1/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[1].content).toBe('Message 1');
      expect(response.body[0].content).toBe('Message 2');
    });
  });
});

# TODO List for OXXYEN SOCIAL Project

## 1. Project Structure Setup
- [ ] Create oxxyen-social/ directory and subdirectories (backend/, frontend/, uploads/, etc.)
- [ ] Initialize backend package.json with dependencies (express, mongoose, bcrypt, jsonwebtoken, socket.io, multer, etc.)
- [ ] Initialize frontend package.json with dependencies (react, vite, tailwindcss, zustand, etc.)
- [ ] Create .env.example, .gitignore, LICENSE (MIT), README.md templates

## 2. Backend Setup
- [ ] Create backend/server.js with Express app setup, middleware, routes, Socket.IO
- [ ] Create models: User.js, Message.js, Post.js, Group.js
- [ ] Create routes: auth.js, users.js, chats.js, posts.js
- [ ] Create controllers: authController.js, userController.js, chatController.js, postController.js
- [ ] Create middleware: auth.js, upload.js, security.js (validation, sanitization)
- [ ] Create utils: logger.js, encryption.js, virusScan.js, totp.js

## 3. Authentication Implementation
- [ ] Registration: email/password with bcrypt, unique username
- [ ] Login: JWT token generation, HTTP-only cookies
- [ ] Password recovery: email link with one-time token
- [ ] 2FA: TOTP setup and verification
- [ ] Session management: token refresh, logout

## 4. User Profiles
- [ ] Profile CRUD: update username, description, status
- [ ] Avatar upload: resize, compress, encrypt on client, store securely
- [ ] Profile visibility: public/private settings
- [ ] Account deletion: full data wipe from DB

## 5. Chats Implementation
- [ ] 1:1 chats: create, send messages (text, emoji, images)
- [ ] Group chats: create groups, add/remove members (up to 500)
- [ ] Real-time messaging: Socket.IO integration
- [ ] Message history: pagination, indexing by time
- [ ] Message status: delivered, read
- [ ] File attachments: upload, virus scan (ClamAV-like), block binaries
- [ ] Message deletion: for all participants, 48h timer

## 6. Posts Feed
- [ ] Post creation: text, photo, video (up to 30s)
- [ ] Interactions: likes, comments, reposts
- [ ] Feed algorithm: chronological
- [ ] Subscriptions: follow/unfollow with confirmation
- [ ] Friends: mutual subscriptions

## 7. Security Features
- [ ] HTTPS setup: self-signed cert for ngrok
- [ ] Client-side encryption: AES-256-GCM for files
- [ ] Input validation: XSS, CSRF, SQLi, SSRF protection
- [ ] Logging: access logs to audit.log for admin
- [ ] Data leak check: scan DB for exposed emails/phones
- [ ] File security: random UUID names, no original names

## 8. Frontend Setup
- [ ] React app structure: App.jsx, components/, pages/, context/
- [ ] UI components: Login, Register, Profile, Chat, Feed, etc.
- [ ] State management: Zustand stores for auth, chats, posts
- [ ] Theming: dark/light mode toggle
- [ ] Real-time updates: Socket.IO client integration
- [ ] File handling: encryption before upload

## 9. Database Setup
- [ ] MongoDB connection: local or Atlas
- [ ] Indexes: on username, email, createdAt, etc.
- [ ] Replication: basic setup for resilience
- [ ] Data models: proper schemas with validation

## 10. Deployment and Scripts
- [ ] start.sh: run MongoDB, backend, frontend, ngrok
- [ ] Dockerfile: optional containerization
- [ ] ngrok integration: expose port 3000 publicly

## 11. Testing
- [ ] Unit tests: 3 tests for registration, avatar upload, message sending
- [ ] Test account: test@oxxyen.social / password123

## 12. Documentation and Finalization
- [ ] README.md: installation, running, usage instructions in Russian
- [ ] .env.example: environment variables
- [ ] Final checks: security, performance, error handling
- [ ] License and favicon setup

import express from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshSession,
  getUserProfile,
  verifyEmail,
  updateProfile,
  switchWorkspace,
  getUserActivity
} from '../Controller/User.Controller.js';
import { authenticateUser } from '../Middlewares/User.Middleware.js';
import { globalRateLimiter, validateFields } from '../Middlewares/Common.Middleware.js';

const UserRouter = express.Router();

// Schema fields objects to trigger dynamic Zod schema partial picking
const registerSchema = {
  _schema: 'User',
  username: '',
  email: '',
  password: ''
};

const loginSchema = {
  _schema: 'User',
  email: '',
  password: ''
};

const updateProfileSchema = {
  _schema: 'User',
  username: '',
  avatarUrl: ''
};

const switchWorkspaceSchema = {
  _schema: 'User',
  workspaceId: ''
};

// Authentication routes
UserRouter.post('/auth/register', globalRateLimiter, validateFields(registerSchema), registerUser);
UserRouter.post('/auth/login', globalRateLimiter, validateFields(loginSchema), loginUser);
UserRouter.post('/auth/logout', authenticateUser, logoutUser);
UserRouter.post('/auth/refresh', refreshSession);
UserRouter.get('/auth/me', authenticateUser, getUserProfile);
UserRouter.post('/auth/verify-email', globalRateLimiter, authenticateUser, verifyEmail);

// User profile & activity routes
UserRouter.patch('/users/profile', globalRateLimiter, authenticateUser, validateFields(updateProfileSchema), updateProfile);
UserRouter.patch('/users/workspace', authenticateUser, validateFields(switchWorkspaceSchema), switchWorkspace);
UserRouter.get('/users/activity', authenticateUser, getUserActivity);

export default UserRouter;

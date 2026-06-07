import bcrypt from 'bcryptjs';
import User from '../Schema/User.Schema.js';
import Workspace from '../Schema/Workspace.Schema.js';
import Subscription from '../Schema/Subscription.Schema.js';
import ActivityLog from '../Schema/ActivityLog.Schema.js';
import asyncHandler from '../Utils/AsyncHandler.Util.js';
import ApiError from '../Utils/ApiError.Util.js';
import SuccessResponse from '../Utils/SuccessResponse.Util.js';
import { generateAccessToken, generateRefreshToken } from '../Utils/Token.Util.js';
import { getAccessTokenCookieOptions, getRefreshTokenCookieOptions } from '../Utils/Cookie.Util.js';

// 1. REGISTER USER
export const registerUser = asyncHandler(async (req, res, next) => {
  const { username, email, password } = req.body;

  // Check if email or username is already registered
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw new ApiError(400, 'User with this email or username already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Initialize new User document
  const user = new User({
    username,
    email,
    password: hashedPassword
  });

  // Create a default Workspace for this user
  const defaultWorkspace = new Workspace({
    name: 'My Workspace',
    ownerId: user._id,
    projectCount: 0
  });

  // Attach workspace references to user
  user.workspaces.push(defaultWorkspace._id);
  user.currentWorkspace = defaultWorkspace._id;

  // Create active default Subscription profile
  const subscription = new Subscription({
    userId: user._id,
    plan: 'free',
    status: 'active'
  });

  // Log user activity
  const log = new ActivityLog({
    userId: user._id,
    action: 'USER_LOGIN',
    details: 'Account created successfully with default workspace',
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  // Save all documents
  await defaultWorkspace.save();
  await subscription.save();
  await log.save();
  await user.save();

  // Generate session tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Set cookies
  res.cookie('token', accessToken, getAccessTokenCookieOptions());
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());

  // Exclude password from return payload
  user.password = undefined;

  return res.status(201).json(
    new SuccessResponse(201, { user }, 'User registered successfully')
  );
});

// 2. LOGIN USER
export const loginUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Fetch user and explicitly select password
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Verify password matches
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Generate session tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Log active login session
  await ActivityLog.create({
    userId: user._id,
    action: 'USER_LOGIN',
    details: 'Logged in successfully',
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  // Set cookies
  res.cookie('token', accessToken, getAccessTokenCookieOptions());
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());

  user.password = undefined;

  return res.status(200).json(
    new SuccessResponse(200, { user }, 'Logged in successfully')
  );
});

// 3. LOGOUT USER
export const logoutUser = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Log session termination
  await ActivityLog.create({
    userId,
    action: 'USER_LOGOUT',
    details: 'Logged out successfully',
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  // Clear HTTP cookies
  res.clearCookie('token', getAccessTokenCookieOptions());
  res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

  return res.status(200).json(
    new SuccessResponse(200, null, 'Logged out successfully')
  );
});

// 4. FETCH CURRENT USER PROFILE
export const getUserProfile = asyncHandler(async (req, res, next) => {
  const user = req.user;
  return res.status(200).json(
    new SuccessResponse(200, user, 'User profile fetched successfully')
  );
});

// 5. VERIFY EMAIL
export const verifyEmail = asyncHandler(async (req, res, next) => {
  const user = req.user;
  user.isVerified = true;
  await user.save();

  await ActivityLog.create({
    userId: user._id,
    action: 'USER_LOGIN',
    details: 'Email verified successfully',
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  return res.status(200).json(
    new SuccessResponse(200, user, 'Email verified successfully')
  );
});

// 6. UPDATE PROFILE Parameters
export const updateProfile = asyncHandler(async (req, res, next) => {
  const { username, avatarUrl } = req.body;
  const user = req.user;

  if (username) user.username = username;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  await user.save();

  await ActivityLog.create({
    userId: user._id,
    action: 'USER_LOGIN',
    details: 'Updated profile details',
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  return res.status(200).json(
    new SuccessResponse(200, user, 'Profile updated successfully')
  );
});

// 7. SWITCH ACTIVE WORKSPACE
export const switchWorkspace = asyncHandler(async (req, res, next) => {
  const { workspaceId } = req.body;
  const user = req.user;

  // Confirm user has access to target workspace
  if (!user.workspaces.includes(workspaceId)) {
    throw new ApiError(403, 'You do not have access to this workspace');
  }

  user.currentWorkspace = workspaceId;
  await user.save();

  await ActivityLog.create({
    userId: user._id,
    action: 'USER_LOGIN',
    details: `Switched active workspace to ${workspaceId}`,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  return res.status(200).json(
    new SuccessResponse(200, user, 'Workspace switched successfully')
  );
});

// 8. PULL USER ACTIVITY LOGS
export const getUserActivity = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const logs = await ActivityLog.find({ userId }).sort({ createdAt: -1 });

  return res.status(200).json(
    new SuccessResponse(200, logs, 'User activity logs fetched successfully')
  );
});

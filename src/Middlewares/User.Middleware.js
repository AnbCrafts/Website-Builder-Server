import jwt from 'jsonwebtoken';
import User from '../Schema/User.Schema.js';

// Helper to manually parse cookies from raw Header strings (in case Express cookie-parser is not active)
const parseCookies = (cookieHeader) => {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift().trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
};

// 1. Authentication: Decodes cookie token and attaches user
export const authenticateUser = async (req, res, next) => {
  try {
    const token = (req.cookies && req.cookies.token) || parseCookies(req.headers.cookie).token;
    
    if (!token) {
      return res.status(401).json({ error: 'Access Denied', message: 'Authentication token is missing' });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'access_token_secret_key');
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'Access Denied', message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Access Denied', message: 'Invalid or expired token' });
  }
};

// 2. Verification: Checks user verification flag
export const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Access Denied', message: 'User authentication required' });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({ error: 'Access Denied', message: 'Your account is not verified' });
  }

  next();
};

// 3. Authorization: Checks specific roles list
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access Denied', message: 'User authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access Denied', message: 'You do not have permission to perform this action' });
    }

    next();
  };
};

// 4. Permissions: Checks ownership permissions or admin level
export const verifyUserPermission = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Access Denied', message: 'User authentication required' });
  }

  const targetUserId = req.params.userId || req.body.userId;
  const isOwner = req.user._id === targetUserId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Access Denied', message: 'Unauthorized permission level' });
  }

  next();
};

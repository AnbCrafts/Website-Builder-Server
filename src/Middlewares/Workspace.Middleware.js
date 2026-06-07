import Workspace from '../Schema/Workspace.Schema.js';
import Subscription from '../Schema/Subscription.Schema.js';

// 1. Access: Restricts to owner or collaborators with allowed roles
export const verifyWorkspaceAccess = (allowedRoles = ['admin', 'editor', 'viewer']) => {
  return async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId || req.params.slugOrId || req.body.workspaceId || req.query.workspaceId;
      if (!workspaceId) {
        return res.status(400).json({ error: 'Access Control', message: 'Workspace ID or slug is required' });
      }

      // Resolve by Mongoose ID or slug string
      let workspace;
      if (workspaceId.startsWith('wsp_')) {
        workspace = await Workspace.findById(workspaceId);
      } else {
        workspace = await Workspace.findOne({ slug: workspaceId });
      }

      if (!workspace) {
        return res.status(404).json({ error: 'Access Control', message: 'Workspace not found' });
      }

      const userId = req.user._id;
      const isOwner = workspace.ownerId === userId;
      
      const hasRole = workspace.collaborators.some(
        (collab) => collab.userId === userId && allowedRoles.includes(collab.role)
      );

      if (!isOwner && !hasRole) {
        return res.status(403).json({ error: 'Access Denied', message: 'You do not have access to this workspace' });
      }

      req.workspace = workspace;
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Access Control Error', message: error.message });
    }
  };
};

// 2. Billing: Limits workspace creation based on subscription tier
export const checkWorkspaceLimit = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Billing Control', message: 'User authentication required' });
    }

    const subscription = await Subscription.findOne({ userId: user._id });
    const plan = subscription?.plan || 'free';

    const workspaceCount = await Workspace.countDocuments({ ownerId: user._id, status: 'active' });
    
    const limits = {
      free: 1,
      basic: 5,
      premium: 20,
      agency: 100
    };

    if (workspaceCount >= limits[plan]) {
      return res.status(403).json({
        error: 'Subscription Limit Reached',
        message: `Your current plan (${plan}) allows a maximum of ${limits[plan]} active workspaces. Please upgrade to create more.`
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Billing Verification Error', message: error.message });
  }
};

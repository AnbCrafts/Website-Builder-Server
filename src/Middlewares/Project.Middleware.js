import Project from '../Schema/Project.Schema.js';
import Workspace from '../Schema/Workspace.Schema.js';
import Subscription from '../Schema/Subscription.Schema.js';

// 1. Access: Restricts to owner or collaborators with allowed roles
export const verifyProjectAccess = (allowedRoles = ['admin', 'editor', 'viewer']) => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.body.projectId || req.query.projectId;
      if (!projectId) {
        return res.status(400).json({ error: 'Access Control', message: 'Project ID is required' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Access Control', message: 'Project not found' });
      }

      const userId = req.user._id;
      const isOwner = project.ownerId === userId;

      if (!isOwner) {
        const workspace = await Workspace.findById(project.workspaceId);
        const hasRole = workspace && workspace.collaborators.some(
          (collab) => collab.userId === userId && allowedRoles.includes(collab.role)
        );

        if (!hasRole) {
          return res.status(403).json({ error: 'Access Denied', message: 'You do not have access to this project' });
        }
      }

      req.project = project;
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Access Control Error', message: error.message });
    }
  };
};

// 2. Billing: Limits project generation based on subscription tier
export const checkProjectLimit = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Billing Control', message: 'User authentication required' });
    }

    const subscription = await Subscription.findOne({ userId: user._id });
    const plan = subscription?.plan || 'free';

    const projectCount = await Project.countDocuments({ ownerId: user._id });

    const limits = {
      free: 3,
      basic: 15,
      premium: 100,
      agency: 1000
    };

    if (projectCount >= limits[plan]) {
      return res.status(403).json({
        error: 'Subscription Limit Reached',
        message: `Your current plan (${plan}) allows a maximum of ${limits[plan]} projects. Please upgrade to generate more.`
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Billing Verification Error', message: error.message });
  }
};

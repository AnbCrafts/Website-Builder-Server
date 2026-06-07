import Workspace from '../Schema/Workspace.Schema.js';
import Project from '../Schema/Project.Schema.js';
import Subscription from '../Schema/Subscription.Schema.js';

const PLAN_HIERARCHY = {
  free: 0,
  basic: 1,
  premium: 2,
  agency: 3
};

// Middleware: Checks plan level access gates or specific limit counts
export const checkSubscriptionTier = (actionOrPlan) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Billing Control', message: 'User authentication required' });
      }

      const subscription = await Subscription.findOne({ userId: user._id });
      const plan = subscription?.plan || 'free';

      // 1. If checking a plan gate (e.g., 'basic' blocks 'free')
      if (PLAN_HIERARCHY[actionOrPlan] !== undefined) {
        if (PLAN_HIERARCHY[plan] < PLAN_HIERARCHY[actionOrPlan]) {
          return res.status(403).json({
            error: 'Plan Upgrade Required',
            message: `This action requires a minimum subscription of '${actionOrPlan}'. Your current tier is '${plan}'.`
          });
        }
        return next();
      }

      // 2. If checking action limits
      if (actionOrPlan === 'create_workspace') {
        const workspaceCount = await Workspace.countDocuments({ ownerId: user._id, status: 'active' });
        const limits = { free: 1, basic: 5, premium: 20, agency: 100 };

        if (workspaceCount >= limits[plan]) {
          return res.status(403).json({
            error: 'Subscription Limit Reached',
            message: `Your current plan (${plan}) allows a maximum of ${limits[plan]} active workspaces. Please upgrade to create more.`
          });
        }
      }

      if (actionOrPlan === 'create_project') {
        const projectCount = await Project.countDocuments({ ownerId: user._id });
        const limits = { free: 3, basic: 15, premium: 100, agency: 1000 };

        if (projectCount >= limits[plan]) {
          return res.status(403).json({
            error: 'Subscription Limit Reached',
            message: `Your current plan (${plan}) allows a maximum of ${limits[plan]} projects. Please upgrade to generate more.`
          });
        }
      }

      next();
    } catch (error) {
      return res.status(500).json({ error: 'Billing Verification Error', message: error.message });
    }
  };
};

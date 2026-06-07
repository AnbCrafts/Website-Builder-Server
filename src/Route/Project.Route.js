import express from 'express';
import {
  createProject,
  generateProject,
  getWorkspaceProjects,
  getProject,
  updateProject,
  auditProject,
  rollbackProject,
  deleteProject
} from '../Controller/Project.Controller.js';
import { authenticateUser } from '../Middlewares/User.Middleware.js';
import { verifyWorkspaceAccess } from '../Middlewares/Workspace.Middleware.js';
import { verifyProjectAccess } from '../Middlewares/Project.Middleware.js';
import { checkSubscriptionTier } from '../Middlewares/Subscription.Middleware.js';
import { aiGenerationRateLimiter, validateFields } from '../Middlewares/Common.Middleware.js';

const ProjectRouter = express.Router();

// Validation configuration schemas
const createProjectSchema = {
  _schema: 'Project',
  title: '',
  workspaceId: '',
  description: ''
};

const generatePromptSchema = {
  _schema: 'Project',
  prompt: ''
};

const updateCodeSchema = {
  _schema: 'Project',
  currentCode: '',
  theme: '',
  framework: ''
};

const rollbackSchema = {
  _schema: 'Project',
  version: 0
};

// Project Endpoint Routes
ProjectRouter.post('/projects', authenticateUser, verifyWorkspaceAccess(['admin', 'editor']), validateFields(createProjectSchema), createProject);
ProjectRouter.post('/projects/:projectId/generate', authenticateUser, aiGenerationRateLimiter, checkSubscriptionTier('free'), verifyProjectAccess(['admin', 'editor']), validateFields(generatePromptSchema), generateProject);
ProjectRouter.get('/projects/workspace/:workspaceId', authenticateUser, verifyWorkspaceAccess(['admin', 'editor', 'viewer']), getWorkspaceProjects);
ProjectRouter.get('/projects/:projectId', authenticateUser, verifyProjectAccess(['admin', 'editor', 'viewer']), getProject);
ProjectRouter.put('/projects/:projectId', authenticateUser, verifyProjectAccess(['admin', 'editor']), validateFields(updateCodeSchema), updateProject);
ProjectRouter.post('/projects/:projectId/audit', authenticateUser, checkSubscriptionTier('basic'), verifyProjectAccess(['admin', 'editor']), auditProject);
ProjectRouter.post('/projects/:projectId/rollback', authenticateUser, verifyProjectAccess(['admin', 'editor']), validateFields(rollbackSchema), rollbackProject);
ProjectRouter.delete('/projects/:projectId', authenticateUser, verifyProjectAccess(['admin']), deleteProject);

export default ProjectRouter;

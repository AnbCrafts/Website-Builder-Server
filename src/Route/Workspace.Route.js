import express from 'express';
import {
  createWorkspace,
  getWorkspaces,
  getWorkspaceBySlugOrId,
  updateWorkspace,
  addCollaborator,
  removeCollaborator,
  deleteWorkspace
} from '../Controller/Workspace.Controller.js';
import { authenticateUser } from '../Middlewares/User.Middleware.js';
import { verifyWorkspaceAccess } from '../Middlewares/Workspace.Middleware.js';
import { validateFields } from '../Middlewares/Common.Middleware.js';

const WorkspaceRouter = express.Router();

// Validation configuration schemas
const createWorkspaceSchema = {
  _schema: 'Workspace',
  name: '',
  description: ''
};

const updateWorkspaceSchema = {
  _schema: 'Workspace',
  name: '',
  description: '',
  settings: {
    defaultTheme: '',
    customDomain: '',
    isPublic: false
  }
};

const addCollaboratorSchema = {
  _schema: 'Workspace',
  email: '',
  role: ''
};

// Workspace Endpoint Routes
WorkspaceRouter.post('/workspaces', authenticateUser, validateFields(createWorkspaceSchema), createWorkspace);
WorkspaceRouter.get('/workspaces', authenticateUser, getWorkspaces);
WorkspaceRouter.get('/workspaces/:slugOrId', authenticateUser, verifyWorkspaceAccess(['admin', 'editor', 'viewer']), getWorkspaceBySlugOrId);
WorkspaceRouter.patch('/workspaces/:workspaceId', authenticateUser, verifyWorkspaceAccess(['admin']), validateFields(updateWorkspaceSchema), updateWorkspace);
WorkspaceRouter.post('/workspaces/:workspaceId/collaborators', authenticateUser, verifyWorkspaceAccess(['admin']), validateFields(addCollaboratorSchema), addCollaborator);
WorkspaceRouter.delete('/workspaces/:workspaceId/collaborators/:userId', authenticateUser, verifyWorkspaceAccess(['admin']), removeCollaborator);
WorkspaceRouter.delete('/workspaces/:workspaceId', authenticateUser, verifyWorkspaceAccess(['admin']), deleteWorkspace);

export default WorkspaceRouter;

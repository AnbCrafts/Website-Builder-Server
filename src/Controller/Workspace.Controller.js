import Workspace from '../Schema/Workspace.Schema.js';
import User from '../Schema/User.Schema.js';
import Project from '../Schema/Project.Schema.js';
import ActivityLog from '../Schema/ActivityLog.Schema.js';
import asyncHandler from '../Utils/AsyncHandler.Util.js';
import ApiError from '../Utils/ApiError.Util.js';
import SuccessResponse from '../Utils/SuccessResponse.Util.js';

// 1. CREATE WORKSPACE
export const createWorkspace = asyncHandler(async (req, res, next) => {
  const { name, description } = req.body;
  const ownerId = req.user._id;

  const workspace = new Workspace({
    name,
    description: description || '',
    ownerId,
    projects: [],
    projectCount: 0
  });

  // Sync workspace back to user document
  const user = req.user;
  user.workspaces.push(workspace._id);
  user.currentWorkspace = workspace._id;

  await workspace.save();
  await user.save();

  await ActivityLog.create({
    userId: ownerId,
    action: 'WORKSPACE_CREATE',
    details: `Created new workspace: ${name} (${workspace._id})`,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  return res.status(201).json(
    new SuccessResponse(201, workspace, 'Workspace created successfully')
  );
});

// 2. FETCH WORKSPACES LIST (OWNED & COLLABORATED)
export const getWorkspaces = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  // Retrieve workspaces where owner or collaborator matches user ID
  const workspaces = await Workspace.find({
    status: 'active',
    $or: [{ ownerId: userId }, { 'collaborators.userId': userId }]
  }).sort({ updatedAt: -1 });

  return res.status(200).json(
    new SuccessResponse(200, workspaces, 'Workspaces list fetched successfully')
  );
});

// 3. RESOLVE WORKSPACE BY SLUG OR ID
export const getWorkspaceBySlugOrId = asyncHandler(async (req, res, next) => {
  const workspace = req.workspace; // Pre-loaded by verifyWorkspaceAccess
  return res.status(200).json(
    new SuccessResponse(200, workspace, 'Workspace resolved successfully')
  );
});

// 4. UPDATE WORKSPACE METADATA & CONFIGURATIONS
export const updateWorkspace = asyncHandler(async (req, res, next) => {
  const { name, description, settings } = req.body;
  const workspace = req.workspace;

  if (name) workspace.name = name;
  if (description !== undefined) workspace.description = description;
  if (settings) {
    if (settings.defaultTheme) workspace.settings.defaultTheme = settings.defaultTheme;
    if (settings.customDomain !== undefined) workspace.settings.customDomain = settings.customDomain;
    if (settings.isPublic !== undefined) workspace.settings.isPublic = settings.isPublic;
  }

  await workspace.save();

  return res.status(200).json(
    new SuccessResponse(200, workspace, 'Workspace configurations updated successfully')
  );
});

// 5. ADD COLLABORATOR (TEAM ONBOARDING)
export const addCollaborator = asyncHandler(async (req, res, next) => {
  const { email, role } = req.body;
  const workspace = req.workspace;

  // Find user by email
  const collaboratorUser = await User.findOne({ email });
  if (!collaboratorUser) {
    throw new ApiError(404, 'Collaborator account email not found');
  }

  // Check if owner
  if (workspace.ownerId === collaboratorUser._id) {
    throw new ApiError(400, 'User is the owner of this workspace');
  }

  // Check if already collaborator
  const alreadyCollaborator = workspace.collaborators.some(
    c => c.userId === collaboratorUser._id
  );
  if (alreadyCollaborator) {
    throw new ApiError(400, 'User is already a collaborator in this workspace');
  }

  workspace.collaborators.push({
    userId: collaboratorUser._id,
    role: role || 'viewer'
  });

  collaboratorUser.workspaces.push(workspace._id);

  await workspace.save();
  await collaboratorUser.save();

  await ActivityLog.create({
    userId: req.user._id,
    action: 'WORKSPACE_CREATE',
    details: `Added collaborator ${collaboratorUser._id} with role ${role || 'viewer'} to workspace ${workspace._id}`,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  return res.status(200).json(
    new SuccessResponse(200, workspace, 'Collaborator added successfully')
  );
});

// 6. REMOVE COLLABORATOR (ACCESS REVOCATION)
export const removeCollaborator = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const workspace = req.workspace;

  // Remove collaborator
  workspace.collaborators = workspace.collaborators.filter(c => c.userId !== userId);

  // Sync workspace removal from collaborator user document
  const collaboratorUser = await User.findById(userId);
  if (collaboratorUser) {
    collaboratorUser.workspaces = collaboratorUser.workspaces.filter(id => id !== workspace._id);
    if (collaboratorUser.currentWorkspace === workspace._id) {
      collaboratorUser.currentWorkspace = collaboratorUser.workspaces[0] || null;
    }
    await collaboratorUser.save();
  }

  await workspace.save();

  await ActivityLog.create({
    userId: req.user._id,
    action: 'WORKSPACE_DELETE',
    details: `Revoked collaborator ${userId} access from workspace ${workspace._id}`,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  return res.status(200).json(
    new SuccessResponse(200, workspace, 'Collaborator removed successfully')
  );
});

// 7. CASCADE DELETE WORKSPACE
export const deleteWorkspace = asyncHandler(async (req, res, next) => {
  const workspace = req.workspace;

  workspace.status = 'deleted';
  workspace.deletedAt = new Date();

  // Cascade status failure to projects
  await Project.updateMany(
    { workspaceId: workspace._id },
    { status: 'failed' }
  );

  // Remove workspace ID from owners list
  const owner = await User.findById(workspace.ownerId);
  if (owner) {
    owner.workspaces = owner.workspaces.filter(id => id !== workspace._id);
    if (owner.currentWorkspace === workspace._id) {
      owner.currentWorkspace = owner.workspaces[0] || null;
    }
    await owner.save();
  }

  // Clean collaborators lists
  for (const collab of workspace.collaborators) {
    const collaboratorUser = await User.findById(collab.userId);
    if (collaboratorUser) {
      collaboratorUser.workspaces = collaboratorUser.workspaces.filter(id => id !== workspace._id);
      if (collaboratorUser.currentWorkspace === workspace._id) {
        collaboratorUser.currentWorkspace = collaboratorUser.workspaces[0] || null;
      }
      await collaboratorUser.save();
    }
  }

  await workspace.save();

  await ActivityLog.create({
    userId: req.user._id,
    action: 'WORKSPACE_DELETE',
    details: `Soft-deleted workspace: ${workspace.name} (${workspace._id}) and cascaded projects`,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  return res.status(200).json(
    new SuccessResponse(200, null, 'Workspace soft-deleted successfully')
  );
});

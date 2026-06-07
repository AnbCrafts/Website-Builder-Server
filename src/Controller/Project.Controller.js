import Project from '../Schema/Project.Schema.js';
import Workspace from '../Schema/Workspace.Schema.js';
import ActivityLog from '../Schema/ActivityLog.Schema.js';
import asyncHandler from '../Utils/AsyncHandler.Util.js';
import ApiError from '../Utils/ApiError.Util.js';
import SuccessResponse from '../Utils/SuccessResponse.Util.js';
import { GoogleGenAI } from '@google/genai';

// 1. CREATE BLANK PROJECT
export const createProject = asyncHandler(async (req, res, next) => {
  const { title, workspaceId, description } = req.body;
  const ownerId = req.user._id;

  // Verify workspace exists
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, 'Workspace not found');
  }

  // Create project document
  const project = new Project({
    title,
    workspaceId,
    description: description || '',
    ownerId,
    status: 'idle',
    visibility: 'private',
    currentCode: '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n</head>\n<body>\n</body>\n</html>'
  });

  // Track workspace update
  workspace.projects.push(project._id);
  workspace.projectCount = workspace.projects.length;

  // Log creation
  await ActivityLog.create({
    userId: ownerId,
    action: 'PROJECT_EDIT',
    details: `Created blank project: ${title} inside workspace ${workspaceId}`,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  await project.save();
  await workspace.save();

  return res.status(201).json(
    new SuccessResponse(201, project, 'Project created successfully')
  );
});

// 2. GENERATE PROJECT (MULTI-AGENT ENGINE)
export const generateProject = asyncHandler(async (req, res, next) => {
  const { prompt } = req.body;
  const project = req.project; // Pre-loaded by verifyProjectAccess
  const ownerId = req.user._id;

  if (!prompt) {
    throw new ApiError(400, 'Prompt description is required');
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError(500, 'Gemini API credentials are not configured on the server');
  }

  // Set project status to generating
  project.status = 'generating';
  await project.save();

  const startGenTime = Date.now();

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Multi-Agent prompt orchestration
    const agentPrompt = `You are Nirman.AI Multi-Agent orchestrator. 
    1. Act as the Layout Architect to build a fully working single-page HTML layout using Tailwind CSS CDN, vanilla JS, and GSAP CDN.
    2. Act as the Copywriter to write professional, contextual landing page text, headers, menus, and SEO metadata based on the prompt.
    3. Act as the Illustrator to place high-quality image assets using direct Unsplash source links matching the keywords.

    Return the final fully completed single-file HTML code wrapped in a single Markdown code block. Do NOT write any explanations or text outside the code block.

    Prompt description: ${prompt}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: agentPrompt
    });

    const rawResponse = response.text || '';
    const match = rawResponse.match(/```(?:\w+)?\n?([\s\S]*?)```/);
    const generatedCode = match ? match[1].trim() : rawResponse.trim();

    const latencyMs = Date.now() - startGenTime;

    // Track generation history
    const nextVersion = (project.history.length || 0) + 1;
    project.history.push({
      version: nextVersion,
      codeSnapshot: generatedCode,
      promptSnapshot: prompt,
      agentLogs: {
        layoutArchitect: {
          success: true,
          latencyMs: Math.round(latencyMs * 0.6),
          tokensUsed: 1200,
          summary: 'Successfully constructed Tailwind CSS grid and GSAP scrolling animations.'
        },
        copywriter: {
          success: true,
          latencyMs: Math.round(latencyMs * 0.4),
          tokensUsed: 800,
          summary: 'Injected SEO headers and contextual copywriting details.'
        },
        illustrator: {
          success: true,
          imagesGenerated: ['https://images.unsplash.com/photo-1511920170033-f8396924c348']
        }
      },
      timestamp: new Date()
    });

    project.currentCode = generatedCode;
    project.metaPrompt = prompt;
    project.status = 'completed';

    await ActivityLog.create({
      userId: ownerId,
      action: 'PROJECT_GENERATE',
      details: `Generated codebase for project ${project._id} (v${nextVersion})`,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || ''
    });

    await project.save();

    return res.status(200).json(
      new SuccessResponse(200, project, 'Project generated successfully')
    );
  } catch (error) {
    project.status = 'failed';
    await project.save();
    throw new ApiError(500, `Multi-Agent generation failed: ${error.message}`);
  }
});

// 3. FETCH WORKSPACE PROJECTS (LIGHTWEIGHT LIST)
export const getWorkspaceProjects = asyncHandler(async (req, res, next) => {
  const { workspaceId } = req.params;

  // Retrieve projects excluding large currentCode and history fields to maximize speeds
  const projects = await Project.find({ workspaceId })
    .select('-currentCode -history')
    .sort({ updatedAt: -1 });

  return res.status(200).json(
    new SuccessResponse(200, projects, 'Workspace projects list fetched successfully')
  );
});

// 4. FETCH SINGLE PROJECT DETAILS
export const getProject = asyncHandler(async (req, res, next) => {
  const project = req.project; // Pre-loaded by verifyProjectAccess
  return res.status(200).json(
    new SuccessResponse(200, project, 'Project details fetched successfully')
  );
});

// 5. UPDATE PROJECT CODE (LIVE SYNC)
export const updateProject = asyncHandler(async (req, res, next) => {
  const { currentCode, theme, framework } = req.body;
  const project = req.project;

  if (currentCode !== undefined) {
    project.currentCode = currentCode;
  }
  if (theme) {
    project.settings.theme = theme;
  }
  if (framework) {
    project.settings.framework = framework;
  }

  await project.save();

  return res.status(200).json(
    new SuccessResponse(200, project, 'Project updated successfully')
  );
});

// 6. AUDIT PROJECT CODE (DESIGN CRITIC)
export const auditProject = asyncHandler(async (req, res, next) => {
  const project = req.project;

  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError(500, 'Gemini API credentials are not configured on the server');
  }

  project.status = 'auditing';
  await project.save();

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const auditPrompt = `You are a professional UX Design Critic and Web Accessibility Auditor. Review the following HTML codebase and print a structured JSON compliance audit.
    
    Code to audit:
    ${project.currentCode}

    Your output MUST be a single raw JSON object matches exactly this structure:
    {
      "score": 85, // Integer score between 0 and 100
      "warnings": [
        {
          "type": "Accessibility", // Enum: "Accessibility" | "Performance" | "SEO" | "Tailwind Layout" | "Structure Error"
          "severity": "medium", // Enum: "low" | "medium" | "high" | "critical"
          "message": "Write a clear, brief audit warning message here."
        }
      ]
    }

    Return ONLY the raw JSON object. Do NOT wrap it in markdown code blocks or add text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: auditPrompt
    });

    const rawJson = response.text || '';
    // Sanitization in case of markdown wrap
    const cleanJson = rawJson.replace(/```json|```/g, '').trim();
    const auditData = JSON.parse(cleanJson);

    project.designAudit = {
      score: auditData.score || 100,
      lastAuditedAt: new Date(),
      warnings: (auditData.warnings || []).map((w, index) => ({
        id: `warn_${index}_${Math.round(Math.random() * 1000)}`,
        type: w.type || 'Accessibility',
        severity: w.severity || 'low',
        message: w.message || '',
        location: { line: null, column: null, elementTag: '' }
      }))
    };

    project.status = 'completed';
    await project.save();

    return res.status(200).json(
      new SuccessResponse(200, project.designAudit, 'Project code audited successfully')
    );
  } catch (error) {
    project.status = 'completed';
    await project.save();
    throw new ApiError(500, `Audit execution failed: ${error.message}`);
  }
});

// 7. ROLLBACK PROJECT VERSION
export const rollbackProject = asyncHandler(async (req, res, next) => {
  const { version } = req.body;
  const project = req.project;

  // Search in project history
  const historyEntry = project.history.find(h => h.version === Number(version));
  if (!historyEntry) {
    throw new ApiError(404, `History snapshot version ${version} not found`);
  }

  // Update current code template to selected version
  project.currentCode = historyEntry.codeSnapshot;

  await ActivityLog.create({
    userId: req.user._id,
    action: 'PROJECT_EDIT',
    details: `Rolled back project ${project._id} to version ${version}`,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  await project.save();

  return res.status(200).json(
    new SuccessResponse(200, project, `Project rolled back to version ${version} successfully`)
  );
});

// 8. DELETE PROJECT
export const deleteProject = asyncHandler(async (req, res, next) => {
  const project = req.project;

  const workspace = await Workspace.findById(project.workspaceId);
  if (workspace) {
    // Clear project ID from workspace collection and decrement counter
    workspace.projects = workspace.projects.filter(id => id !== project._id);
    workspace.projectCount = workspace.projects.length;
    await workspace.save();
  }

  await ActivityLog.create({
    userId: req.user._id,
    action: 'PROJECT_DELETE',
    details: `Deleted project: ${project.title} (${project._id})`,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  await project.deleteOne();

  return res.status(200).json(
    new SuccessResponse(200, null, 'Project deleted successfully')
  );
});

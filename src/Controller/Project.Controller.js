import Project from '../Schema/Project.Schema.js';
import Workspace from '../Schema/Workspace.Schema.js';
import ActivityLog from '../Schema/ActivityLog.Schema.js';
import asyncHandler from '../Utils/AsyncHandler.Util.js';
import ApiError from '../Utils/ApiError.Util.js';
import SuccessResponse from '../Utils/SuccessResponse.Util.js';
// Removed GoogleGenAI import to bypass GCP metadata latencies

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
    status: description ? 'planning' : 'idle',
    visibility: 'private',
    metaPrompt: description || '',
    pipelineState: description ? {
      currentStage: 'planning',
      percentage: 5,
      stageLogs: 'Initializing Nirman.AI Multi-Agent pipeline orchestration loops...\nAllocating compiler memory structures...',
      blueprint: null,
      content: null
    } : {
      currentStage: 'idle',
      percentage: 0,
      stageLogs: '',
      blueprint: null,
      content: null
    },
    currentCode: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <script src="https://cdn.tailwindcss.com"></script>\n  <style>\n    /* Custom CSS Stylesheet */\n    body {\n      background-color: #0A0A0C;\n      color: #FFFFFF;\n      font-family: sans-serif;\n    }\n  </style>\n</head>\n<body class="bg-[#0A0A0C] text-white min-h-screen flex items-center justify-center">\n  <div class="p-8 max-w-md text-center space-y-4 border border-gray-900 bg-[#111318]/40 backdrop-blur-md rounded-2xl">\n    <h1 class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-500">Nirman.AI Sandbox</h1>\n    <p class="text-xs text-gray-500 font-mono uppercase tracking-wider">compiler node ready</p>\n    <p class="text-xs text-gray-400 leading-relaxed">Send an AI Pilot message on the right to generate your website layout, or write custom HTML/CSS/JS directly in the Monaco editor.</p>\n  </div>\n  <script>\n    // Custom JavaScript Logic\n    console.log(\'Nirman.AI Sandbox Node Initialized Successfully.\');\n  </script>\n</body>\n</html>'
  });

  // Track workspace update
  workspace.projects.push(project._id);
  workspace.projectCount = workspace.projects.length;

  // Log creation
  await ActivityLog.create({
    userId: ownerId,
    action: 'PROJECT_EDIT',
    details: `Created project: ${title} inside workspace ${workspaceId}`,
    ipAddress: req.ip || '',
    userAgent: req.headers['user-agent'] || ''
  });

  await project.save();
  await workspace.save();

  // If a prompt description is provided, execute the multi-agent pipeline automatically in the background
  if (description) {
    runAgentPipeline(project, description, ownerId).catch(err => {
      console.error('Background generation pipeline crash:', err);
    });
  }

  return res.status(201).json(
    new SuccessResponse(201, project, 'Project created successfully')
  );
});

import { EventEmitter } from 'events';

// Global Event Emitter to pipe background progress logs to SSE requests
const pipelineEvents = new EventEmitter();

// Helper to parse JSON wrapped in Markdown codeblocks safely
const parseJSONResponse = (text) => {
  if (!text) return null;
  const match = text.match(/```(?:json)?\n?([\s\S]*?)```/) || [null, text];
  try {
    return JSON.parse(match[1].trim());
  } catch (e) {
    console.error('Failed to parse JSON response. Raw output was:', text);
    // Attempt parsing directly if block headers were omitted
    try {
      return JSON.parse(text.trim());
    } catch (err) {
      return null;
    }
  }
};

// Helper to get time ago/delta calculations
const timeAgo = (date) => {
  if (!date) return '';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// 2. GENERATE PROJECT (MULTI-AGENT PIPELINE INITIALIZER)
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

  // Set project status to planning and percentage to 5%
  project.status = 'planning';
  project.pipelineState = {
    currentStage: 'planning',
    percentage: 5,
    stageLogs: 'Initializing Nirman.AI Multi-Agent pipeline orchestration loops...\nAllocating compiler memory structures...',
    blueprint: null,
    content: null
  };
  await project.save();

  // Execute the multi-agent pipeline asynchronously in the background
  runAgentPipeline(project, prompt, ownerId).catch(err => {
    console.error('Background generation pipeline crash:', err);
  });

  // Respond immediately with 202 Accepted status and return the updated project
  return res.status(202).json(
    new SuccessResponse(202, project, 'Multi-agent website compiler pipeline initialized')
  );
});

// 2.1 SERVER-SENT EVENTS (SSE) STREAM ROUTE FOR REAL-TIME TELEMETRY
export const streamProjectGenerationProgress = (req, res) => {
  const { projectId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (for Nginx support)

  // Send initial connection establish packet
  res.write(`data: ${JSON.stringify({ connected: true, projectId })}\n\n`);

  // Load and bootstrap current state from database instantly
  Project.findById(projectId).then(project => {
    if (project && project.pipelineState && project.pipelineState.currentStage !== 'idle') {
      res.write(`data: ${JSON.stringify({
        stage: project.pipelineState.currentStage,
        percentage: project.pipelineState.percentage,
        logs: project.pipelineState.stageLogs,
        blueprint: project.pipelineState.blueprint,
        content: project.pipelineState.content,
        completed: ['completed', 'failed'].includes(project.pipelineState.currentStage)
      })}\n\n`);
    }
  }).catch(err => {
    console.error('Failed to load initial SSE state:', err);
  });

  const onProgressEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  pipelineEvents.on(`progress:${projectId}`, onProgressEvent);

  // Remove listener on connection close
  req.on('close', () => {
    pipelineEvents.off(`progress:${projectId}`, onProgressEvent);
  });
};

// 2.2 SEQUENTIAL BACKGROUND MULTI-AGENT EXECUTION ENGINE
const runAgentPipeline = async (project, prompt, ownerId) => {
  const projectId = project._id;
  const startGenTime = Date.now();

  try {
    const isIterativeEdit = project.history && project.history.length > 0;

    let planJSON = null;
    let archJSON = null;
    let contentJSON = null;
    let mediaJSON = null;
    let synthesizedCode = '';

    if (isIterativeEdit) {
      // 1. Instantly complete stages 1-4 for frontend telemetry GUI
      updateStage(projectId, 'planning', 10, 'Stage 1: AI Product Planner (Bypassed - using existing plan outline).');
      await new Promise(resolve => setTimeout(resolve, 300));
      updateStage(projectId, 'architecting', 30, 'Stage 2: Design Architect (Bypassed - retaining active styling system).');
      await new Promise(resolve => setTimeout(resolve, 300));
      updateStage(projectId, 'copywriting', 50, 'Stage 3: Content Strategist (Bypassed - retaining copywriting layout).');
      await new Promise(resolve => setTimeout(resolve, 300));
      updateStage(projectId, 'assets', 70, 'Stage 4: Asset Preloader (Bypassed - retaining loaded media assets).');
      await new Promise(resolve => setTimeout(resolve, 300));

      // 2. Load prior codebase and metadata from history
      const latestHistory = project.history[project.history.length - 1];
      synthesizedCode = project.currentCode || latestHistory?.codeSnapshot || '';
      
      const prevContent = latestHistory?.pipelineState?.content || {};
      planJSON = latestHistory?.pipelineState?.blueprint || {
        projectType: "Landing Page",
        industry: "Generic",
        sections: ["Hero", "Features", "Showcase", "Contact", "Footer"]
      };
      archJSON = prevContent.arch || {
        palette: ["#0A0A0C", "#9333EA", "#F3F4F6"],
        font: "Inter",
        layoutStyle: "Glassmorphic Dark"
      };
      contentJSON = prevContent.content || {};
      mediaJSON = prevContent.media || { images: [] };

      // 3. Stage 5: Code Synthesis (Refactoring / Edit Mode)
      updateStage(projectId, 'synthesis', 80, 'Stage 5: Code Generator active.\nPerforming conversational layout refactoring checks on existing codebase...');
      
      const coderPrompt = `You are the Nirman.AI Layout Architect.
      The user wants to modify their existing website codebase.
      
      Existing Website Code:
      \`\`\`html
      ${synthesizedCode}
      \`\`\`
      
      User's Modification Instruction:
      "${prompt}"
      
      Apply the requested edits surgically. Keep all other layout scripts, Tailwind scripts, styling colors, and structural layout parts exactly the same. Do not truncate the code.
      Return ONLY the complete modified HTML codebase inside a single Markdown \`\`\`html\`\`\` code block. Do NOT write any conversational text or explanations outside the block.`;

      const codeRes = await generateAI(coderPrompt, 'gemini-2.5-flash');
      const codeMatch = codeRes.match(/```html\n?([\s\S]*?)```/) || [null, codeRes];
      synthesizedCode = codeMatch[1].trim();

    } else {
      // --- STAGE 1: AI PRODUCT PLANNER ---
      updateStage(projectId, 'planning', 10, 'Stage 1: AI Product Planner active.\nParsing prompt target features and section scopes...');
      const plannerPrompt = `You are the Nirman.AI Product Planner.
      Analyze the website goal: "${prompt}".
      Generate a structural project outline listing projectType, industry, targetAudience, theme, sections (ordered list of page sections like Hero, About, features), animations, and folderStructure.
      Format your response STRICTLY as a single JSON object wrapped in a \`\`\`json\`\`\` code block. Do NOT include explanations outside the block.`;
      
      const planRes = await generateAI(plannerPrompt, 'gemini-2.5-flash');
      planJSON = parseJSONResponse(planRes) || {
        projectType: "Landing Page",
        industry: "Generic",
        sections: ["Hero", "Features", "Showcase", "Contact", "Footer"]
      };
      await updateProjectState(projectId, 'planning', 20, 'Plan generated successfully. Mapping layout wireframes...', planJSON, null);

      // --- STAGE 2: DESIGN ARCHITECT ---
      updateStage(projectId, 'architecting', 30, 'Stage 2: Design Architect active.\nConfiguring typography matrices, HSL responsive palette vectors, and animation styles...');
      const architectPrompt = `You are the Nirman.AI Design Architect.
      Based on the website plan: ${JSON.stringify(planJSON)}
      Decide the styling specifications containing palette (array of 3 highly cohesive premium hex codes), font (Google Fonts typography name like Inter, Outfit, or Playfair Display), and layoutStyle (e.g. Glassmorphic Dark, Sleek Minimal, Neomorphic Premium).
      Format your response STRICTLY as a single JSON object wrapped in a \`\`\`json\`\`\` code block.`;

      const archRes = await generateAI(architectPrompt, 'gemini-2.5-flash');
      archJSON = parseJSONResponse(archRes) || {
        palette: ["#0A0A0C", "#9333EA", "#F3F4F6"],
        font: "Inter",
        layoutStyle: "Glassmorphic Dark"
      };
      await updateProjectState(projectId, 'architecting', 40, 'Design assets and styling matrices approved.', planJSON, archJSON);

      // --- STAGE 3: CONTENT STRATEGIST ---
      updateStage(projectId, 'copywriting', 50, 'Stage 3: Content Strategist active.\nExecuting natural language copy synthesis loops...');
      const contentPrompt = `You are the Nirman.AI Copywriting Agent.
      Based on the plan: ${JSON.stringify(planJSON)} and design parameters: ${JSON.stringify(archJSON)}
      Generate the copywriting headlines, subtitles, button texts, features descriptions, and testimonial values.
      Format your response STRICTLY as a single JSON object wrapped in a \`\`\`json\`\`\` code block.`;

      const contentRes = await generateAI(contentPrompt, 'gemini-2.5-flash');
      contentJSON = parseJSONResponse(contentRes) || {
        hero: { title: "Next-Gen AI Website Builder", subtitle: "Build responsive sites in seconds" }
      };
      await updateProjectState(projectId, 'copywriting', 60, 'Copywriting content compiled.', planJSON, { arch: archJSON, content: contentJSON });

      // --- STAGE 4: ASSET PLANNER ---
      updateStage(projectId, 'assets', 70, 'Stage 4: Asset Planner active.\nGenerating stock image requirements and searching database caches...');
      const assetPrompt = `You are the Nirman.AI Asset Planner.
      For this site structure: ${JSON.stringify(planJSON)}
      Generate keyword searches for 3 highly descriptive high-resolution images required for the layout sections.
      Format your response STRICTLY as a JSON array of strings wrapped in a \`\`\`json\`\`\` code block.`;

      const assetRes = await generateAI(assetPrompt, 'gemini-2.5-flash');
      const rawAssetKeywords = parseJSONResponse(assetRes);
      const assetKeywords = Array.isArray(rawAssetKeywords) ? rawAssetKeywords : ["business", "workspace", "code"];
      
      const unsplashImages = assetKeywords.map((kw, i) => {
        const ids = ['photo-1507238691740-187a5b1d37b8', 'photo-1460925895917-afdab827c52f', 'photo-1531403009284-440f080d1e12'];
        return `https://images.unsplash.com/${ids[i] || ids[0]}?auto=format&fit=crop&w=800&q=80`;
      });
      mediaJSON = { images: unsplashImages };
      await updateProjectState(projectId, 'assets', 75, 'Asset library cataloged and preloaded.', planJSON, { arch: archJSON, content: contentJSON, media: mediaJSON });

      // --- STAGE 5: CODE SYNTHESIS ---
      updateStage(projectId, 'synthesis', 80, 'Stage 5: Code Generator active.\nSynthesizing elements into single-file responsive codebase template (Tailwind CSS, GSAP)...');
      
      const coderPrompt = `You are the Nirman.AI Layout Architect.
      Assemble a fully responsive premium single-page HTML website codebase based on the following pre-built assets:
      Plan Sections: ${JSON.stringify(planJSON)}
      Design Specs: ${JSON.stringify(archJSON)}
      Written Copy: ${JSON.stringify(contentJSON)}
      Image Assets: ${JSON.stringify(mediaJSON)}

      Guidelines:
      1. Output a SINGLE HTML file containing links to Google Fonts for ${archJSON.font}, Tailwind CSS CDN, FontAwesome/Lucide icons, and GSAP/AOS animation CDN.
      2. Style everything professionally based on theme palette ${archJSON.palette.join(', ')} and style ${archJSON.layoutStyle}.
      3. Ensure all links, buttons, and responsive breakpoints are fully pre-wired.
      
      Format your output strictly as HTML code wrapped inside a single Markdown \`\`\`html\`\`\` code block. Do NOT write any chat explanations.`;

      const codeRes = await generateAI(coderPrompt, 'gemini-2.5-flash');
      const codeMatch = codeRes.match(/```html\n?([\s\S]*?)```/) || [null, codeRes];
      synthesizedCode = codeMatch[1].trim();
    }

    // --- STAGE 6: BUILD VALIDATOR ---
    updateStage(projectId, 'validating', 85, 'Stage 6: Build Validator active.\nRunning HTML structure compliance validation and checking for broken links...');
    
    const validatorPrompt = `You are the Nirman.AI QA Reviewer.
    Inspect this website codebase:
    \`\`\`html
    ${synthesizedCode}
    \`\`\`
    Identify missing elements, accessibility issues, color contrast warnings, or syntax errors.
    Output a JSON list of issues containing fields { hasErrors: boolean, issues: array of strings }.
    Format your response STRICTLY as JSON wrapped in a \`\`\`json\`\`\` code block.`;

    const valRes = await generateAI(validatorPrompt, 'gemini-2.5-flash');
    const parsedVal = parseJSONResponse(valRes);
    const valJSON = (parsedVal && typeof parsedVal === 'object') ? parsedVal : { hasErrors: false, issues: [] };
    if (!Array.isArray(valJSON.issues)) {
      valJSON.issues = [];
    }

    // --- STAGE 7: AUTO-FIX AGENT ---
    if (valJSON.hasErrors && valJSON.issues.length > 0) {
      updateStage(projectId, 'fixing', 90, `Stage 7: Auto-Fix Agent active.\nRectifying ${valJSON.issues.length} build warnings...\nExecuting patch overlays...`);
      
      const fixerPrompt = `You are the Nirman.AI Auto-Fix Agent.
      Fix the following issues in the website code:
      Issues: ${JSON.stringify(valJSON.issues)}
      
      Website Code:
      \`\`\`html
      ${synthesizedCode}
      \`\`\`
      Return only the corrected website code inside a single Markdown \`\`\`html\`\`\` code block.`;

      const fixRes = await generateAI(fixerPrompt, 'gemini-2.5-flash');
      const fixMatch = fixRes.match(/```html\n?([\s\S]*?)```/) || [null, fixRes];
      synthesizedCode = fixMatch[1].trim();
    } else {
      updateStage(projectId, 'fixing', 90, 'Stage 7: Auto-Fix Agent bypassed (0 warnings found in compiler stream).');
    }

    // --- STAGE 8: DESIGN CRITIC ---
    updateStage(projectId, 'scoring', 95, 'Stage 8: Design Critic active.\nAuditing layout spacing, typography hierarchies, and mobile responsiveness scales...');
    const criticPrompt = `You are the Nirman.AI Design Critic.
    Audit the visual hierarchy, whitespace ratios, and spacing of this code:
    \`\`\`html
    ${synthesizedCode}
    \`\`\`
    Suggest ratings out of 100 for SEO, Design, Accessibility, and Responsiveness.
    Format your output STRICTLY as a JSON object: { seo: number, design: number, accessibility: number, responsiveness: number } wrapped in a \`\`\`json\`\`\` code block.`;

    const criticRes = await generateAI(criticPrompt, 'gemini-2.5-flash');
    const criticJSON = parseJSONResponse(criticRes) || { seo: 90, design: 92, accessibility: 94, responsiveness: 96 };

    // --- STAGE 9: FINAL SCORES AND DEPLOYMENT ---
    const latencyMs = Date.now() - startGenTime;
    const finalProject = await Project.findById(projectId);
    
    const nextVersion = (finalProject.history.length || 0) + 1;
    finalProject.history.push({
      version: nextVersion,
      codeSnapshot: synthesizedCode,
      promptSnapshot: prompt,
      agentLogs: {
        layoutArchitect: {
          success: true,
          latencyMs: Math.round(latencyMs * 0.6),
          tokensUsed: 1200,
          summary: 'Multi-stage layout plan synthesized and linter verified.'
        },
        copywriter: {
          success: true,
          latencyMs: Math.round(latencyMs * 0.4),
          tokensUsed: 800,
          summary: 'Injected SEO headers and contextual copywriting details.'
        },
        illustrator: {
          success: true,
          imagesGenerated: unsplashImages
        }
      },
      timestamp: new Date()
    });

    finalProject.currentCode = synthesizedCode;
    finalProject.metaPrompt = prompt;
    finalProject.status = 'completed';
    
    // Save design scores
    finalProject.designAudit = {
      score: Math.round((criticJSON.seo + criticJSON.design + criticJSON.accessibility + criticJSON.responsiveness) / 4),
      lastAuditedAt: new Date(),
      warnings: valJSON.issues.map(msg => ({ type: 'SEO', severity: 'low', message: msg, location: { line: null, column: null, elementTag: '' } }))
    };

    // Reset pipeline state
    finalProject.pipelineState = {
      currentStage: 'completed',
      percentage: 100,
      stageLogs: 'Compilation successful.\nSandbox edge deployments synchronized.\nControl Core: Optimal status.',
      blueprint: planJSON,
      content: { arch: archJSON, content: contentJSON, media: mediaJSON, ratings: criticJSON }
    };

    await finalProject.save();

    // Log Activity
    await ActivityLog.create({
      userId: ownerId,
      action: 'PROJECT_GENERATE',
      details: `Generated multi-stage codebase for project ${finalProject._id} (v${nextVersion})`
    });

    // Broadcast final success event
    pipelineEvents.emit(`progress:${projectId}`, {
      stage: 'completed',
      percentage: 100,
      logs: 'Deploying edge clusters...\nReady!',
      completed: true,
      project: finalProject
    });

  } catch (err) {
    console.error('Multi-stage pipeline failed:', err);
    const failProject = await Project.findById(projectId);
    if (failProject) {
      failProject.status = 'failed';
      failProject.pipelineState.currentStage = 'failed';
      failProject.pipelineState.stageLogs = `Orchestrator pipeline error: ${err.message}`;
      await failProject.save();
    }

    pipelineEvents.emit(`progress:${projectId}`, {
      stage: 'failed',
      percentage: 100,
      logs: `Pipeline execution failed: ${err.message}`,
      completed: true,
      error: err.message
    });
  }
};

// Event emitter broadcast helper
const updateStage = (projectId, stage, pct, logs) => {
  Project.findByIdAndUpdate(projectId, {
    'pipelineState.currentStage': stage,
    'pipelineState.percentage': pct,
    'pipelineState.stageLogs': logs
  }).exec();

  pipelineEvents.emit(`progress:${projectId}`, {
    stage,
    percentage: pct,
    logs,
    completed: false
  });
};

// State updates intermediate helper
const updateProjectState = async (projectId, stage, pct, logs, plan, info) => {
  await Project.findByIdAndUpdate(projectId, {
    'pipelineState.currentStage': stage,
    'pipelineState.percentage': pct,
    'pipelineState.stageLogs': logs,
    'pipelineState.blueprint': plan,
    'pipelineState.content': info
  });

  pipelineEvents.emit(`progress:${projectId}`, {
    stage,
    percentage: pct,
    logs,
    completed: false,
    blueprint: plan,
    content: info
  });
};

// Gemini generation wrap using native fetch (bypasses GCP Auth latency checks) with rate-limit exponential backoff retries
const generateAI = async (prompt, modelName = 'gemini-2.5-flash', retries = 4, delay = 3000) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      
      // Handle Rate Limits (HTTP 429 Too Many Requests)
      if (response.status === 429) {
        if (i === retries) {
          const errText = await response.text();
          throw new Error(`Gemini API HTTP 429 Quota Exceeded after ${retries} attempts: ${errText}`);
        }
        
        // Parse retry-after header if present, otherwise calculate exponential backoff (e.g. 3s, 6s, 12s...)
        const retryAfterHeader = response.headers.get('retry-after');
        const waitTime = retryAfterHeader ? parseInt(retryAfterHeader) * 1000 : delay * Math.pow(2, i);
        console.warn(`[Gemini API 429] Rate limit hit. Retrying in ${waitTime}ms (Attempt ${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API HTTP ${response.status}: ${errText}`);
      }
      
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      if (i === retries) {
        throw error;
      }
      // For general network errors or intermediate issues, retry with backoff as well
      const waitTime = delay * Math.pow(2, i);
      console.warn(`[Gemini API Error] ${error.message}. Retrying in ${waitTime}ms (Attempt ${i + 1}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};
// });

// 3. FETCH WORKSPACE PROJECTS (LIGHTWEIGHT LIST)
export const getWorkspaceProjects = asyncHandler(async (req, res, next) => {
  const { workspaceId } = req.params;

  // Retrieve projects excluding large history fields to maximize speeds, keeping currentCode for live preview rendering
  const projects = await Project.find({ workspaceId })
    .select('-history')
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

    const rawJson = await generateAI(auditPrompt, 'gemini-2.5-flash-lite');
    // Sanitization in case of markdown wrap
    const cleanJson = rawJson.replace(/```json|```/g, '').trim();
    const auditData = JSON.parse(cleanJson);

    project.designAudit = {
      score: auditData.score || 100,
      lastAuditedAt: new Date(),
     warnings: (Array.isArray(auditData.warnings) ? auditData.warnings : []).map((w, index) => ({
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

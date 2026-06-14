import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import connectDB from './src/Configs/Database.Config.js';
import UserRouter from './src/Route/User.Route.js';
import ProjectRouter from './src/Route/Project.Route.js';
import WorkspaceRouter from './src/Route/Workspace.Route.js';
import BillingRouter from './src/Route/Billing.Route.js';
import { stripeWebhookHandler } from './src/Controller/Billing.Controller.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Global Middlewares
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// Raw body parser for Stripe webhook signature verification
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json());
app.use(cookieParser());

// Mount API Routes
app.use('/api', UserRouter);
app.use('/api', ProjectRouter);
app.use('/api', WorkspaceRouter);
app.use('/api', BillingRouter);


// Base health check route
app.get('/', (req, res) => {
  res.json({ message: 'Nirman.AI Backend Server is running!' });
});

// Global Express Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const errors = err.errors || [];
  
  console.error(`[Server Error] ${statusCode} - ${message}`);
  console.error(err.stack || err);
  
  res.status(statusCode).json({
    success: false,
    error: err.constructor.name || 'ApiError',
    message,
    errors
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Nirman.AI Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

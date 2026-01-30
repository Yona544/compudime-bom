import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { auth } from './auth.js';
import { sessionMiddleware } from './middleware/auth.js';

export const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://bom-api.fly.dev'],
  credentials: true
}));
app.use(helmet());
app.use(express.json());

// Better Auth handler - must be before other routes
app.all('/api/auth/*', toNodeHandler(auth));

// Session middleware - extracts session for all routes
app.use(sessionMiddleware);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', routes);

app.use(errorHandler);

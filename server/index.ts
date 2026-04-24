import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { startScheduler } from "./services/scheduler";
import { startPipelineScheduler } from "./services/pipeline-scheduler";

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId?: number;
    isAnonymous?: boolean;
    linkedinConnectState?: string;
    linkedinLoginState?: string;
  }
}

// Simple log function for production
const log = (message: string) => {
  const timestamp = new Date().toLocaleString();
  console.log(`${timestamp} ${message}`);
};

// Simple static file server for production
const serveStatic = (app: express.Application) => {
  app.use(express.static(path.join(process.cwd(), "dist/public")));
  
  // Catch-all handler for SPA
  app.get("*", (req, res) => {
    res.sendFile(path.join(process.cwd(), "dist/public/index.html"));
  });
};

const app = express();

// Trust proxy for production (behind nginx/cloudflare)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Skip JSON parsing for the billing webhook (needs raw body for signature verification)
app.use((req, res, next) => {
  if (req.path === '/api/billing/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: false }));

// Session store: Postgres-backed so sessions survive container restarts.
// Fall back to in-memory only when DATABASE_URL isn't set (local scripts/tests).
const PgSession = connectPgSimple(session);
const MemoryStoreSession = MemoryStore(session);

const sessionStore = process.env.DATABASE_URL
  ? new PgSession({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 60, // hourly prune of expired rows (seconds)
    })
  : new MemoryStoreSession({ checkPeriod: 86400000 });

app.use(session({
  secret: process.env.SESSION_SECRET || 'content-reworker-dev-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Serve static files from the public directory
app.use('/public', express.static(path.join(process.cwd(), 'public')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT from environment or default to 5000
  // this serves both the API and the client.
  const port = parseInt(process.env.PORT || "5000");
  server.listen({
    port,
    host: process.env.HOST || "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);

    // Start the post scheduler for processing scheduled posts
    startScheduler();

    // Start the pipeline scheduler for auto-generating content
    startPipelineScheduler();
  });

  const shutdown = () => {
    log('Shutting down...');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/_healthz", (_req, res) => {
  res.status(200).send("OK");
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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

      log(logLine);
    }
  });

  next();
});

registerRoutes(httpServer, app);

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error("Internal Server Error:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(status).json({ message });
});

if (process.env.NODE_ENV === "production") {
  serveStatic(app);

  const primaryPort = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port: primaryPort, host: "0.0.0.0" }, () => {
    log(`serving on port ${primaryPort}`);
    process.nextTick(() => {
      seedDatabase().catch(err => console.error("Seed failed:", err));
    });
  });

  if (process.env.NEXUS_ENABLE_SECONDARY_HEALTH === "1") {
    const healthApp = express();
    healthApp.get("/", (_req, res) => res.status(200).send("OK"));
    healthApp.get("/health", (_req, res) => res.status(200).send("OK"));
    healthApp.all("/{*path}", (_req, res) => res.status(200).send("OK"));
    const healthServer = createServer(healthApp);
    healthServer.listen({ port: 3333, host: "0.0.0.0" }, () => {
      log(`health check server on port 3333`);
    });
  }
} else {
  (async () => {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen({ port, host: "0.0.0.0" }, () => {
      log(`serving on port ${port}`);
      process.nextTick(() => {
        seedDatabase().catch(err => console.error("Seed failed:", err));
      });
    });
  })();
}

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import competitionRoutes from "./routes/competition.routes";
import groupRoutes from "./routes/group.routes";
import invitationRoutes from "./routes/invitation.routes";
import matchRoutes from "./routes/match.routes";
import predictionRoutes from "./routes/prediction.routes";
import statisticsRoutes from "./routes/statistics.routes";
import teamRoutes from "./routes/team.routes";
import userRoutes from "./routes/user.routes";

const app = express();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FrozenBet API - Hockey Predictions Platform",
      version: "1.0.0",
      description:
        "Complete REST API for FrozenBet hockey predictions platform",
      contact: {
        name: "API Support",
        email: "support@frozenbet.app",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

app.use("/api/", limiter);

// Swagger documentation
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/competitions", competitionRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/statistics", statisticsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Endpoint not found",
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`\n🚀 Server running on http://localhost:${config.port}`);
  console.log(`📚 API Documentation: http://localhost:${config.port}/api/docs`);
  console.log(`🏒 FrozenBet API - Hockey Predictions Platform`);
});

export default app;

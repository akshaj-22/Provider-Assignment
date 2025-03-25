const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const path = require("path");
const { connectDB, initializeTables } = require("./src/models/index");
const consultationRoutes = require("./src/routes/consultationRoutes");
const licenseRoutes = require("./src/routes/providerLicenseRoutes");

const app = express();

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"]
}));
app.use(express.json());

// Connect to DB & Initialize Tables
connectDB();
initializeTables();

// Routes
app.use("/api/consultations", consultationRoutes);
app.use("/api/license", licenseRoutes);

// Load swagger.json using path.resolve()
const swaggerFilePath = path.resolve(__dirname, './swagger/swagger.json');
const swaggerDocument = require(swaggerFilePath);

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📄 API docs available at http://localhost:${PORT}/api-docs`);
});

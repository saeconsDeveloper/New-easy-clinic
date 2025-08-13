const Sequelize = require("sequelize");
require("dotenv").config();

let retries = 0;
const MAX_RETRIES = parseInt(process.env.SEQUELIZE_MAX_RETRIES) || 5;

const sequelize = (module.exports = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_USERNAME,
  process.env.DATABASE_PASSWORD,
  {
    host: process.env.DATABASE_HOST,
    dialect: "mysql",
    // timezone: "+04:00",
    // pool: {
    //   max: 20,
    //   min: 1,
    //   acquire: 20000,
    //   idle: 10000,
    //   evict: 5000
    // }
  }
));

const calculateBackoffDelay = (attempt) => {
  const baseDelay = 2000; // Initial delay in milliseconds (adjustable)
  const exponent = 1.5; // Adjust exponent for desired backoff increase
  return Math.floor(baseDelay * Math.pow(exponent, attempt - 1));
};

async function authenticateWithRetry() {
  while (retries < MAX_RETRIES) {
    try {
      await sequelize.authenticate();
      console.log("Connection has been established successfully.");
      retries = 0;
      return;
    } catch (error) {
      retries++;
      console.error(`Attempt ${retries}`);

      if (retries >= MAX_RETRIES) {
        console.log(
          "Max retries reached. Could not establish a database connection."
        );
      } else {
        const delay = calculateBackoffDelay(retries);
        console.log(
          `Waiting for ${delay / 1000} seconds before retry ${retries + 1}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}

// Authenticate and sync tables, then ensure admin user
async function initializeDatabase() {
  try {
    // Step 1: Authenticate the connection
    await authenticateWithRetry();

    // Step 2: Sync the database (create tables if they don't exist)
    await sequelize.sync({ force: false });
    console.log("Database synced successfully.");


  } catch (error) {
    console.error("Error during database initialization:", error);
  }
}

// Start the initialization process
initializeDatabase();

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  if (err.code === "ENOTFOUND") {
    console.error("Network issue: Unable to resolve hostname.");
  }
});
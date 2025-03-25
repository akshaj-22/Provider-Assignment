const { sequelize, connectDB } = require("../config/database");
const Patient = require("./patient");
const Provider = require("./provider");
const Consultation = require("./consultation");
const Notification = require("./notification");
const PatientDocument = require("./patientDocument");

const initializeTables = async () => {
  await sequelize.sync({ force: false }); 
  console.log("✅ All tables initialized.");
};

module.exports = { connectDB, initializeTables, Patient, Provider, Consultation, Notification, PatientDocument };

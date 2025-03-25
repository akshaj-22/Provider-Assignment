const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database"); // Import Sequelize instance
const Provider = require('./provider');
const Patient = require('./patient');

const PatientDocument = sequelize.define("PatientDocument", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  consultation_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  provider_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: Provider, key: 'id' }
  },
  patient_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: Patient, key: 'id' }
  },
  date: {
    type: DataTypes.DATEONLY, // Stores only the date
    allowNull: false,
  },
  document_type: {
    type: DataTypes.ENUM('PreMedicalRecord', 'LabResult'),
    allowNull: false,
  },
  document_url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = PatientDocument;

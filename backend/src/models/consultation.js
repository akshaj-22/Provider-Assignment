const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Provider = require('./provider');
const Patient = require('./patient');

const Consultation = sequelize.define('Consultation', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    patient_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Patient, key: 'id' } },
    provider_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Provider, key: 'id' } },
    date: { type: DataTypes.DATE, allowNull: false },
    time: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.ENUM('Scheduled', 'Rescheduled', 'Cancelled', 'Missed', 'Completed'), allowNull: false  },
    priority: { type: DataTypes.ENUM('normal', 'urgent'), allowNull: false },
}, { timestamps: true });

module.exports = Consultation;

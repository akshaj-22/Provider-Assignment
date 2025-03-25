const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Patient = sequelize.define('Patient', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    role: { type: DataTypes.ENUM('patient'), allowNull: false, defaultValue: 'patient' },
    reason_for_consultation: { type: DataTypes.STRING, allowNull: false },
}, { timestamps: true });

module.exports = Patient;

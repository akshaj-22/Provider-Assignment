const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Provider = sequelize.define('Provider', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    role: { type: DataTypes.ENUM('provider'), allowNull: false, defaultValue: 'provider' },
    specialization: { type: DataTypes.STRING, allowNull: false },
    license_number: { type: DataTypes.STRING, allowNull: true },
    license_expiry_date: { type: DataTypes.DATE, allowNull: false },
    state: { type: DataTypes.STRING, allowNull: true },
}, { timestamps: true });

module.exports = Provider;


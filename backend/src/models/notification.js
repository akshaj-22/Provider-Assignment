const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Provider = require('./provider');

const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    provider_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Provider, key: 'id' } },
    type: { type: DataTypes.ENUM('consultation', 'system', 'billing', 'license_expiry'), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('unread', 'read'), defaultValue: 'unread' },
}, { timestamps: true });

module.exports = Notification;

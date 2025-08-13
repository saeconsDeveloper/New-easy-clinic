"use strict";
const { DataTypes } = require("sequelize");
const sequelize = require("../../configs/database");

const Clinic = sequelize.define("clinics", {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(191), allowNull: false },
  code: { type: DataTypes.STRING(64), unique: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  adminPasswordHash: { type: DataTypes.STRING(191), allowNull: true },
  viewerPasswordHash: { type: DataTypes.STRING(191), allowNull: true },
}, {
  timestamps: true,
});

module.exports = Clinic;

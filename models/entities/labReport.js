"use strict";
const { DataTypes } = require("sequelize");
const sequelize = require("../../configs/database");
const Diagnose = require("./diagnose");

const LabReport = sequelize.define("labReports", {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  diagnoseId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: { model: "diagnoses", key: "id" },
  },
  key: { type: DataTypes.TEXT },
  fileName: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  timestamps: true,
});

Diagnose.hasMany(LabReport, { foreignKey: "diagnoseId" });
LabReport.belongsTo(Diagnose, { foreignKey: "diagnoseId" });

module.exports = LabReport;

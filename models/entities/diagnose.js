"use strict";
const { DataTypes } = require("sequelize");
const sequelize = require("../../configs/database");
const Patient = require("./patient");

const Diagnose = sequelize.define("diagnoses", {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  patientId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: { model: "patients", key: "id" },
  },
  date: { type: DataTypes.DATE, allowNull: true },
  diagnosis: { type: DataTypes.TEXT, allowNull: true },
  treatment: { type: DataTypes.TEXT, allowNull: true },
}, {
  timestamps: true,
});

Patient.hasMany(Diagnose, { foreignKey: "patientId" });
Diagnose.belongsTo(Patient, { foreignKey: "patientId" });

module.exports = Diagnose;

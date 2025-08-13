"use strict";
const { DataTypes } = require("sequelize");
const sequelize = require("../../configs/database");
const Clinic = require("./clinic");

const Patient = sequelize.define("patients", {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  clinicId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: { model: "clinics", key: "id" },
  },
  name: { type: DataTypes.STRING, allowNull: true },
  birthdate: { type: DataTypes.STRING, allowNull: true },
  address: { type: DataTypes.STRING, allowNull: true },
  mobileNo: { type: DataTypes.STRING, allowNull: true },
}, {
  timestamps: true,
});

Clinic.hasMany(Patient, { foreignKey: "clinicId" });
Patient.belongsTo(Clinic, { foreignKey: "clinicId" });

module.exports = Patient;

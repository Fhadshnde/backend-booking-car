import { prisma } from "../lib/prisma.js";

export const getAvailableDrivers = async (req, res) => {
  try {
    const { companyId } = req.query;
    const where = { isAvailable: true };
    if (companyId) where.companyId = parseInt(companyId);

    const drivers = await prisma.driver.findMany({ where });
    res.status(200).json({ success: true, drivers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDriver = async (req, res) => {
  try {
    const driver = await prisma.driver.create({
      data: req.body
    });
    res.status(201).json({ success: true, driver });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

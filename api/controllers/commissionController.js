import { prisma } from "../lib/prisma.js";

export const getCommission = async (req, res) => {
  try {
    const { companyId } = req.params;
    const commission = await prisma.commission.findFirst({
      where: { companyId: parseInt(companyId) },
      include: {
        company: {
          select: { name: true }
        }
      }
    });

    if (!commission) {
      return res.status(404).json({ success: false, message: "Commission not found" });
    }

    res.status(200).json({ success: true, data: commission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllCommissions = async (req, res) => {
  try {
    const commissions = await prisma.commission.findMany({
      include: {
        company: { select: { name: true } }
      }
    });

    res.status(200).json({
      success: true,
      count: commissions.length,
      data: commissions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCommission = async (req, res) => {
  try {
    const { companyId, percentage, fixedAmount } = req.body;

    const company = await prisma.company.findUnique({
      where: { id: parseInt(companyId) }
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const commission = await prisma.commission.create({
      data: {
        companyId: parseInt(companyId),
        percentage: parseFloat(percentage) || 10,
        fixedAmount: parseFloat(fixedAmount) || 0,
        updatedBy: parseInt(req.user.id)
      }
    });

    res.status(201).json({
      success: true,
      message: "Commission created successfully",
      data: commission
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCommission = async (req, res) => {
  try {
    const { commissionId } = req.params;
    const { percentage, fixedAmount } = req.body;
    const id = parseInt(commissionId);

    const existingCommission = await prisma.commission.findUnique({
      where: { id }
    });

    if (!existingCommission) {
      return res.status(404).json({ success: false, message: "Commission not found" });
    }

    if (percentage !== undefined) {
      if (percentage < 0 || percentage > 100) {
        return res.status(400).json({ success: false, message: "Percentage must be between 0 and 100" });
      }
    }

    if (fixedAmount !== undefined) {
      if (fixedAmount < 0) {
        return res.status(400).json({ success: false, message: "Fixed amount cannot be negative" });
      }
    }

    const updatedCommission = await prisma.commission.update({
      where: { id },
      data: {
        percentage: percentage !== undefined ? parseFloat(percentage) : existingCommission.percentage,
        fixedAmount: fixedAmount !== undefined ? parseFloat(fixedAmount) : existingCommission.fixedAmount,
        updatedBy: parseInt(req.user.id)
      }
    });

    res.status(200).json({
      success: true,
      message: "Commission updated successfully",
      data: updatedCommission
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCommission = async (req, res) => {
  try {
    const { commissionId } = req.params;
    const id = parseInt(commissionId);

    await prisma.commission.delete({
      where: { id }
    });

    res.status(200).json({ success: true, message: "Commission deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const calculateCommission = async (companyId, bookingAmount) => {
  try {
    const commission = await prisma.commission.findFirst({
      where: { companyId: parseInt(companyId) }
    });

    if (!commission) return 0;

    const percentageAmount = (bookingAmount * commission.percentage) / 100;
    return percentageAmount + commission.fixedAmount;
  } catch (error) {
    return 0;
  }
};
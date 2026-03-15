import Commission from '../models/Commission.js';
import User from '../models/user.model.js';

export const getCommission = async (req, res) => {
  try {
    const { companyId } = req.params;
    const commission = await Commission.findOne({ company: companyId }).populate('company', 'name ');

    if (!commission) {
      return res.status(404).json({ success: false, message: 'Commission not found' });
    }

    res.status(200).json({ success: true, data: commission });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch commission' });
  }
};

export const getAllCommissions = async (req, res) => {
  try {
    const commissions = await Commission.find()
      .populate('company', 'name ')
      .populate('updatedBy', 'name ');

    res.status(200).json({
      success: true,
      count: commissions.length,
      data: commissions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch commissions' });
  }
};

export const createCommission = async (req, res) => {
  try {
    const { companyId, percentage, fixedAmount, notes } = req.body;

    const company = await User.findById(companyId);
    if (!company || company.role !== 'company') {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const commission = new Commission({
      company: companyId,
      percentage: percentage || 10,
      fixedAmount: fixedAmount || 0,
      notes,
      updatedBy: req.user?.id
    });

    await commission.save();

    res.status(201).json({
      success: true,
      message: 'Commission created successfully',
      data: commission
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create commission' });
  }
};

export const updateCommission = async (req, res) => {
  try {
    const { commissionId } = req.params;
    const { percentage, fixedAmount, isActive, notes } = req.body;

    const commission = await Commission.findById(commissionId);
    if (!commission) {
      return res.status(404).json({ success: false, message: 'Commission not found' });
    }

    if (percentage !== undefined) {
      if (percentage < 0 || percentage > 100) {
        return res.status(400).json({ success: false, message: 'Percentage must be between 0 and 100' });
      }
      commission.percentage = percentage;
    }

    if (fixedAmount !== undefined) {
      if (fixedAmount < 0) {
        return res.status(400).json({ success: false, message: 'Fixed amount cannot be negative' });
      }
      commission.fixedAmount = fixedAmount;
    }

    if (isActive !== undefined) commission.isActive = isActive;
    if (notes !== undefined) commission.notes = notes;

    commission.updatedBy = req.user?.id;
    await commission.save();

    res.status(200).json({
      success: true,
      message: 'Commission updated successfully',
      data: commission
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update commission' });
  }
};

export const deleteCommission = async (req, res) => {
  try {
    const { commissionId } = req.params;
    const commission = await Commission.findByIdAndDelete(commissionId);

    if (!commission) {
      return res.status(404).json({ success: false, message: 'Commission not found' });
    }

    res.status(200).json({ success: true, message: 'Commission deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete commission' });
  }
};

export const calculateCommission = async (companyId, bookingAmount) => {
  try {
    const commission = await Commission.findOne({ company: companyId, isActive: true });
    if (!commission) return 0;

    const percentageAmount = (bookingAmount * commission.percentage) / 100;
    return percentageAmount + commission.fixedAmount;
  } catch (error) {
    console.error('Error calculating commission:', error.message);
    return 0;
  }
};

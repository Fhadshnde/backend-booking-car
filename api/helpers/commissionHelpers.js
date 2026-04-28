import { prisma } from "../lib/prisma.js";

/**
 * حساب العمولة لشركة معينة
 * @param {Number} companyId - معرف الشركة
 * @param {Number} amount - المبلغ الإجمالي
 * @returns {Promise<Object>} تفاصيل العمولة
 */
export const calculateCommissionForCompany = async (companyId, amount) => {
  try {
    const commission = await prisma.commission.findFirst({
      where: { companyId: parseInt(companyId) }
    });

    if (!commission) {
      return {
        commissionAmount: 0,
        percentage: 0,
        fixedAmount: 0,
        netAmount: amount,
        isApplied: false,
      };
    }

    const percentageAmount = (amount * commission.percentage) / 100;
    const totalCommission = percentageAmount + commission.fixedAmount;
    const netAmount = amount - totalCommission;

    return {
      commissionAmount: parseFloat(totalCommission.toFixed(2)),
      percentage: commission.percentage,
      fixedAmount: commission.fixedAmount,
      netAmount: parseFloat(netAmount.toFixed(2)),
      isApplied: true,
      commissionId: commission.id,
    };
  } catch (error) {
    console.error("خطأ في حساب العمولة:", error);
    return {
      commissionAmount: 0,
      percentage: 0,
      fixedAmount: 0,
      netAmount: amount,
      isApplied: false,
      error: error.message,
    };
  }
};

/**
 * الحصول على إحصائيات العمولات
 * @param {Number} companyId - معرف الشركة (اختياري)
 * @returns {Promise<Object>} إحصائيات العمولات
 */
export const getCommissionStatistics = async (companyId = null) => {
  try {
    let where = {};
    if (companyId) {
      where = { companyId: parseInt(companyId) };
    }

    const commissions = await prisma.commission.findMany({
      where,
      include: {
        company: { select: { name: true } }
      }
    });

    const avgStats = await prisma.commission.aggregate({
      where,
      _avg: { percentage: true, fixedAmount: true },
      _count: { id: true }
    });

    return {
      success: true,
      totalCommissions: commissions.length,
      averagePercentage: avgStats._avg.percentage || 0,
      averageFixedAmount: avgStats._avg.fixedAmount || 0,
      commissions: commissions,
    };
  } catch (error) {
    console.error("خطأ في جلب إحصائيات العمولات:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * التحقق من صحة نسبة العمولة
 * @param {Number} percentage - النسبة المئوية
 * @returns {Object} نتيجة التحقق
 */
export const validateCommissionPercentage = (percentage) => {
  if (typeof percentage !== "number") {
    return {
      isValid: false,
      message: "النسبة المئوية يجب أن تكون رقماً",
    };
  }

  if (percentage < 0 || percentage > 100) {
    return {
      isValid: false,
      message: "النسبة المئوية يجب أن تكون بين 0 و 100",
    };
  }

  return {
    isValid: true,
    message: "النسبة صحيحة",
  };
};

/**
 * التحقق من صحة المبلغ الثابت
 * @param {Number} fixedAmount - المبلغ الثابت
 * @returns {Object} نتيجة التحقق
 */
export const validateFixedAmount = (fixedAmount) => {
  if (typeof fixedAmount !== "number") {
    return {
      isValid: false,
      message: "المبلغ الثابت يجب أن يكون رقماً",
    };
  }

  if (fixedAmount < 0) {
    return {
      isValid: false,
      message: "المبلغ الثابت لا يمكن أن يكون سالباً",
    };
  }

  return {
    isValid: true,
    message: "المبلغ الثابت صحيح",
  };
};

/**
 * مقارنة العمولات بين شركتين
 * @param {Number} companyId1 - معرف الشركة الأولى
 * @param {Number} companyId2 - معرف الشركة الثانية
 * @returns {Promise<Object>} المقارنة
 */
export const compareCommissions = async (companyId1, companyId2) => {
  try {
    const commission1 = await prisma.commission.findFirst({
      where: { companyId: parseInt(companyId1) },
      include: { company: { select: { name: true } } }
    });

    const commission2 = await prisma.commission.findFirst({
      where: { companyId: parseInt(companyId2) },
      include: { company: { select: { name: true } } }
    });

    if (!commission1 || !commission2) {
      return {
        success: false,
        message: "لم يتم العثور على إحدى العمولات",
      };
    }

    const difference = {
      percentageDiff: commission2.percentage - commission1.percentage,
      fixedAmountDiff: commission2.fixedAmount - commission1.fixedAmount,
    };

    return {
      success: true,
      company1: {
        name: commission1.company.name,
        percentage: commission1.percentage,
        fixedAmount: commission1.fixedAmount,
      },
      company2: {
        name: commission2.company.name,
        percentage: commission2.percentage,
        fixedAmount: commission2.fixedAmount,
      },
      difference: difference,
      higherCommissionCompany:
        difference.percentageDiff > 0
          ? commission2.company.name
          : commission1.company.name,
    };
  } catch (error) {
    console.error("خطأ في مقارنة العمولات:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * تطبيق عمولة على مجموعة من الشركات
 * @param {Array} companyIds - مصفوفة معرفات الشركات
 * @param {Number} percentage - النسبة المئوية
 * @param {Number} fixedAmount - المبلغ الثابت
 * @returns {Promise<Object>} نتيجة العملية
 */
export const applyBulkCommission = async (
  companyIds,
  percentage,
  fixedAmount = 0
) => {
  try {
    // التحقق من الصحة
    const percentageValidation = validateCommissionPercentage(percentage);
    if (!percentageValidation.isValid) {
      return {
        success: false,
        message: percentageValidation.message,
      };
    }

    const fixedAmountValidation = validateFixedAmount(fixedAmount);
    if (!fixedAmountValidation.isValid) {
      return {
        success: false,
        message: fixedAmountValidation.message,
      };
    }

    const parsedIds = companyIds.map(id => parseInt(id));

    const updateResult = await prisma.commission.updateMany({
      where: { companyId: { in: parsedIds } },
      data: {
        percentage: percentage,
        fixedAmount: fixedAmount,
      }
    });

    return {
      success: true,
      message: `تم تطبيق العمولة على ${updateResult.count} شركة`,
      modifiedCount: updateResult.count,
    };
  } catch (error) {
    console.error("خطأ في تطبيق العمولة الجماعية:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export default {
  calculateCommissionForCompany,
  getCommissionStatistics,
  validateCommissionPercentage,
  validateFixedAmount,
  compareCommissions,
  applyBulkCommission,
};

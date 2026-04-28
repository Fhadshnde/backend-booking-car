import { prisma } from "../lib/prisma.js";

export const createDamageReport = async (req, res) => {
  try {
    const { bookingId, description, images, estimatedCost } = req.body;

    if (!bookingId || !description) {
      return res.status(400).json({ success: false, message: "معرف الحجز والوصف مطلوبان" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: { car: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    }

    if (req.user.role === "company" && booking.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: "غير مصرح لك" });
    }

    const existingReport = await prisma.damageReport.findUnique({
      where: { bookingId: Number(bookingId) }
    });

    if (existingReport) {
      return res.status(400).json({ success: false, message: "يوجد تقرير أضرار مسبق لهذا الحجز" });
    }

    const report = await prisma.damageReport.create({
      data: {
        bookingId: Number(bookingId),
        carId: booking.carId,
        companyId: booking.companyId,
        description,
        images: images || [],
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : 0
      }
    });

    res.status(201).json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDamageReports = async (req, res) => {
  try {
    const isCompany = req.user.role === "company";
    const where = isCompany ? { companyId: req.user.companyId } : {};

    const reports = await prisma.damageReport.findMany({
      where,
      include: {
        booking: { select: { id: true, startDate: true, endDate: true, user: { select: { name: true, phone: true } } } },
        car: { select: { id: true, model: true, licensePlate: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDamageReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { isResolved } = req.body;

    const report = await prisma.damageReport.findUnique({ where: { id: Number(id) } });

    if (!report) {
      return res.status(404).json({ success: false, message: "التقرير غير موجود" });
    }

    if (req.user.role === "company" && report.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: "غير مصرح لك" });
    }

    const updated = await prisma.damageReport.update({
      where: { id: Number(id) },
      data: { isResolved }
    });

    res.status(200).json({ success: true, report: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

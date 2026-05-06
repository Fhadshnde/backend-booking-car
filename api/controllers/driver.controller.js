import { prisma } from "../lib/prisma.js";

export const getDrivers = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10, companyId, isAvailable } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { licenseNumber: { contains: search, mode: 'insensitive' } }
      ]
    };

    if (companyId) where.companyId = parseInt(companyId);
    if (isAvailable !== undefined) where.isAvailable = isAvailable === 'true';

    const [drivers, total] = await prisma.$transaction([
      prisma.driver.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { company: { select: { name: true } } }
      }),
      prisma.driver.count({ where })
    ]);

    res.status(200).json({
      success: true,
      drivers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

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
    const { companyId, name, phone, licenseNumber, isAvailable } = req.body;
    let { image } = req.body;

    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      image = `data:${req.file.mimetype};base64,${b64}`;
    }
    
    const driverData = {
      name,
      phone,
      licenseNumber,
      image,
      isAvailable: isAvailable === 'true' || isAvailable === true
    };

    if (companyId && companyId !== 'null' && companyId !== '') {
      driverData.companyId = parseInt(companyId);
    }

    const driver = await prisma.driver.create({
      data: driverData
    });
    res.status(201).json({ success: true, driver });
  } catch (error) {
    console.error("Create Driver Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, licenseNumber, isAvailable, companyId } = req.body;
    let { image } = req.body;

    const existingDriver = await prisma.driver.findUnique({ where: { id: parseInt(id) } });
    if (!existingDriver) return res.status(404).json({ success: false, message: "السائق غير موجود" });

    // Authorization: Admin or Company owner (if driver belongs to a company)
    if (req.user.role !== 'admin' && existingDriver.companyId && req.user.companyId !== existingDriver.companyId) {
      return res.status(403).json({ success: false, message: "غير مصرح لك بتعديل هذا السائق" });
    }

    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      image = `data:${req.file.mimetype};base64,${b64}`;
    }

    const data = {
      name,
      phone,
      licenseNumber,
      image: image || existingDriver.image,
      isAvailable: isAvailable !== undefined ? (isAvailable === 'true' || isAvailable === true) : existingDriver.isAvailable
    };

    if (req.user.role === 'admin') {
      if (companyId === 'null' || companyId === '') {
        data.companyId = null;
      } else if (companyId) {
        data.companyId = parseInt(companyId);
      }
    }

    const driver = await prisma.driver.update({
      where: { id: parseInt(id) },
      data
    });

    res.status(200).json({ success: true, driver });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;

    const existingDriver = await prisma.driver.findUnique({ where: { id: parseInt(id) } });
    if (!existingDriver) return res.status(404).json({ success: false, message: "السائق غير موجود" });

    if (req.user.role !== 'admin' && req.user.companyId !== existingDriver.companyId) {
      return res.status(403).json({ success: false, message: "غير مصرح لك بحذف هذا السائق" });
    }

    // Check if driver is assigned to active bookings
    const activeBookings = await prisma.booking.count({
      where: {
        driverId: parseInt(id),
        status: { in: ['pending', 'confirmed', 'on_trip'] }
      }
    });

    if (activeBookings > 0) {
      return res.status(400).json({ success: false, message: "لا يمكن حذف السائق لديه حجوزات نشطة حالياً" });
    }

    await prisma.driver.delete({ where: { id: parseInt(id) } });
    res.status(200).json({ success: true, message: "تم حذف السائق بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

import { prisma } from "../lib/prisma.js";

export const createCompany = async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      city,
      description,
      ownerId,
      licenseNumber,
      percentage,
      fixedAmount
    } = req.body;

    const ownerIdInt = parseInt(ownerId);

    const ownerUser = await prisma.user.findUnique({
      where: { id: ownerIdInt }
    });

    if (!ownerUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (ownerUser.companyId) {
      return res.status(400).json({
        success: false,
        message: "User already owns a company"
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name,
          phone,
          address,
          city,
          licenseNumber,
          description
        }
      });

      await tx.user.update({
        where: { id: ownerIdInt },
        data: { companyId: company.id }
      });

      await tx.commission.create({
        data: {
          companyId: company.id,
          percentage: percentage || 10,
          fixedAmount: fixedAmount || 0,
          updatedBy: req.user?.id ? parseInt(req.user.id) : null
        }
      });

      return company;
    });

    res.status(201).json({
      success: true,
      message: "Company and commission created successfully",
      company: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create company"
    });
  }
};

export const getCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 10, isApproved } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    let where = {};
    if (isApproved !== undefined) {
      where.isApproved = isApproved === "true";
    }

    const [companies, total] = await prisma.$transaction([
      prisma.company.findMany({
        where,
        skip,
        take: limitNumber,
        include: {
          users: {
            select: {
              name: true,
              phone: true
            },
            where: {
              role: "owner"
            }
          }
        }
      }),
      prisma.company.count({ where })
    ]);

    res.status(200).json({
      success: true,
      companies,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch companies" });
  }
};

export const getCompany = async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        users: {
          select: { name: true, phone: true }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    res.status(200).json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch company" });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const { name, phone, description, address, city, country } = req.body;
    const company = await prisma.company.update({
      where: { id: parseInt(req.params.id) },
      data: { name, phone, description, address, city, country }
    });

    res.status(200).json({
      success: true,
      message: "Company updated successfully",
      company
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update company" });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { companyId: companyId },
        data: { companyId: null }
      }),
      prisma.car.deleteMany({ where: { companyId: companyId } }),
      prisma.commission.deleteMany({ where: { companyId: companyId } }),
      prisma.company.delete({ where: { id: companyId } })
    ]);

    res.status(200).json({ success: true, message: "Company and related data deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete company" });
  }
};

export const getCompanyProfile = async (req, res) => {
  try {
    const company = await prisma.company.findFirst({
      where: {
        users: {
          some: { id: parseInt(req.user.id) }
        }
      },
      include: {
        users: {
          select: { name: true, phone: true }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    res.status(200).json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch company profile" });
  }
};

export const updateCompanyProfile = async (req, res) => {
  try {
    const { name, phone, description, address, city, country, logo } = req.body;

    const existingCompany = await prisma.company.findFirst({
      where: {
        users: { some: { id: parseInt(req.user.id) } }
      }
    });

    if (!existingCompany) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const company = await prisma.company.update({
      where: { id: existingCompany.id },
      data: { name, phone, description, address, city, country, logo }
    });

    res.status(200).json({
      success: true,
      message: "Company profile updated successfully",
      company
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update company profile" });
  }
};

export const getCompanyDashboard = async (req, res) => {
  try {
    const userId = parseInt(req.user.id);
    const company = await prisma.company.findFirst({
      where: {
        users: { some: { id: userId } }
      }
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const [
      totalCars,
      totalBookings,
      completedBookings,
      pendingBookings,
      revenueData,
      recentBookings
    ] = await prisma.$transaction([
      prisma.car.count({ where: { companyId: company.id } }),
      prisma.booking.count({ where: { companyId: company.id } }),
      prisma.booking.count({ where: { companyId: company.id, status: "completed" } }),
      prisma.booking.count({ where: { companyId: company.id, status: "pending" } }),
      prisma.booking.aggregate({
        where: {
          companyId: company.id,
          paymentStatus: "completed"
        },
        _sum: {
          totalPrice: true
        }
      }),
      prisma.booking.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { name: true } },
          car: { select: { brand: { select: { name: true } }, model: true } }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      dashboard: {
        totalCars,
        totalBookings,
        completedBookings,
        pendingBookings,
        totalRevenue: revenueData._sum.totalPrice || 0,
        recentBookings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch dashboard" });
  }
};

export const getCompanyCars = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [cars, total] = await prisma.$transaction([
      prisma.car.findMany({
        where: { companyId },
        skip,
        take: limitNumber,
        orderBy: { createdAt: "desc" }
      }),
      prisma.car.count({ where: { companyId } })
    ]);

    res.status(200).json({
      success: true,
      cars,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch cars" });
  }
};
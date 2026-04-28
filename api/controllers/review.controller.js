import { prisma } from "../lib/prisma.js";

const updateCarAndCompanyStats = async (carId, companyId) => {
  const carReviews = await prisma.review.aggregate({
    where: { carId },
    _avg: { rating: true },
    _count: { rating: true }
  });

  await prisma.car.update({
    where: { id: carId },
    data: {
      rating: carReviews._avg.rating || 0,
      totalReviews: carReviews._count.rating || 0
    }
  });

  const companyReviews = await prisma.review.aggregate({
    where: { companyId },
    _avg: { rating: true },
    _count: { rating: true }
  });

  await prisma.company.update({
    where: { id: companyId },
    data: {
      rating: companyReviews._avg.rating || 0,
      totalReviews: companyReviews._count.rating || 0
    }
  });
};

export const createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const bId = parseInt(bookingId);

    const booking = await prisma.booking.findUnique({
      where: { id: bId }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({ success: false, message: "لا يمكن تقييم حجز غير مكتمل" });
    }

    if (booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: "لا يمكنك تقييم حجز ليس لك" });
    }

    const existingReview = await prisma.review.findUnique({
      where: { bookingId: bId }
    });

    if (existingReview) {
      return res.status(400).json({ success: false, message: "تم تقييم هذا الحجز مسبقاً" });
    }

    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        carId: booking.carId,
        companyId: booking.companyId,
        bookingId: bId,
        rating: parseInt(rating),
        comment
      }
    });

    await updateCarAndCompanyStats(booking.carId, booking.companyId);

    res.status(201).json({
      success: true,
      message: "تم إنشاء التقييم بنجاح",
      review
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCarReviews = async (req, res) => {
  try {
    const carId = parseInt(req.params.carId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where: { carId },
        skip,
        take: limit,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.review.count({ where: { carId } })
    ]);

    res.status(200).json({
      success: true,
      reviews,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanyReviews = async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await prisma.$transaction([
      prisma.review.findMany({
        where: { companyId },
        skip,
        take: limit,
        include: {
          user: { select: { name: true } },
          car: { include: { brand: { select: { name: true } } } }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.review.count({ where: { companyId } })
    ]);

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyReviews = async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { userId: req.user.id },
      include: {
        car: { select: { model: true, images: true } },
        company: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const review = await prisma.review.findUnique({
      where: { id }
    });

    if (!review) {
      return res.status(404).json({ success: false, message: "التقييم غير موجود" });
    }

    if (review.userId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "لا يمكنك حذف هذا التقييم" });
    }

    await prisma.review.delete({
      where: { id }
    });

    await updateCarAndCompanyStats(review.carId, review.companyId);

    res.status(200).json({
      success: true,
      message: "تم حذف التقييم بنجاح"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
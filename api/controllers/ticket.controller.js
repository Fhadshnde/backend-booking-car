import { prisma } from "../lib/prisma.js";

export const createTicket = async (req, res) => {
  try {
    const { subject, priority, message } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: "الموضوع والرسالة مطلوبان" });
    }

    const ticket = await prisma.ticket.create({
      data: {
        userId: req.user.id,
        subject,
        priority: priority || "normal",
        messages: {
          create: {
            senderId: req.user.id,
            content: message
          }
        }
      },
      include: {
        messages: true
      }
    });

    res.status(201).json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTickets = async (req, res) => {
  try {
    const where = req.user.role === "admin" ? {} : { userId: req.user.id };
    
    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { name: true, phone: true } }
      }
    });

    res.status(200).json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTicketDetails = async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" }
        },
        user: { select: { id: true, name: true, profileImage: true } }
      }
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "التذكرة غير موجودة" });
    }

    if (req.user.role !== "admin" && ticket.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: "غير مصرح لك" });
    }

    res.status(200).json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToTicket = async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "الرسالة مطلوبة" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ success: false, message: "التذكرة غير موجودة" });

    if (req.user.role !== "admin" && ticket.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: "غير مصرح لك" });
    }

    const ticketMessage = await prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: req.user.id,
        content: message
      }
    });

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date(), status: req.user.role === "admin" ? "answered" : "open" }
    });

    res.status(201).json({ success: true, message: ticketMessage });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { status } = req.body;

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status }
    });

    res.status(200).json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

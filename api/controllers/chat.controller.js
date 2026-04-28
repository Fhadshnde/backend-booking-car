import { prisma } from "../lib/prisma.js";

export const getConversations = async (req, res) => {
  try {
    const isCompany = req.user.role === "company";
    const where = isCompany ? { companyId: req.user.companyId } : { userId: req.user.id };

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, profileImage: true } },
        company: { select: { id: true, name: true, logo: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.status(200).json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await prisma.conversation.findUnique({
      where: { id: Number(conversationId) },
      include: {
        user: { select: { id: true, name: true, profileImage: true } },
        company: { select: { id: true, name: true, logo: true } }
      }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "المحادثة غير موجودة" });
    }

    const isAuthorized = req.user.role === "company" 
      ? conversation.companyId === req.user.companyId 
      : conversation.userId === req.user.id;

    if (!isAuthorized && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "غير مصرح لك" });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: Number(conversationId) },
      orderBy: { createdAt: "asc" }
    });

    // Mark messages as read
    await prisma.message.updateMany({
      where: { 
        conversationId: Number(conversationId),
        senderId: { not: req.user.id },
        isRead: false
      },
      data: { isRead: true }
    });

    res.status(200).json({ success: true, messages, conversation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { receiverId, companyId, content } = req.body;
    
    let conversationId;

    if (req.user.role === "user") {
      if (!companyId) return res.status(400).json({ success: false, message: "معرف الشركة مطلوب" });
      
      let conv = await prisma.conversation.findUnique({
        where: {
          userId_companyId: {
            userId: req.user.id,
            companyId: Number(companyId)
          }
        }
      });

      if (!conv) {
        conv = await prisma.conversation.create({
          data: {
            userId: req.user.id,
            companyId: Number(companyId)
          }
        });
      }
      conversationId = conv.id;
    } else if (req.user.role === "company") {
      if (!receiverId) return res.status(400).json({ success: false, message: "معرف المستخدم مطلوب" });

      let conv = await prisma.conversation.findUnique({
        where: {
          userId_companyId: {
            userId: Number(receiverId),
            companyId: req.user.companyId
          }
        }
      });

      if (!conv) {
        return res.status(404).json({ success: false, message: "المحادثة غير موجودة" });
      }
      conversationId = conv.id;
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: req.user.id,
        content
      }
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

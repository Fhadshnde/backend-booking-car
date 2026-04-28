import express from "express";
import { getConversations, getMessages, sendMessage } from "../controllers/chat.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/conversations", getConversations);
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/messages", sendMessage);

export default router;

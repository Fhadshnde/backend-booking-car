import express from "express";
import { createTicket, getTickets, getTicketDetails, replyToTicket, updateTicketStatus } from "../controllers/ticket.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createTicket);
router.get("/", getTickets);
router.get("/:id", getTicketDetails);
router.post("/:id/messages", replyToTicket);
router.put("/:id/status", restrictTo("admin"), updateTicketStatus);

export default router;

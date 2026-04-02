// file: routes/testMongo.js
import express from "express";
import mongoose from "mongoose";
const router = express.Router();

router.get("/mongo-test", async (req, res) => {
  try {
    const state = mongoose.connection.readyState; 
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    res.json({ connected: state === 1, state });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

export default router;
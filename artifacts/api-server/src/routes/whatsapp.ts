import { Router } from "express";
import { getStatus, disconnectWhatsApp, initWhatsApp, sendMessage } from "../lib/whatsapp";
import { requireAuth } from "../lib/auth";

const router = Router();

router.use(requireAuth);
router.use((req, res, next) => {
  const user = (req as any).user;
  if (user?.role === "student") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
});

interface BulkProgress {
  sending: boolean;
  total: number;
  sent: number;
  failed: number;
  errors: string[];
}

let bulkProgress: BulkProgress = {
  sending: false,
  total: 0,
  sent: 0,
  failed: 0,
  errors: [],
};

router.get("/status", (req, res) => {
  res.json(getStatus());
});

router.post("/connect", async (req, res) => {
  try {
    await initWhatsApp();
    res.json({ success: true, message: "Connecting started" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/disconnect", async (req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ success: true, message: "Disconnected successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/bulk-progress", (req, res) => {
  res.json(bulkProgress);
});

router.post("/send-bulk", async (req, res) => {
  const { messages } = req.body as { messages: { phone: string; message: string; studentName: string }[] };
  
  if (!messages || !Array.isArray(messages)) {
    res.status(450).json({ error: "Invalid messages array" });
    return;
  }
  
  const status = getStatus();
  if (status.status !== "connected") {
    res.status(450).json({ error: "WhatsApp is not connected. Please scan the QR code first." });
    return;
  }
  
  if (bulkProgress.sending) {
    res.status(450).json({ error: "A bulk sending operation is already in progress" });
    return;
  }
  
  bulkProgress = {
    sending: true,
    total: messages.length,
    sent: 0,
    failed: 0,
    errors: [],
  };
  
  (async () => {
    for (const item of messages) {
      if (!bulkProgress.sending) break;
      
      try {
        await sendMessage(item.phone, item.message);
        bulkProgress.sent++;
      } catch (err: any) {
        console.error(`Failed to send to ${item.studentName} (${item.phone}):`, err.message);
        bulkProgress.failed++;
        bulkProgress.errors.push(`${item.studentName}: ${err.message}`);
      }
      
      // Delay between 4 to 8 seconds to mimic human typing and avoid anti-spam detection
      const delay = 4000 + Math.random() * 4000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    bulkProgress.sending = false;
  })();
  
  res.json({ success: true, message: "Bulk sending started in the background" });
});

router.post("/stop-bulk", (req, res) => {
  bulkProgress.sending = false;
  res.json({ success: true, message: "Bulk sending stopped" });
});

export default router;

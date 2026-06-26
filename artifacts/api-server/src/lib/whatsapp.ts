import makeWASocket, { useMultiFileAuthState, DisconnectReason, WASocket } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import path from "node:path";
import fs from "node:fs";
import pino from "pino";

let sock: WASocket | null = null;
let qrCodeData: string | null = null;
let connectionStatus: "connecting" | "connected" | "disconnected" = "disconnected";

export async function initWhatsApp() {
  const authFolder = path.resolve(process.cwd(), "whatsapp_auth_info");
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }) as any
    });
    
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        try {
          qrCodeData = await QRCode.toDataURL(qr);
        } catch (err) {
          console.error("Failed to generate QR data URL", err);
        }
      }
      
      if (connection === "connecting") {
        connectionStatus = "connecting";
      }
      
      if (connection === "open") {
        connectionStatus = "connected";
        qrCodeData = null;
        console.log("WhatsApp connection is now open!");
      }
      
      if (connection === "close") {
        connectionStatus = "disconnected";
        qrCodeData = null;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || (lastDisconnect?.error as any)?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log("WhatsApp connection closed. Status Code:", statusCode, "Should reconnect:", shouldReconnect);
        
        if (shouldReconnect) {
          setTimeout(initWhatsApp, 5000);
        }
      }
    });
    
    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error("Error initializing WhatsApp connection:", err);
    connectionStatus = "disconnected";
  }
}

export function getStatus() {
  return {
    status: connectionStatus,
    qr: qrCodeData,
  };
}

export async function disconnectWhatsApp() {
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      console.error("Error logging out WhatsApp:", e);
    }
    sock = null;
  }
  const authFolder = path.resolve(process.cwd(), "whatsapp_auth_info");
  if (fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to clear auth folder:", e);
    }
  }
  qrCodeData = null;
  connectionStatus = "disconnected";
}

export async function sendMessage(phone: string, text: string) {
  if (!sock || connectionStatus !== "connected") {
    throw new Error("WhatsApp client is not connected");
  }
  
  const cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone) {
    throw new Error("Invalid phone number");
  }
  
  let formattedPhone = cleanPhone;
  if (formattedPhone.startsWith("0")) {
    formattedPhone = "92" + formattedPhone.slice(1);
  } else if (!formattedPhone.startsWith("92")) {
    formattedPhone = "92" + formattedPhone;
  }
  
  const jid = `${formattedPhone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

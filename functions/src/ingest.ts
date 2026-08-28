import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

interface IngestPayload {
  flowRateLpm: number;
  volumeLiters: number;
  wifiRssi?: number;
  batteryPercent?: number;
}

function isValidPayload(body: unknown): body is IngestPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.flowRateLpm === "number" && typeof b.volumeLiters === "number";
}

export const ingest = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const deviceKey = req.get("x-device-key");
  if (!deviceKey) {
    res.status(401).json({ error: "Missing x-device-key header" });
    return;
  }

  if (!isValidPayload(req.body)) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const db = getFirestore();
  const keyHash = hashKey(deviceKey);

  const deviceQuery = await db
    .collection("devices")
    .where("deviceKeyHash", "==", keyHash)
    .limit(1)
    .get();

  if (deviceQuery.empty) {
    res.status(401).json({ error: "Unknown device key" });
    return;
  }

  const deviceDoc = deviceQuery.docs[0];
  const { flowRateLpm, volumeLiters, wifiRssi, batteryPercent } = req.body as IngestPayload;
  const now = FieldValue.serverTimestamp();

  const readingRef = deviceDoc.ref.collection("readings").doc();

  await db.runTransaction(async (tx) => {
    tx.set(readingRef, {
      recordedAt: now,
      flowRateLpm,
      volumeLiters,
      wifiRssi: wifiRssi ?? null,
      batteryPercent: batteryPercent ?? null,
    });

    tx.update(deviceDoc.ref, {
      lastSeenAt: now,
      lastFlowRateLpm: flowRateLpm,
      lastWifiRssi: wifiRssi ?? null,
      lastBatteryPercent: batteryPercent ?? null,
    });
  });

  res.status(201).json({ ok: true });
});

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  limit,
  query,
  where,
  getDocs,
  getAggregateFromServer,
  sum,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import type { Device, Reading, WaterRateSettings } from "./types";

// สเกลปัจจุบันมีมิเตอร์เดียว: ดึง device แรกที่มีอยู่
export async function getPrimaryDeviceId(): Promise<string | null> {
  const snapshot = await getDocs(query(collection(db, "devices"), limit(1)));
  return snapshot.empty ? null : snapshot.docs[0].id;
}

export function subscribeDevice(
  deviceId: string,
  callback: (device: Device | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "devices", deviceId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const data = snap.data();
    callback({
      id: snap.id,
      name: data.name ?? "มิเตอร์น้ำหลัก",
      location: data.location ?? null,
      firmwareVersion: data.firmwareVersion ?? null,
      lastSeenAt: data.lastSeenAt ?? null,
      lastFlowRateLpm: data.lastFlowRateLpm ?? null,
      lastWifiRssi: data.lastWifiRssi ?? null,
      lastBatteryPercent: data.lastBatteryPercent ?? null,
    });
  });
}

export function subscribeLatestReadings(
  deviceId: string,
  maxPoints: number,
  callback: (readings: Reading[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "devices", deviceId, "readings"),
    orderBy("recordedAt", "desc"),
    limit(maxPoints)
  );

  return onSnapshot(q, (snapshot) => {
    const readings = snapshot.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          recordedAt: data.recordedAt as Timestamp,
          flowRateLpm: data.flowRateLpm ?? 0,
          volumeLiters: data.volumeLiters ?? 0,
          wifiRssi: data.wifiRssi ?? null,
          batteryPercent: data.batteryPercent ?? null,
        };
      })
      .reverse(); // เรียงเก่า -> ใหม่ สำหรับกราฟ
    callback(readings);
  });
}

export async function getVolumeSum(
  deviceId: string,
  start: Date,
  end: Date
): Promise<number> {
  const q = query(
    collection(db, "devices", deviceId, "readings"),
    where("recordedAt", ">=", Timestamp.fromDate(start)),
    where("recordedAt", "<", Timestamp.fromDate(end))
  );
  const snapshot = await getAggregateFromServer(q, {
    total: sum("volumeLiters"),
  });
  return snapshot.data().total ?? 0;
}

export function subscribeWaterRate(
  callback: (settings: WaterRateSettings) => void
): Unsubscribe {
  return onSnapshot(doc(db, "settings", "waterRate"), (snap) => {
    const data = snap.data();
    callback({
      pricePerCubicMeter: data?.pricePerCubicMeter ?? 18.0,
      updatedAt: data?.updatedAt ?? null,
    });
  });
}

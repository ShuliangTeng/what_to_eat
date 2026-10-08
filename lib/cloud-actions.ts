"use server";

import { createPairingCode, loadCloud, pushCloud, redeemPairingCode, type DirtyFlags } from "@/lib/cloud";
import type { AppData } from "@/lib/types";

export async function loadKitchen(today?: string) {
  return loadCloud(today);
}

export async function saveKitchen(data: AppData, dirty: DirtyFlags, previous: AppData | null) {
  await pushCloud(data, dirty, previous);
}

export async function issuePairingCode() {
  return createPairingCode();
}

export async function acceptPairingCode(code: string, confirmSwitch: boolean) {
  await redeemPairingCode(code, confirmSwitch);
}

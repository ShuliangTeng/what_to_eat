"use server";

import { createPairingCode, loadCloud, pushCloud, redeemPairingCode, type DirtyFlags, type LoadResult } from "@/lib/cloud";
import type { AppData } from "@/lib/types";

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "没有连上。";
}

export async function loadKitchen(today?: string): Promise<LoadResult | { kind: "error"; message: string }> {
  try {
    return await loadCloud(today);
  } catch (error) {
    return { kind: "error", message: messageOf(error) };
  }
}

export async function saveKitchen(data: AppData, dirty: DirtyFlags, previous: AppData | null) {
  try {
    await pushCloud(data, dirty, previous);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: messageOf(error) };
  }
}

export async function issuePairingCode() {
  try {
    return { ok: true as const, code: await createPairingCode() };
  } catch (error) {
    return { ok: false as const, message: messageOf(error) };
  }
}

export async function acceptPairingCode(code: string, confirmSwitch: boolean) {
  try {
    await redeemPairingCode(code, confirmSwitch);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: messageOf(error) };
  }
}

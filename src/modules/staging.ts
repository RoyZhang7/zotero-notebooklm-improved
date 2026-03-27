import type { StagedItem } from "../types";

export function stageItems(items: StagedItem[]): void {
  addon.data.stagedItems.clear();
  for (const item of items) {
    addon.data.stagedItems.set(item.itemId, item);
  }
  addon.data.stagedTimestamp = Date.now();
}

export function getStagedItems(): StagedItem[] {
  return Array.from(addon.data.stagedItems.values());
}

export function getStagedCount(): number {
  return addon.data.stagedItems.size;
}

export function isReady(): boolean {
  return addon.data.stagedItems.size > 0;
}

export function clearStaged(): void {
  addon.data.stagedItems.clear();
  addon.data.stagedTimestamp = null;
}

export function getStagedTimestamp(): number | null {
  return addon.data.stagedTimestamp;
}

export function isStagedAttachment(attachmentId: number): boolean {
  for (const item of addon.data.stagedItems.values()) {
    if (item.attachmentId === attachmentId) {
      return true;
    }
  }
  return false;
}

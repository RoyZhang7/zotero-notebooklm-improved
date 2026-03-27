import type { CollectionNode } from "../types";

export function getLibraries(): Array<{ id: number; name: string }> {
  const libraries: Array<{ id: number; name: string }> = [];
  for (const lib of Zotero.Libraries.getAll()) {
    libraries.push({
      id: lib.libraryID,
      name: lib.name,
    });
  }
  return libraries;
}

export async function getCollectionTree(
  libraryID: number,
): Promise<CollectionNode[]> {
  const allCollections = Zotero.Collections.getByLibrary(libraryID, true);
  const nodeMap = new Map<number, CollectionNode>();

  // First pass: create nodes
  for (const col of allCollections) {
    nodeMap.set(col.id, {
      id: col.id,
      name: col.name,
      level: 0,
      parentId: col.parentID || null,
      children: [],
      itemCount: col.getChildItems(true).length,
    });
  }

  // Second pass: build tree relationships and compute levels
  const roots: CollectionNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Third pass: compute levels via BFS
  function setLevels(nodes: CollectionNode[], level: number) {
    for (const node of nodes) {
      node.level = level;
      setLevels(node.children, level + 1);
    }
  }
  setLevels(roots, 0);

  // Sort children alphabetically at each level
  function sortChildren(nodes: CollectionNode[]) {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      sortChildren(node.children);
    }
  }
  sortChildren(roots);

  return roots;
}

/**
 * Flatten the collection tree into a list for display,
 * with indentation level preserved.
 */
export function flattenTree(roots: CollectionNode[]): CollectionNode[] {
  const result: CollectionNode[] = [];
  function walk(nodes: CollectionNode[]) {
    for (const node of nodes) {
      result.push(node);
      walk(node.children);
    }
  }
  walk(roots);
  return result;
}

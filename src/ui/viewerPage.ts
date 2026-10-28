const pages = new Map<string, number>();

export function rememberViewerPage(postId: string, index: number): void {
  pages.set(postId, index);
}

export function takeViewerPage(postId: string): number | undefined {
  const index = pages.get(postId);
  pages.delete(postId);
  return index;
}

/** Pure navigation history policy shared by Android Back handling and tests. */
function isDashboardRoute(route: string): boolean {
  const pathname = route.split("?")[0];
  return pathname === "/" || pathname === "/dashboard";
}

export function recordNativeRoute(history: string[], route: string): void {
  if (history[history.length - 1] === route) return;
  // Dashboard is a navigation root, not another page to revisit on Back.
  if (isDashboardRoute(route)) {
    history.splice(0, history.length, route);
    return;
  }
  const existing = history.lastIndexOf(route);
  if (existing >= 0) history.splice(existing + 1);
  else history.push(route);
}

export function popNativeRoute(history: string[], current: string): string | null {
  // The native Back event can arrive before the route-tracking effect runs.
  // Synchronize with the visible route before removing its history entry.
  recordNativeRoute(history, current);
  if (isDashboardRoute(current)) {
    history.splice(0, history.length, current);
    return null;
  }
  if (history.length > 1) {
    history.pop();
    return history[history.length - 1];
  }
  history.splice(0, history.length, "/");
  return "/";
}

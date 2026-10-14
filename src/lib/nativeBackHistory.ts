/** Pure navigation history policy shared by Android Back handling and tests. */
export function recordNativeRoute(history: string[], route: string): void {
  if (history[history.length - 1] === route) return;
  // Dashboard is a navigation root, not another page to revisit on Back.
  if (route === "/" || route === "/dashboard") {
    history.splice(0, history.length, route);
    return;
  }
  const existing = history.lastIndexOf(route);
  if (existing >= 0) history.splice(existing + 1);
  else history.push(route);
}

export function popNativeRoute(history: string[], current: string): string | null {
  if (current === "/" || current === "/dashboard") {
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

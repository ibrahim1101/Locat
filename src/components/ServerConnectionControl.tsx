import { useState } from "react";
import { Server } from "lucide-react";
import { NativeServerSetup } from "./NativeServerSetup";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { useServerConnection } from "@/state/connection";
export function ServerConnectionControl({ authenticated = false }: { authenticated?: boolean }) {
  const [open, setOpen] = useState(false);
  const connected = useServerConnection();
  return <><button type="button" onClick={() => setOpen(true)} className={`fixed left-3 z-40 flex min-h-11 items-center gap-2 rounded-xl border bg-background/95 px-3 text-xs shadow-lg ${authenticated ? "bottom-20 md:bottom-3" : "bottom-3"}`} aria-label="Connect to server"><Server className="h-4 w-4" /><span>{connected ? "Server connected" : "Connect to server"}</span></button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Server connection</DialogTitle><NativeServerSetup compact /></DialogContent></Dialog></>;
}

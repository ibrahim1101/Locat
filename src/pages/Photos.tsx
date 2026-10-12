import { AppShell, ModuleHeader } from "@/components/shell/AppShell";
import { LocalPhotoEditor } from "@/components/media/LocalPhotoEditor";
export default function Photos() {
  return <AppShell active="photos"><ModuleHeader title="Photos" tagline="Open and edit pictures on this device" /><main className="flex-1 overflow-y-auto p-4"><LocalPhotoEditor /></main></AppShell>;
}

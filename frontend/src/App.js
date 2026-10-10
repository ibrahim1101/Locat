import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AppShell } from "./locat-media-hub/AppShell";
import { AudioEngineProvider } from "./locat-media-hub/AudioEngine";
import MusicPlayerBar from "./locat-media-hub/MusicPlayerBar";

import HubHome from "./locat-media-hub/HubHome";
import CinemaLibrary from "./locat-media-hub/CinemaLibrary";
import CinemaPlayer from "./locat-media-hub/CinemaPlayer";
import SeriesLibrary from "./locat-media-hub/SeriesLibrary";
import MusicLibrary from "./locat-media-hub/MusicLibrary";
import EqualizerPage from "./locat-media-hub/EqualizerPage";
import PerformancePage from "./locat-media-hub/PerformancePage";
import IntegrationGuide from "./locat-media-hub/IntegrationGuide";

function App() {
  return (
    <AudioEngineProvider>
      <BrowserRouter>
        <AppShell bottomSlot={<MusicPlayerBar />}>
          <Routes>
            <Route path="/" element={<HubHome />} />
            <Route path="/cinema" element={<CinemaLibrary />} />
            <Route path="/cinema/series" element={<SeriesLibrary />} />
            <Route path="/cinema/:id" element={<CinemaPlayer />} />
            <Route path="/music" element={<MusicLibrary />} />
            <Route path="/music/eq" element={<EqualizerPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/integration" element={<IntegrationGuide />} />
          </Routes>
        </AppShell>
        <Toaster theme="dark" position="bottom-right"
                 toastOptions={{ className: "font-mono text-xs" }} />
      </BrowserRouter>
    </AudioEngineProvider>
  );
}

export default App;

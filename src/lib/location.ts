import { messagePayloadSchema, type MessagePayload } from "@contracts/messagePayload";
export type LocationPayload = Extract<MessagePayload, { type: "location" }>;

export function locationMapUrl(location: LocationPayload): string {
  const point = messagePayloadSchema.parse(location) as LocationPayload;
  return `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=16/${point.latitude}/${point.longitude}`;
}

// Called only after the user explicitly requests a one-time location preview.
// No watcher, background updates, or automatic transmission of coordinates.
export function captureLocation(geolocation: Geolocation | undefined = navigator.geolocation): Promise<LocationPayload> {
  if (!geolocation) return Promise.reject(new Error("Location is unavailable on this device. Use a browser with location permission enabled."));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(position => {
      try {
        resolve(messagePayloadSchema.parse({ type: "location", latitude: position.coords.latitude,
          longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy,
          capturedAt: Math.trunc(position.timestamp) }) as LocationPayload);
      } catch { reject(new Error("This device returned invalid location coordinates.")); }
    }, error => reject(new Error(error.code === 1 ? "Location permission was denied. No location was sent."
      : error.code === 3 ? "Location lookup timed out. Retry when GPS is available."
      : "Your location could not be determined. No location was sent.")),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
  });
}

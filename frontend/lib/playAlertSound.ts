export function playAlertSound(): void {
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  const audio = new Audio(`${baseUrl}/api/notificationalert.mp3`);
  void audio.play().catch(() => {
    // Playback can be blocked by browser or system audio settings.
  });
}

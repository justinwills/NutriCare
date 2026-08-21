export function playAlertSound(): void {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const audio = new Audio(`${baseUrl}/notificationalert.mp3`);
  void audio.play().catch(() => {
    // Playback can be blocked by browser or system audio settings.
  });
}

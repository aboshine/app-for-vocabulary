/** Korean text-to-speech with the browser's built-in voices (free, works offline on most phones). */
export function speakKorean(text: string, rate = 0.9): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = rate;
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("ko"));
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

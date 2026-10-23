import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SpeechController } from "../speechController";

function simulateGesture() {
  SpeechController.notifyUserGesture();
}

describe("TTS chunking", () => {
  beforeEach(() => {
    (SpeechController as any).userGestureActivated = true;
    (SpeechController as any).ttsQueue = [];
    (SpeechController as any).isTtsActive = false;
    vi.useFakeTimers();
    vi.spyOn(window.speechSynthesis, "speak").mockImplementation(() => {});
    vi.spyOn(window.speechSynthesis, "cancel").mockImplementation(() => {});
  });
  afterEach(() => {
    SpeechController.cancelSpeech();
    vi.restoreAllMocks();
    vi.useRealTimers();
    (SpeechController as any).userGestureActivated = false;
  });
  test("short text is NOT split", () => {
    const sc = SpeechController as any;
    const chunks = sc.splitTextIntoSentenceChunks("Hello world");
    expect(chunks).toHaveLength(1);
  });
  test("long text is split into chunks under 180 chars", () => {
    const long =
      "First sentence here. Second sentence follows. Third one is extra long. Fourth sentence keeps going. Fifth rounds it off perfectly.";
    const sc = SpeechController as any;
    const chunks = sc.splitTextIntoSentenceChunks(long);
    chunks.forEach((c: string) => expect(c.length).toBeLessThanOrEqual(180));
  });
});

describe("TTS voice selection", () => {
  const makeVoice = (name: string, lang: string) =>
    ({ name, lang, localService: true, default: false, voiceURI: name } as SpeechSynthesisVoice);
  beforeEach(() => {
    (SpeechController as any).availableVoices = [];
  });
  test("returns null for Tamil when no ta voice installed", () => {
    (SpeechController as any).availableVoices = [makeVoice("English US", "en-US")];
    const { voice } = SpeechController.selectBestVoice("ta");
    expect(voice).toBeNull();
  });
  test("picks ta-IN voice", () => {
    (SpeechController as any).availableVoices = [
      makeVoice("English US", "en-US"),
      makeVoice("Tamil India", "ta-IN"),
    ];
    const { voice } = SpeechController.selectBestVoice("ta");
    expect(voice?.lang).toBe("ta-IN");
  });
  test("picks hi-IN voice", () => {
    (SpeechController as any).availableVoices = [
      makeVoice("English US", "en-US"),
      makeVoice("Hindi India", "hi-IN"),
    ];
    const { voice } = SpeechController.selectBestVoice("hi");
    expect(voice?.lang).toBe("hi-IN");
  });
  test("falls back to any en-* for English", () => {
    (SpeechController as any).availableVoices = [makeVoice("English UK", "en-GB")];
    const { voice } = SpeechController.selectBestVoice("en");
    expect(voice).not.toBeNull();
  });
});

describe("TTS gesture gate", () => {
  beforeEach(() => {
    (SpeechController as any).userGestureActivated = false;
    (SpeechController as any).pendingGestureQueue = [];
    (SpeechController as any).ttsQueue = [];
    (SpeechController as any).isTtsActive = false;
    vi.useFakeTimers();
    vi.spyOn(window.speechSynthesis, "speak").mockImplementation(() => {});
    vi.spyOn(window.speechSynthesis, "cancel").mockImplementation(() => {});
  });
  afterEach(() => {
    SpeechController.cancelSpeech();
    vi.restoreAllMocks();
    vi.useRealTimers();
    (SpeechController as any).userGestureActivated = false;
    (SpeechController as any).pendingGestureQueue = [];
  });
  test("speak() before gesture queues into pendingGestureQueue", () => {
    SpeechController.speak("Hello world", "en");
    expect((SpeechController as any).pendingGestureQueue).toHaveLength(1);
    expect((SpeechController as any).ttsQueue).toHaveLength(0);
  });
  test("notifyUserGesture() clears pending queue", () => {
    SpeechController.speak("Hello world", "en");
    SpeechController.notifyUserGesture();
    expect((SpeechController as any).pendingGestureQueue).toHaveLength(0);
  });
  test("speak() after gesture does not queue into pendingGestureQueue", () => {
    simulateGesture();
    SpeechController.speak("Hello after gesture", "en");
    expect((SpeechController as any).pendingGestureQueue).toHaveLength(0);
  });
});

describe("TTS cancel", () => {
  beforeEach(() => {
    (SpeechController as any).userGestureActivated = true;
    vi.useFakeTimers();
    vi.spyOn(window.speechSynthesis, "speak").mockImplementation(() => {});
    vi.spyOn(window.speechSynthesis, "cancel").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    (SpeechController as any).userGestureActivated = false;
  });
  test("cancelSpeech increments generation and clears queue", () => {
    const prevGen: number = (SpeechController as any).ttsGeneration;
    SpeechController.cancelSpeech();
    expect((SpeechController as any).ttsGeneration).toBe(prevGen + 1);
    expect((SpeechController as any).ttsQueue).toHaveLength(0);
  });
  test("cancel calls window.speechSynthesis.cancel()", () => {
    const cancelSpy = vi.spyOn(window.speechSynthesis, "cancel");
    SpeechController.cancelSpeech();
    expect(cancelSpy).toHaveBeenCalled();
  });
});

describe("TTS deduplication", () => {
  beforeEach(() => {
    (SpeechController as any).userGestureActivated = true;
    (SpeechController as any).ttsQueue = [];
    (SpeechController as any).isTtsActive = false;
    (SpeechController as any).lastSpokenSource = "";
    (SpeechController as any).lastSpokenText = "";
    (SpeechController as any).lastSpokenTime = 0;
    vi.useFakeTimers();
    vi.spyOn(window.speechSynthesis, "speak").mockImplementation(() => {});
    vi.spyOn(window.speechSynthesis, "cancel").mockImplementation(() => {});
  });
  afterEach(() => {
    SpeechController.cancelSpeech();
    vi.restoreAllMocks();
    vi.useRealTimers();
    (SpeechController as any).userGestureActivated = false;
  });
  test("identical automated message within 4s calls onEnd without speaking again", () => {
    const onEnd = vi.fn();
    (SpeechController as any).lastSpokenSource = "gps";
    (SpeechController as any).lastSpokenText = "gps location set";
    (SpeechController as any).lastSpokenTime = Date.now();
    SpeechController.cancelSpeech();
    SpeechController.speak("gps location set", "en", onEnd, undefined, "gps");
    expect(onEnd).toHaveBeenCalled();
  });
});

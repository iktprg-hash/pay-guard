"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpeechOptions {
  locale: string;
  onResult: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
}

const LOCALE_MAP: Record<string, string> = {
  cs: "cs-CZ",
  ru: "ru-RU",
  en: "en-US",
};

/**
 * Web Speech API hook s interim výsledky a fallbackem.
 */
export function useSpeech({ locale, onResult, onInterim }: UseSpeechOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);

  onResultRef.current = onResult;
  onInterimRef.current = onInterim;

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = LOCALE_MAP[locale] ?? "cs-CZ";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += text;
        else interim += text;
      }

      if (interim) onInterimRef.current?.(interim);
      if (final) onResultRef.current(final);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsSupported(true);

    return () => recognition.stop();
  }, [locale]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.lang = LOCALE_MAP[locale] ?? "cs-CZ";
      setIsListening(true);
      recognitionRef.current.start();
    } catch {
      setIsListening(false);
    }
  }, [locale]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  return { isListening, isSupported, start, stop, toggle };
}

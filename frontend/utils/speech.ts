import { Platform } from 'react-native';
import * as ExpoSpeech from 'expo-speech';

// Cross-platform speech utility that works on web and native
class SpeechService {
  private isSpeaking: boolean = false;
  private speechSynthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this.speechSynthesis = window.speechSynthesis;
    }
  }

  async speak(text: string, options?: { rate?: number; pitch?: number; language?: string; onDone?: () => void; onError?: () => void }) {
    const rate = options?.rate || 0.9;
    const pitch = options?.pitch || 1.0;
    const language = options?.language || 'en-US';

    // Stop any current speech
    this.stop();

    if (Platform.OS === 'web' && this.speechSynthesis) {
      // Use Web Speech API for browser
      return new Promise<void>((resolve, reject) => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = rate;
          utterance.pitch = pitch;
          utterance.lang = language;
          
          utterance.onstart = () => {
            this.isSpeaking = true;
            console.log('Speech started:', text.substring(0, 50) + '...');
          };
          
          utterance.onend = () => {
            this.isSpeaking = false;
            this.currentUtterance = null;
            options?.onDone?.();
            resolve();
          };
          
          utterance.onerror = (event) => {
            console.error('Speech error:', event);
            this.isSpeaking = false;
            this.currentUtterance = null;
            options?.onError?.();
            reject(event);
          };

          this.currentUtterance = utterance;
          this.speechSynthesis!.speak(utterance);
        } catch (error) {
          console.error('Web Speech API error:', error);
          options?.onError?.();
          reject(error);
        }
      });
    } else {
      // Use Expo Speech for native
      try {
        this.isSpeaking = true;
        await ExpoSpeech.speak(text, {
          rate,
          pitch,
          language,
          onDone: () => {
            this.isSpeaking = false;
            options?.onDone?.();
          },
          onStopped: () => {
            this.isSpeaking = false;
          },
          onError: () => {
            this.isSpeaking = false;
            options?.onError?.();
          },
        });
      } catch (error) {
        console.error('Expo Speech error:', error);
        this.isSpeaking = false;
        options?.onError?.();
      }
    }
  }

  stop() {
    if (Platform.OS === 'web' && this.speechSynthesis) {
      this.speechSynthesis.cancel();
    } else {
      ExpoSpeech.stop();
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

// Export singleton instance
export const speechService = new SpeechService();

// Helper function for easy use
export const speak = (text: string, options?: { rate?: number; pitch?: number; language?: string; onDone?: () => void; onError?: () => void }) => {
  return speechService.speak(text, options);
};

export const stopSpeaking = () => {
  speechService.stop();
};

export const isSpeaking = () => {
  return speechService.getIsSpeaking();
};

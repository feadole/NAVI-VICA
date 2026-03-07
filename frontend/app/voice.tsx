import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

// Speech synthesis with proper error handling
const createSpeaker = () => {
  let isSpeaking = false;
  let currentUtterance: SpeechSynthesisUtterance | null = null;
  
  const speak = (text: string, rate: number = 0.9): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.speechSynthesis) {
        // Fallback for native
        import('expo-speech').then(Speech => {
          Speech.speak(text, { rate, pitch: 1.0, onDone: () => resolve() });
        }).catch(reject);
        return;
      }
      
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      
      utterance.onstart = () => {
        isSpeaking = true;
        console.log('Speech started');
      };
      
      utterance.onend = () => {
        isSpeaking = false;
        currentUtterance = null;
        console.log('Speech ended');
        resolve();
      };
      
      utterance.onerror = (event) => {
        console.error('Speech error:', event.error);
        isSpeaking = false;
        currentUtterance = null;
        // Don't reject, just resolve to continue flow
        resolve();
      };
      
      currentUtterance = utterance;
      
      // Wait for voices to be loaded
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        utterance.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
      }
      
      window.speechSynthesis.speak(utterance);
    });
  };
  
  const stop = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    } else {
      import('expo-speech').then(Speech => Speech.stop());
    }
    isSpeaking = false;
    currentUtterance = null;
  };
  
  const getIsSpeaking = () => isSpeaking;
  
  return { speak, stop, getIsSpeaking };
};

const speaker = createSpeaker();

export default function VoiceScreen() {
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      text: "Hello! I'm NAVI-VICA. Type a command or tap the microphone to speak.",
      timestamp: new Date(),
    },
  ]);
  const [lastResponse, setLastResponse] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const scrollViewRef = useRef<ScrollView>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  // Initialize speech recognition
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setVoiceSupported(true);
        
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;
        
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          console.log('Voice recognized:', transcript);
          setIsListening(false);
          isListeningRef.current = false;
          // Process the command
          handleVoiceResult(transcript);
        };
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          isListeningRef.current = false;
          
          if (event.error === 'not-allowed') {
            setMicPermission('denied');
            Alert.alert('Microphone Blocked', 'Please allow microphone access in your browser settings.');
          } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
            speaker.speak('Sorry, I could not hear you. Please try again.');
          }
        };
        
        recognition.onend = () => {
          console.log('Recognition ended');
          setIsListening(false);
          isListeningRef.current = false;
        };
        
        recognition.onaudiostart = () => {
          console.log('Audio capture started');
        };
        
        recognitionRef.current = recognition;
      }
      
      // Load voices
      window.speechSynthesis?.getVoices();
      window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
        window.speechSynthesis.getVoices();
      });
    }
    
    // Don't auto-speak welcome - wait for user interaction
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      speaker.stop();
    };
  }, []);

  const handleVoiceResult = useCallback((transcript: string) => {
    if (transcript.trim()) {
      processCommand(transcript);
    }
  }, []);

  const startListening = async () => {
    if (!recognitionRef.current) {
      speaker.speak('Voice input is not supported in this browser. Please type your command.');
      return;
    }
    
    // Stop any ongoing speech first
    speaker.stop();
    setIsSpeaking(false);
    
    // Small delay to ensure speech is stopped
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      setIsListening(true);
      isListeningRef.current = true;
      
      // Request microphone permission explicitly
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop()); // Release immediately
          setMicPermission('granted');
        } catch (err: any) {
          console.error('Mic permission error:', err);
          setMicPermission('denied');
          setIsListening(false);
          isListeningRef.current = false;
          Alert.alert('Microphone Access Required', 'Please allow microphone access to use voice commands.');
          return;
        }
      }
      
      recognitionRef.current.start();
      console.log('Recognition started');
      
    } catch (error: any) {
      console.error('Failed to start recognition:', error);
      setIsListening(false);
      isListeningRef.current = false;
      
      if (error.message?.includes('already started')) {
        // Already running, stop and restart
        recognitionRef.current.stop();
      } else {
        speaker.speak('Could not start voice recognition. Please type your command.');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Stop error:', e);
      }
    }
    setIsListening(false);
    isListeningRef.current = false;
  };

  const processCommand = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    Keyboard.dismiss();
    setIsProcessing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/process-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          context: 'voice_assistant',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process command');
      }

      const result = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        text: result.response_text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setLastResponse(result.response_text);

      // Speak the response
      setIsSpeaking(true);
      await speaker.speak(result.response_text);
      setIsSpeaking(false);

      // Handle navigation actions
      if (result.action) {
        setTimeout(() => {
          switch (result.action) {
            case 'open_camera':
              router.push('/camera');
              break;
            case 'open_meds':
              router.push('/meds');
              break;
            case 'open_settings':
              router.push('/settings');
              break;
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error processing command:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        text: "I'm sorry, I couldn't process that. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsSpeaking(true);
      await speaker.speak("I'm sorry, I couldn't process that. Please try again.");
      setIsSpeaking(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const speakLastResponse = async () => {
    if (lastResponse) {
      setIsSpeaking(true);
      await speaker.speak(lastResponse);
      setIsSpeaking(false);
    }
  };

  const quickCommands = [
    { text: 'What can you see?', icon: 'eye' },
    { text: 'Help me navigate', icon: 'navigate' },
    { text: 'Check my medications', icon: 'medical' },
    { text: 'What time is it?', icon: 'time' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {/* Status Indicators */}
        {isSpeaking && (
          <View style={styles.statusBanner}>
            <Ionicons name="volume-high" size={20} color="#00D9FF" />
            <Text style={styles.statusText}>Speaking...</Text>
            <TouchableOpacity onPress={() => { speaker.stop(); setIsSpeaking(false); }} style={styles.stopBtn}>
              <Text style={styles.stopBtnText}>STOP</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {isListening && (
          <View style={[styles.statusBanner, styles.listeningBanner]}>
            <Ionicons name="mic" size={20} color="#F44336" />
            <Text style={[styles.statusText, { color: '#F44336' }]}>Listening... Speak now!</Text>
          </View>
        )}

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesArea}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.bubble, msg.type === 'user' ? styles.userBubble : styles.assistantBubble]}
            >
              {msg.type === 'assistant' && (
                <View style={styles.assistantHeader}>
                  <Ionicons name="eye" size={14} color="#00D9FF" />
                  <Text style={styles.assistantName}>NAVI-VICA</Text>
                </View>
              )}
              <Text style={[styles.bubbleText, msg.type === 'user' && { color: '#000' }]}>
                {msg.text}
              </Text>
            </View>
          ))}
          {isProcessing && (
            <View style={styles.processingBox}>
              <ActivityIndicator size="small" color="#00D9FF" />
              <Text style={styles.processingText}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        {/* Last Response Player */}
        {lastResponse && (
          <TouchableOpacity style={styles.responsePlayer} onPress={speakLastResponse}>
            <Ionicons name="play-circle" size={24} color="#00D9FF" />
            <Text style={styles.responsePlayerText} numberOfLines={1}>{lastResponse}</Text>
          </TouchableOpacity>
        )}

        {/* Quick Commands */}
        <Text style={styles.quickLabel}>Quick Commands:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
          {quickCommands.map((cmd, i) => (
            <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => processCommand(cmd.text)}>
              <Ionicons name={cmd.icon as any} size={16} color="#00D9FF" />
              <Text style={styles.quickBtnText}>{cmd.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Voice Button */}
        <View style={styles.voiceSection}>
          <TouchableOpacity
            style={[styles.voiceBtn, isListening && styles.voiceBtnActive]}
            onPress={isListening ? stopListening : startListening}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isListening ? 'radio' : 'mic'}
              size={48}
              color={isListening ? '#fff' : '#00D9FF'}
            />
          </TouchableOpacity>
          <Text style={styles.voiceHint}>
            {isListening ? 'Tap to stop' : 'Tap to speak'}
          </Text>
          {!voiceSupported && (
            <Text style={styles.voiceWarning}>Voice not supported - use text input</Text>
          )}
          {micPermission === 'denied' && (
            <Text style={styles.voiceWarning}>Microphone blocked - check browser settings</Text>
          )}
        </View>

        {/* Text Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your command..."
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => processCommand(inputText)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => processCommand(inputText)}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  keyboardAvoid: { flex: 1 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3a5e',
    padding: 10,
  },
  listeningBanner: { backgroundColor: '#3a1a1e' },
  statusText: { color: '#00D9FF', marginLeft: 8, fontSize: 14, fontWeight: '600', flex: 1 },
  stopBtn: { backgroundColor: '#F44336', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  stopBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  messagesArea: { flex: 1 },
  messagesContent: { padding: 16 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 16, marginBottom: 12 },
  userBubble: { backgroundColor: '#00D9FF', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#1a1a2e', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  assistantHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  assistantName: { color: '#00D9FF', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  bubbleText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  processingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 12, borderRadius: 16, alignSelf: 'flex-start' },
  processingText: { color: '#888', marginLeft: 8, fontSize: 14 },
  responsePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  responsePlayerText: { flex: 1, color: '#888', fontSize: 13, marginLeft: 12 },
  quickLabel: { color: '#888', fontSize: 12, marginLeft: 16, marginBottom: 4 },
  quickScroll: { paddingHorizontal: 16, paddingVertical: 8 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  quickBtnText: { color: '#ccc', fontSize: 13, marginLeft: 8 },
  voiceSection: { alignItems: 'center', paddingVertical: 16 },
  voiceBtn: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00D9FF',
  },
  voiceBtnActive: { backgroundColor: '#F44336', borderColor: '#F44336' },
  voiceHint: { color: '#888', fontSize: 13, marginTop: 8 },
  voiceWarning: { color: '#F44336', fontSize: 11, marginTop: 4 },
  inputRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 },
  textInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    marginRight: 12,
  },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#00D9FF', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#333' },
});

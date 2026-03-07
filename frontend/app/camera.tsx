import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Cross-platform speech function
const speak = (text: string, rate: number = 0.9) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
    console.log('Speaking:', text);
  } else {
    // Native speech
    import('expo-speech').then(Speech => {
      Speech.speak(text, { rate, pitch: 1.0 });
    });
  }
};

interface Detection {
  class_name: string;
  confidence: number;
  bbox: number[];
  position: string;
}

interface AnalysisResult {
  id: string;
  detections: Detection[];
  ai_description: string;
  safety_warnings: string[];
  navigation_hints: string[];
}

export default function CameraScreen() {
  const params = useLocalSearchParams<{ profile?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [userProfile, setUserProfile] = useState(params.profile || 'general');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const autoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Welcome message after a short delay
    setTimeout(() => {
      speak('Scene analysis screen. Upload an image or start the camera to analyze your surroundings.');
    }, 500);
    
    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoMode && cameraActive) {
      autoIntervalRef.current = setInterval(() => {
        captureAndAnalyze();
      }, 5000);
    } else {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    }
    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
      }
    };
  }, [autoMode, cameraActive]);

  const pickImage = async () => {
    try {
      speak('Opening image picker.');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setCapturedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
        setCameraActive(false);
        await analyzeImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      speak('Failed to pick image. Please try again.');
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const startCamera = async () => {
    if (!permission?.granted) {
      speak('Requesting camera permission.');
      const result = await requestPermission();
      if (!result.granted) {
        speak('Camera permission is required to scan scenes.');
        Alert.alert('Permission Required', 'Camera permission is needed to scan scenes.');
        return;
      }
    }
    speak('Camera started. Tap the scan button to capture and analyze.');
    setCameraActive(true);
    setCapturedImage(null);
    setAnalysisResult(null);
  };

  const captureAndAnalyze = async () => {
    if (!cameraRef.current || isAnalyzing) return;

    try {
      speak('Capturing image.');
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (photo?.base64) {
        setCapturedImage(`data:image/jpeg;base64,${photo.base64}`);
        await analyzeImage(photo.base64);
      }
    } catch (error) {
      console.error('Error capturing:', error);
      speak('Failed to capture image. Please try again.');
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    speak('Analyzing scene with AI. Please wait.');

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-scene`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: base64,
          user_profile: userProfile,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result: AnalysisResult = await response.json();
      setAnalysisResult(result);

      // Build comprehensive speech - THIS IS THE KEY PART
      let speechText = '';
      
      // Announce detections count
      if (result.detections.length > 0) {
        speechText += `I detected ${result.detections.length} objects. `;
        const objectNames = result.detections.slice(0, 5).map(d => d.class_name).join(', ');
        speechText += `Including: ${objectNames}. `;
      } else {
        speechText += 'No specific objects detected. ';
      }
      
      // AI description - MOST IMPORTANT
      speechText += result.ai_description + ' ';
      
      // Safety warnings (important!)
      if (result.safety_warnings.length > 0) {
        speechText += 'Safety warnings: ' + result.safety_warnings.join('. ') + ' ';
      }
      
      // Navigation hints
      if (result.navigation_hints.length > 0) {
        speechText += 'Navigation tips: ' + result.navigation_hints.slice(0, 2).join('. ');
      }
      
      // SPEAK THE FULL RESULT
      console.log('Speaking analysis result:', speechText);
      setIsSpeaking(true);
      speak(speechText, 0.85);
      setTimeout(() => setIsSpeaking(false), 10000);
      
    } catch (error) {
      console.error('Analysis error:', error);
      speak('Sorry, I could not analyze the scene. Please check your connection and try again.');
      Alert.alert('Analysis Error', 'Could not analyze the scene. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const speakResult = () => {
    if (analysisResult) {
      let speechText = analysisResult.ai_description;
      if (analysisResult.safety_warnings.length > 0) {
        speechText += ' Warning: ' + analysisResult.safety_warnings.join('. ');
      }
      setIsSpeaking(true);
      speak(speechText);
      setTimeout(() => setIsSpeaking(false), 8000);
    } else {
      speak('No analysis results available. Please analyze an image first.');
    }
  };

  const profiles = [
    { key: 'general', label: 'General', icon: 'person' },
    { key: 'mobility', label: 'Mobility', icon: 'walk' },
    { key: 'vision', label: 'Vision', icon: 'eye' },
    { key: 'cognitive', label: 'Cognitive', icon: 'bulb' },
    { key: 'health', label: 'Health', icon: 'heart' },
  ];

  const handleProfileChange = (key: string) => {
    setUserProfile(key);
    const profile = profiles.find(p => p.key === key);
    speak(`Profile changed to ${profile?.label || key}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Speaking Indicator */}
        {isSpeaking && (
          <View style={styles.speakingBanner}>
            <Ionicons name="volume-high" size={20} color="#00D9FF" />
            <Text style={styles.speakingText}>NAVI-VICA is speaking...</Text>
          </View>
        )}

        {/* Profile Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.profileSelector}
        >
          {profiles.map((profile) => (
            <TouchableOpacity
              key={profile.key}
              style={[
                styles.profileButton,
                userProfile === profile.key && styles.profileButtonActive,
              ]}
              onPress={() => handleProfileChange(profile.key)}
              accessibilityLabel={`${profile.label} profile`}
            >
              <Ionicons
                name={profile.icon as any}
                size={20}
                color={userProfile === profile.key ? '#00D9FF' : '#888'}
              />
              <Text
                style={[
                  styles.profileButtonText,
                  userProfile === profile.key && styles.profileButtonTextActive,
                ]}
              >
                {profile.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Camera/Image View */}
        <View style={styles.cameraContainer}>
          {cameraActive ? (
            <View style={styles.cameraWrapper}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={facing}
              />
              <View style={styles.cameraOverlay}>
                <View style={styles.cameraStatusBar}>
                  <View style={styles.cameraLiveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                  {autoMode && (
                    <View style={styles.autoModeIndicator}>
                      <Ionicons name="refresh" size={16} color="#4CAF50" />
                      <Text style={styles.autoModeText}>AUTO</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : capturedImage ? (
            <Image source={{ uri: capturedImage }} style={styles.capturedImage} resizeMode="contain" />
          ) : (
            <TouchableOpacity style={styles.uploadArea} onPress={pickImage} accessibilityLabel="Upload image">
              <Ionicons name="image-outline" size={64} color="#666" />
              <Text style={styles.uploadText}>TAP TO UPLOAD IMAGE</Text>
              <Text style={styles.uploadSubtext}>JPG, PNG, WEBP supported</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Camera Controls */}
        <View style={styles.controlsContainer}>
          {!cameraActive ? (
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.controlButton} onPress={startCamera} accessibilityLabel="Start camera">
                <Ionicons name="camera" size={28} color="#00D9FF" />
                <Text style={styles.controlButtonText}>Start Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton} onPress={pickImage} accessibilityLabel="Upload image">
                <Ionicons name="images" size={28} color="#00D9FF" />
                <Text style={styles.controlButtonText}>Upload Image</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => {
                  setCameraActive(false);
                  speak('Camera stopped.');
                }}
                accessibilityLabel="Stop camera"
              >
                <Ionicons name="close" size={28} color="#F44336" />
                <Text style={styles.controlButtonText}>Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureButton, isAnalyzing && styles.captureButtonDisabled]}
                onPress={captureAndAnalyze}
                disabled={isAnalyzing}
                accessibilityLabel="Capture and analyze"
              >
                {isAnalyzing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="scan" size={36} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  autoMode && styles.controlButtonActive,
                ]}
                onPress={() => {
                  setAutoMode(!autoMode);
                  speak(autoMode ? 'Auto mode disabled.' : 'Auto mode enabled. Capturing every 5 seconds.');
                }}
                accessibilityLabel={`Auto mode ${autoMode ? 'on' : 'off'}`}
              >
                <Ionicons
                  name="refresh"
                  size={28}
                  color={autoMode ? '#4CAF50' : '#00D9FF'}
                />
                <Text style={styles.controlButtonText}>
                  Auto {autoMode ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Analysis Results */}
        {isAnalyzing && !analysisResult && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00D9FF" />
            <Text style={styles.loadingText}>Analyzing with YOLOv9 + Gemini AI...</Text>
          </View>
        )}

        {analysisResult && (
          <View style={styles.resultsContainer}>
            {/* Speak Button - Prominent */}
            <TouchableOpacity style={styles.speakResultButton} onPress={speakResult}>
              <Ionicons name="volume-high" size={24} color="#fff" />
              <Text style={styles.speakResultText}>TAP TO HEAR DESCRIPTION</Text>
            </TouchableOpacity>

            {/* Detections */}
            <View style={styles.resultSection}>
              <View style={styles.resultHeader}>
                <Ionicons name="locate" size={20} color="#00D9FF" />
                <Text style={styles.resultTitle}>Detection Results</Text>
                <Text style={styles.detectionCount}>
                  {analysisResult.detections.length} objects
                </Text>
              </View>
              {analysisResult.detections.length > 0 ? (
                <View style={styles.detectionsGrid}>
                  {analysisResult.detections.slice(0, 8).map((det, index) => (
                    <View key={index} style={styles.detectionChip}>
                      <Text style={styles.detectionName}>{det.class_name}</Text>
                      <Text style={styles.detectionConfidence}>
                        {Math.round(det.confidence * 100)}%
                      </Text>
                      <Text style={styles.detectionPosition}>{det.position}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDetectionsText}>No specific objects detected</Text>
              )}
            </View>

            {/* AI Description */}
            <View style={styles.resultSection}>
              <View style={styles.resultHeader}>
                <Ionicons name="chatbubble" size={20} color="#D900FF" />
                <Text style={styles.resultTitle}>AI Analysis</Text>
              </View>
              <Text style={styles.aiDescription}>{analysisResult.ai_description}</Text>
            </View>

            {/* Safety Warnings */}
            {analysisResult.safety_warnings.length > 0 && (
              <View style={[styles.resultSection, styles.warningSection]}>
                <View style={styles.resultHeader}>
                  <Ionicons name="warning" size={20} color="#F44336" />
                  <Text style={styles.resultTitle}>Safety Warnings</Text>
                </View>
                {analysisResult.safety_warnings.map((warning, index) => (
                  <Text key={index} style={styles.warningText}>
                    • {warning}
                  </Text>
                ))}
              </View>
            )}

            {/* Navigation Hints */}
            {analysisResult.navigation_hints.length > 0 && (
              <View style={styles.resultSection}>
                <View style={styles.resultHeader}>
                  <Ionicons name="navigate" size={20} color="#4CAF50" />
                  <Text style={styles.resultTitle}>Navigation Tips</Text>
                </View>
                {analysisResult.navigation_hints.map((hint, index) => (
                  <Text key={index} style={styles.hintText}>
                    • {hint}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  scrollView: {
    flex: 1,
  },
  speakingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3a5e',
    padding: 12,
  },
  speakingText: {
    color: '#00D9FF',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  profileSelector: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  profileButtonActive: {
    backgroundColor: '#1a3a5e',
    borderColor: '#00D9FF',
    borderWidth: 1,
  },
  profileButtonText: {
    color: '#888',
    marginLeft: 8,
    fontSize: 14,
  },
  profileButtonTextActive: {
    color: '#00D9FF',
  },
  cameraContainer: {
    marginHorizontal: 16,
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  cameraStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  cameraLiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F44336',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  autoModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  autoModeText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  capturedImage: {
    flex: 1,
  },
  uploadArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#333',
    margin: 16,
    borderRadius: 12,
  },
  uploadText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
  },
  uploadSubtext: {
    color: '#444',
    fontSize: 12,
    marginTop: 4,
  },
  controlsContainer: {
    padding: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    alignItems: 'center',
    padding: 12,
  },
  controlButtonActive: {
    backgroundColor: '#1a3a2e',
    borderRadius: 12,
  },
  controlButtonText: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00D9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: '#555',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  resultsContainer: {
    padding: 16,
  },
  speakResultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D9FF',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  speakResultText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  resultSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  warningSection: {
    backgroundColor: '#2a1a1e',
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  detectionCount: {
    color: '#00D9FF',
    fontSize: 12,
  },
  detectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detectionChip: {
    backgroundColor: '#2a2a4e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  detectionName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  detectionConfidence: {
    color: '#00D9FF',
    fontSize: 11,
  },
  detectionPosition: {
    color: '#888',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  noDetectionsText: {
    color: '#666',
    fontStyle: 'italic',
  },
  aiDescription: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
  },
  warningText: {
    color: '#F44336',
    fontSize: 14,
    marginBottom: 4,
  },
  hintText: {
    color: '#4CAF50',
    fontSize: 14,
    marginBottom: 4,
  },
});

// screens/coach/training/PlanProcessingScreen.js
import React, { useState, useEffect } from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import { Card, Button, ProgressBar, Text } from 'react-native-paper';
import DocumentProcessor from '../../../services/DocumentProcessor';
import PlatformUtils from '../../../utils/PlatformUtils';
import { COLORS, SPACING, TEXT_STYLES } from '../../../styles/themes';

const PlanProcessingScreen = ({ navigation, route }) => {
  const { documentId, onComplete } = route.params;
  const [processing, setProcessing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState(null);

  useEffect(() => {
    processDocument();
  }, []);

  const processDocument = async () => {
    try {
      setError(null);
      setProcessing(true);
      setProgress(0.1);
      setStatus(PlatformUtils.getLoadingMessage('processing'));

      // Check document processor health
      await new Promise(resolve => setTimeout(resolve, 500));
      const healthCheck = await DocumentProcessor.healthCheck();
      
      if (healthCheck.status !== 'healthy') {
        throw PlatformUtils.createError(
          'Document processor not ready',
          ['Try restarting the app', 'Check your internet connection']
        );
      }

      setProgress(0.3);
      setStatus('Analyzing document structure...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setProgress(0.5);
      setStatus('Extracting training content...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProgress(0.7);
      setStatus('Parsing training plan...');
      await new Promise(resolve => setTimeout(resolve, 800));

      // Process the actual document
      const trainingPlan = await DocumentProcessor.processTrainingPlan(documentId);
      
      setProgress(0.9);
      setStatus('Finalizing training plan...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProgress(1);
      setStatus('Processing complete!');

      // Show success message after a brief delay
      setTimeout(() => {
        Alert.alert(
          'Processing Complete!',
          `Training plan "${trainingPlan.title}" has been created successfully.\n\nSessions: ${trainingPlan.sessionsCount}\nDuration: ${trainingPlan.duration}\nDifficulty: ${trainingPlan.difficulty}`,
          [
            {
              text: 'View in Library',
              onPress: () => {
                if (onComplete) {
                  onComplete();
                } else {
                  navigation.navigate('TrainingPlanLibrary');
                }
              }
            }
          ]
        );
      }, 800);

    } catch (error) {
      console.error('Processing failed:', error);
      
      const platformError = PlatformUtils.handlePlatformError(error, 'Plan Processing');
      setError(platformError);
      setStatus('Processing failed');
      
      Alert.alert(
        'Processing Failed',
        `${platformError.message}\n\nSuggestions:\n${platformError.suggestions?.slice(0, 3).map(s => `• ${s}`).join('\n') || '• Try with a different file'}`,
        [
          {
            text: 'Try Again',
            onPress: () => processDocument()
          },
          {
            text: 'Go Back',
            onPress: () => navigation.goBack(),
            style: 'cancel'
          }
        ]
      );
    } finally {
      setProcessing(false);
    }
  };

  const getProgressColor = () => {
    if (error) return COLORS.error || '#f44336';
    if (progress === 1) return COLORS.success || '#4caf50';
    return COLORS.primary;
  };

  const getStatusIcon = () => {
    if (error) return '❌';
    if (progress === 1) return '✅';
    if (processing) return '⚡';
    return '📄';
  };

  return (
    <View style={styles.container}>
      <Card style={[styles.card, PlatformUtils.getPlatformStyles()]}>
        <Card.Content style={styles.cardContent}>
          <Text style={styles.title}>
            {getStatusIcon()} Processing Training Plan
          </Text>
          
          <View style={styles.progressContainer}>
            <ProgressBar 
              progress={progress}
              color={getProgressColor()}
              style={styles.progressBar}
            />
            <Text style={styles.progressText}>
              {Math.round(progress * 100)}% Complete
            </Text>
          </View>

          <Text style={[
            styles.status,
            error && styles.errorText
          ]}>
            {status}
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>What went wrong:</Text>
              <Text style={styles.errorMessage}>{error.message}</Text>
              
              {error.suggestions && error.suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>Try this:</Text>
                  {error.suggestions.slice(0, 3).map((suggestion, index) => (
                    <Text key={index} style={styles.suggestion}>
                      • {suggestion}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.platformInfo}>
            <Text style={styles.platformText}>
              {PlatformUtils.isWeb() ? '🌐 Web Platform' : '📱 Mobile Platform'}
            </Text>
          </View>

          {!processing && error && (
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={processDocument}
                style={[styles.button, styles.retryButton]}
                icon="refresh"
              >
                Try Again
              </Button>
              <Button
                mode="outlined"
                onPress={() => navigation.goBack()}
                style={[styles.button, styles.backButton]}
                icon="arrow-left"
              >
                Go Back
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>

      {processing && (
        <View style={styles.processingIndicator}>
          <Text style={styles.processingText}>
            {PlatformUtils.isWeb() 
              ? 'Processing in your browser...' 
              : 'Processing on your device...'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  card: {
    elevation: 4,
  },
  cardContent: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  title: {
    ...TEXT_STYLES.h2,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  progressBar: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    marginBottom: SPACING.md,
  },
  progressText: {
    ...TEXT_STYLES.subtitle,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  status: {
    ...TEXT_STYLES.body,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.error || '#f44336',
  },
  errorContainer: {
    width: '100%',
    padding: SPACING.md,
    backgroundColor: COLORS.errorBackground || '#ffebee',
    borderRadius: 8,
    marginTop: SPACING.md,
  },
  errorTitle: {
    ...TEXT_STYLES.subtitle,
    color: COLORS.error || '#f44336',
    marginBottom: SPACING.xs,
    fontWeight: 'bold',
  },
  errorMessage: {
    ...TEXT_STYLES.body,
    color: COLORS.error || '#f44336',
    marginBottom: SPACING.md,
  },
  suggestionsContainer: {
    marginTop: SPACING.sm,
  },
  suggestionsTitle: {
    ...TEXT_STYLES.caption,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
    color: COLORS.secondary,
  },
  suggestion: {
    ...TEXT_STYLES.caption,
    color: COLORS.secondary,
    marginBottom: SPACING.xs / 2,
  },
  platformInfo: {
    marginTop: SPACING.lg,
    padding: SPACING.sm,
    backgroundColor: COLORS.surfaceVariant || '#f5f5f5',
    borderRadius: 6,
  },
  platformText: {
    ...TEXT_STYLES.caption,
    textAlign: 'center',
    color: COLORS.secondary,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  button: {
    flex: 1,
  },
  retryButton: {
    marginRight: SPACING.sm,
  },
  backButton: {
    marginLeft: SPACING.sm,
  },
  processingIndicator: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  processingText: {
    ...TEXT_STYLES.caption,
    color: COLORS.secondary,
    fontStyle: 'italic',
  },
});

export default PlanProcessingScreen;
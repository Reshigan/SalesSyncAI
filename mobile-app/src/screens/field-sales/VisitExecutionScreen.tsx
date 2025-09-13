import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Title, Paragraph, Card } from 'react-native-paper';
import { theme } from '../../theme/theme';

const VisitExecutionScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Visit Execution</Title>
          <Paragraph>Customer visit execution with surveys and documentation coming soon...</Paragraph>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  card: {
    elevation: theme.elevation.small,
  },
});

export default VisitExecutionScreen;
/**
 * Reusable tooltip — tappable "?" badge that opens a small modal with text.
 * Designed mobile-first with a minimum 44x44 touch target.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, TYPO } from './design';

type Props = {
  text: string;
  size?: number;
  color?: string;
  testID?: string;
  title?: string;
};

export function Tooltip({ text, size = 14, color = COLORS.textMuted, testID, title }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.badge, { width: 24, height: 24 }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        testID={testID ?? 'tooltip-trigger'}
      >
        <Ionicons name="help-circle-outline" size={size} color={color} />
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.bg} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <Text style={styles.body}>{text}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.btn}>
              <Text style={styles.btnText}>OK</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  bg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 360, padding: 18, borderRadius: 14,
    backgroundColor: COLORS.deepVoid,
    borderWidth: 1, borderColor: COLORS.panelBorder,
    gap: 12,
  },
  title: {
    fontFamily: TYPO.monoBold, fontSize: 11, letterSpacing: 2,
    color: COLORS.amber,
  },
  body: {
    fontFamily: TYPO.label, fontSize: 14, lineHeight: 20,
    color: COLORS.textPrimary,
  },
  btn: {
    alignSelf: 'flex-end',
    borderWidth: 1, borderColor: COLORS.amber, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(245,176,65,0.08)',
  },
  btnText: {
    fontFamily: TYPO.labelBold, fontSize: 12, letterSpacing: 2,
    color: COLORS.amber,
  },
});

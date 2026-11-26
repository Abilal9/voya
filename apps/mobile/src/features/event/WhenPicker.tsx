import * as React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Text } from '@/components/ui';
import { BottomSheet, sheetText } from '@/features/settings/SettingsParts';
import { board, colors } from '@/theme';
import { Segments, clock, longDate } from './EventParts';

export type WhenField = 'Date' | 'Start time' | 'End time';

/** Keeps the end on the same evening as the start: 1:00 AM after a 7:00 PM start is the next day. */
export function alignEnd(start: Date, end: Date): Date {
  const out = new Date(start);
  out.setHours(end.getHours(), end.getMinutes(), 0, 0);
  if (out <= start) out.setDate(out.getDate() + 1);
  return out;
}

/** Moves the start's calendar date (keeping its time) and carries the end along. */
function withDate(start: Date, day: Date) {
  const next = new Date(start);
  next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
  return next;
}

/**
 * Date, start and end time in one sheet (18 "Date & time", EV02 Date / Start /
 * End). The end time is optional; an end earlier than the start runs past
 * midnight.
 */
export function WhenSheet({ visible, onClose, start, end, onChange, initial = 'Date' }: {
  visible: boolean; onClose: () => void; start: Date; end?: Date; initial?: WhenField;
  onChange: (start: Date, end: Date | undefined) => void;
}) {
  const [field, setField] = React.useState<WhenField>(initial);
  React.useEffect(() => { if (visible) setField(initial); }, [visible, initial]);
  const value = field === 'End time' ? (end ?? new Date(start.getTime() + 3 * 3600000)) : start;
  const set = (d: Date) => {
    if (field === 'Date') {
      const s = withDate(start, d);
      onChange(s, end ? alignEnd(s, end) : undefined);
    } else if (field === 'Start time') {
      const s = new Date(start);
      s.setHours(d.getHours(), d.getMinutes(), 0, 0);
      onChange(s, end ? alignEnd(s, end) : undefined);
    } else {
      onChange(start, alignEnd(start, d));
    }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheetText.title}>Date & time</Text>
      <Text style={sheetText.body}>{`${longDate(start.toISOString())}\n${end ? `${clock(start.toISOString())} – ${clock(end.toISOString())}` : clock(start.toISOString())}`}</Text>
      <Segments items={['Date', 'Start time', 'End time'] as const} value={field} onChange={setField} />
      <DateTimePicker
        value={value}
        mode={field === 'Date' ? 'date' : 'time'}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        minimumDate={field === 'Date' ? new Date() : undefined}
        minuteInterval={15}
        onChange={(_, d) => d && set(d)}
        textColor={colors.brand.plum}
      />
      {field === 'End time' ? (
        end ? (
          <Pressable accessibilityRole="button" onPress={() => onChange(start, undefined)} style={styles.link}>
            <Text style={styles.linkText}>No end time</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => onChange(start, alignEnd(start, value))} style={styles.link}>
            <Text style={styles.linkText}>Add this end time</Text>
          </Pressable>
        )
      ) : null}
      <View style={styles.done}><Button label="Done" onPress={onClose} /></View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', paddingVertical: board.inlineGap },
  linkText: { fontSize: board.subtleControl.fontSize, color: colors.brand.violet },
  done: { marginTop: board.inlineGap },
});

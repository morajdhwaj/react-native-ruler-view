import React, {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useReducer,
} from 'react';
import {
  Dimensions,
  View,
  Text,
  Animated,
  TextInput,
  Platform,
  Vibration,
  AccessibilityInfo,
} from 'react-native';
import type {
  NativeSyntheticEvent,
  NativeScrollEvent,
  FlatList,
} from 'react-native';
import { RulerPickerItem } from './RulerPickerItem';
import { RulerPickerProps } from '../utils/types';
import { PRESET_THEMES } from '../utils/theme';
import { calculateCurrentValue, getInitialOffset } from '../utils';
import { getStyles } from './RulerPicker.styles';

const { width: windowWidth } = Dimensions.get('window');

export const RulerPicker: React.FC<RulerPickerProps> = ({
  width = windowWidth,
  height = 300,
  min,
  max,
  step = 1,
  initialValue = min,
  fractionDigits = 1,
  unit = 'cm',
  indicatorHeight = 80,
  vertical = false,
  theme = 'light',
  hapticFeedback = false,
  animated = true,
  gapBetweenSteps = 10,
  shortStepHeight = 20,
  longStepHeight = 40,
  containerStyle,
  stepWidth = 2,
  valueTextStyle,
  unitTextStyle,
  decelerationRate = 'normal',
  showLabels = true,
  accessibility,
  onValueChange,
  onValueChangeEnd,
}: RulerPickerProps) => {
  // Validate props
  if (min >= max) {
    console.error('min must be less than max');
    return null;
  }

  if (initialValue < min || initialValue > max) {
    console.error('initialValue must be between min and max');
    return null;
  }

  const listRef = useRef<FlatList<number>>(null);
  const stepTextRef = useRef<TextInput>(null);
  const increasingRef = useRef(true);
  const prevValue = useRef<string>(initialValue.toFixed(fractionDigits));
  const prevMomentumValue = useRef<string>(
    initialValue.toFixed(fractionDigits)
  );
  const scrollPosition = useRef(new Animated.Value(0)).current;
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const activeTheme =
    typeof theme === 'string'
      ? PRESET_THEMES[theme as keyof typeof PRESET_THEMES]
      : theme;
  const itemAmount = Math.floor((max - min) / step);
  const arrData = useMemo(
    () => Array.from({ length: itemAmount + 1 }, (_, i) => i),
    [itemAmount]
  );

  const styles = getStyles(
    height,
    width,
    vertical,
    indicatorHeight,
    stepWidth,
    longStepHeight,
    activeTheme
  );

  const announceValue = useCallback(
    (value: string) => {
      if (accessibility?.enabled && accessibility.announceValues) {
        const announcement = accessibility.labelFormat
          ? accessibility.labelFormat.replace('${value}', value)
          : `Value: ${value}${unit}`;
        AccessibilityInfo.announceForAccessibility(announcement);
      }
    },
    [accessibility, unit]
  );

  const valueCallback: Animated.ValueListenerCallback = useCallback(
    ({ value }) => {
      const newStep = calculateCurrentValue(
        value,
        stepWidth,
        gapBetweenSteps,
        min,
        max,
        step,
        fractionDigits
      );

      if (parseFloat(newStep) > parseFloat(prevValue.current)) {
        increasingRef.current = true;
      } else if (parseFloat(newStep) < parseFloat(prevValue.current)) {
        increasingRef.current = false;
      }

      if (prevValue.current !== newStep) {
        if (hapticFeedback && Platform.OS !== 'web') {
          Vibration.vibrate(1);
        }
        onValueChange?.(parseFloat(newStep));
        stepTextRef.current?.setNativeProps({ text: newStep });
        announceValue(newStep);
      }
      forceUpdate(); // Forces a re-render

      prevValue.current = newStep;
    },
    [
      announceValue,
      fractionDigits,
      gapBetweenSteps,
      hapticFeedback,
      max,
      min,
      onValueChange,
      step,
      stepWidth,
    ]
  );

  useEffect(() => {
    scrollPosition.addListener(valueCallback);
    return () => scrollPosition.removeAllListeners();
  }, [scrollPosition, valueCallback]);

  useEffect(() => {
    const initialOffset = getInitialOffset(
      initialValue,
      min,
      step,
      stepWidth,
      gapBetweenSteps
    );
    listRef.current?.scrollToOffset({
      offset: initialOffset,
      animated: false,
    });
  }, [gapBetweenSteps, initialValue, min, step, stepWidth]);

  const scrollHandler = Animated.event(
    [
      {
        nativeEvent: {
          contentOffset: vertical
            ? { y: scrollPosition }
            : { x: scrollPosition },
        },
      },
    ],
    { useNativeDriver: true }
  );

  const renderSeparator = (value = 0) => {
    const separatorHeight = vertical ? value || height * 0.65 : undefined;

    const separatorWidth = vertical ? undefined : width * 0.472;

    return (
      <View
        style={{
          height: separatorHeight,
          width: separatorWidth,
        }}
      />
    );
  };

  const renderItem = useCallback(
    ({ item: index }: { item: number }) => {
      return (
        <RulerPickerItem
          isLast={index === arrData.length - 1}
          index={index}
          shortStepHeight={shortStepHeight}
          longStepHeight={longStepHeight}
          gapBetweenSteps={gapBetweenSteps}
          stepWidth={stepWidth}
          shortStepColor={activeTheme.shortStepColor}
          longStepColor={activeTheme.longStepColor}
          vertical={vertical}
          animated={animated}
        />
      );
    },
    [
      activeTheme,
      animated,
      arrData.length,
      gapBetweenSteps,
      longStepHeight,
      shortStepHeight,
      stepWidth,
      vertical,
    ]
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = vertical
        ? event.nativeEvent.contentOffset.y
        : event.nativeEvent.contentOffset.x;

      const newStep = calculateCurrentValue(
        offset,
        stepWidth,
        gapBetweenSteps,
        min,
        max,
        step,
        fractionDigits
      );

      if (prevMomentumValue.current !== newStep) {
        onValueChangeEnd?.(newStep);
        announceValue(newStep);
      }

      prevMomentumValue.current = newStep;
    },
    [
      announceValue,
      fractionDigits,
      gapBetweenSteps,
      stepWidth,
      max,
      min,
      onValueChangeEnd,
      step,
      vertical,
    ]
  );

  const getLabel = (value: string, color: string) => (
    <Text
      style={[
        styles.text,
        {
          color: color,
        },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
  );

  const getLabelNumber = () => (
    <View pointerEvents="none" style={[styles.displayTextContainer]}>
      {showLabels &&
        getLabel(
          parseInt(prevValue.current) - step * 2 >= min
            ? (parseInt(prevValue.current) - step * 2).toString()
            : '',
          'lightgray'
        )}

      {showLabels &&
        getLabel(
          parseInt(prevValue.current) - step >= min
            ? (parseInt(prevValue.current) - step).toString()
            : '',
          'gray'
        )}

      <View style={styles.selectedText}>
        <Text
          style={[styles.valueText, valueTextStyle]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {parseInt(prevValue.current).toFixed(fractionDigits)}{' '}
          {unit && <Text style={[styles.unitText, unitTextStyle]}>{unit}</Text>}
        </Text>
      </View>

      {showLabels &&
        getLabel(
          parseInt(prevValue.current) + step >= max + step
            ? ''
            : (parseInt(prevValue.current) + step).toString(),
          'gray'
        )}

      {showLabels &&
        getLabel(
          parseInt(prevValue.current) + step * 2 >= max + step
            ? ''
            : (parseInt(prevValue.current) + step * 2).toString(),
          'lightgray'
        )}
    </View>
  );

  return (
    <View
      style={styles.container}
      accessible={accessibility?.enabled}
      accessibilityRole="adjustable"
    >
      {getLabelNumber()}

      <Animated.FlatList
        ref={listRef}
        data={arrData}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        style={[styles.rulerContainer, containerStyle]}
        contentContainerStyle={styles.rulerContent}
        ListHeaderComponent={() => renderSeparator()}
        ListFooterComponent={() => renderSeparator(vertical ? height * 0.1 : 0)}
        onScroll={scrollHandler}
        onMomentumScrollEnd={onMomentumScrollEnd}
        snapToOffsets={arrData.map(
          (_, index) => index * (stepWidth + gapBetweenSteps)
        )}
        snapToAlignment="start"
        decelerationRate={decelerationRate}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        horizontal={!vertical}
        removeClippedSubviews={false} 
      />
      <View style={styles.indicator} />
    </View>
  );
};

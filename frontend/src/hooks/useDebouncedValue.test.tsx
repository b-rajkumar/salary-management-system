import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 200));

    expect(result.current).toBe('hello');
  });

  test('updates the debounced value only after the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 200),
      { initialProps: { v: 'a' } },
    );

    rerender({ v: 'ab' });
    expect(result.current).toBe('a');

    act(() => { jest.advanceTimersByTime(199); });
    expect(result.current).toBe('a');

    act(() => { jest.advanceTimersByTime(2); });
    expect(result.current).toBe('ab');
  });

  test('rapid changes only emit the last value', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 200),
      { initialProps: { v: 'a' } },
    );

    rerender({ v: 'ab' });
    act(() => { jest.advanceTimersByTime(100); });
    rerender({ v: 'abc' });
    act(() => { jest.advanceTimersByTime(100); });
    rerender({ v: 'abcd' });
    act(() => { jest.advanceTimersByTime(200); });

    expect(result.current).toBe('abcd');
  });
});

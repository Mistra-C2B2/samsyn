import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Returns a debounced version of the callback that delays invocation
 * until after `delay` milliseconds have elapsed since the last call.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
	callback: T,
	delay: number,
): T {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const callbackRef = useRef(callback);
	const delayRef = useRef(delay);

	// Update callback ref on each render
	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	// Update delay ref on each render
	useEffect(() => {
		delayRef.current = delay;
	}, [delay]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return useCallback(
		((...args: Parameters<T>) => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			timeoutRef.current = setTimeout(() => {
				callbackRef.current(...args);
			}, delayRef.current);
		}) as T,
		[],
	);
}

/**
 * Returns a debounced value that only updates after `delay` milliseconds
 * of no changes.
 */
export function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(timer);
		};
	}, [value, delay]);

	return debouncedValue;
}

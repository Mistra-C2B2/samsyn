import { useCallback, useState } from "react";
import type { Layer } from "../../App";
import type { LegendFormState, LegendItem } from "./types";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LEGEND_ITEMS: LegendItem[] = [
	{ label: "Low", color: "#3b82f6" },
	{ label: "High", color: "#ef4444" },
];

// ============================================================================
// Types
// ============================================================================

export interface UseLegendFormOptions {
	initialType?: "gradient" | "categorical";
	initialItems?: LegendItem[];
	initialSource?: "manual" | "wms";
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing legend configuration state.
 * Handles legend type, items, and WMS legend source.
 */
export function useLegendForm(options: UseLegendFormOptions = {}) {
	const {
		initialType = "gradient",
		initialItems = DEFAULT_LEGEND_ITEMS,
		initialSource = "manual",
	} = options;

	const [legendType, setLegendType] = useState<"gradient" | "categorical">(
		initialType,
	);
	const [legendItems, setLegendItems] = useState<LegendItem[]>(initialItems);
	const [legendSource, setLegendSource] = useState<"manual" | "wms">(
		initialSource,
	);
	const [wmsLegendUrl, setWmsLegendUrl] = useState<string | null>(null);
	const [legendImageError, setLegendImageError] = useState(false);

	const addItem = useCallback(() => {
		setLegendItems((prev) => [...prev, { label: "", color: "#6b7280" }]);
	}, []);

	const updateItem = useCallback(
		(index: number, field: "label" | "color", value: string) => {
			setLegendItems((prev) => {
				const updated = [...prev];
				updated[index] = { ...updated[index], [field]: value };
				return updated;
			});
		},
		[],
	);

	const removeItem = useCallback((index: number) => {
		setLegendItems((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const reset = useCallback(() => {
		setLegendType("gradient");
		setLegendItems([...DEFAULT_LEGEND_ITEMS]);
		setLegendSource("manual");
		setWmsLegendUrl(null);
		setLegendImageError(false);
	}, []);

	const setWmsLegend = useCallback((url: string | null) => {
		setWmsLegendUrl(url);
		setLegendImageError(false);
	}, []);

	const loadFromLayer = useCallback((layer: Layer) => {
		setLegendType(layer.legend?.type || "gradient");
		setLegendItems(
			layer.legend?.items?.map((item) => ({
				label: item.label,
				color: item.color,
			})) || [...DEFAULT_LEGEND_ITEMS],
		);
		// If layer has WMS legend URL, use it
		if (layer.wmsLegendUrl) {
			setLegendSource("wms");
			setWmsLegendUrl(layer.wmsLegendUrl);
		} else {
			setLegendSource("manual");
			setWmsLegendUrl(null);
		}
		setLegendImageError(false);
	}, []);

	const getState = useCallback((): LegendFormState => {
		return {
			type: legendType,
			items: legendItems,
			source: legendSource,
			wmsLegendUrl,
			imageError: legendImageError,
		};
	}, [legendType, legendItems, legendSource, wmsLegendUrl, legendImageError]);

	return {
		// State
		legendType,
		legendItems,
		legendSource,
		wmsLegendUrl,
		legendImageError,

		// Setters
		setLegendType,
		setLegendSource,
		setLegendImageError,
		setWmsLegend,

		// Item actions
		addItem,
		updateItem,
		removeItem,

		// Form actions
		reset,
		loadFromLayer,
		getState,
	};
}

export type UseLegendFormReturn = ReturnType<typeof useLegendForm>;

import type { LayerSource } from "../../hooks/admin-layer-form";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

// ============================================================================
// Types
// ============================================================================

interface LayerSourceSelectorProps {
	value: LayerSource;
	onChange: (value: LayerSource) => void;
	disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function LayerSourceSelector({
	value,
	onChange,
	disabled = false,
}: LayerSourceSelectorProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor="layerSource">Layer Source</Label>
			<Select
				value={value}
				onValueChange={(v) => onChange(v as LayerSource)}
				disabled={disabled}
			>
				<SelectTrigger id="layerSource">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="wms">WMS (Web Map Service)</SelectItem>
					<SelectItem value="geotiff">GeoTIFF / COG</SelectItem>
					<SelectItem value="vector">Vector (GeoJSON)</SelectItem>
				</SelectContent>
			</Select>
			<p className="text-xs text-slate-500 mt-1">
				{value === "wms" && "Connect to an external WMS service"}
				{value === "geotiff" && "Load a GeoTIFF or Cloud Optimized GeoTIFF"}
				{value === "vector" && "Import vector data from GeoJSON"}
			</p>
		</div>
	);
}

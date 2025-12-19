import { Input } from "../ui/input";
import { Label } from "../ui/label";

// ============================================================================
// Types
// ============================================================================

interface GeoTiffLayerFormProps {
	url: string;
	onUrlChange: (url: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function GeoTiffLayerForm({ url, onUrlChange }: GeoTiffLayerFormProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor="geotiffUrl">GeoTIFF URL</Label>
			<Input
				id="geotiffUrl"
				value={url}
				onChange={(e) => onUrlChange(e.target.value)}
				placeholder="https://example.com/data.tif"
			/>
			<p className="text-xs text-slate-500 mt-1">
				Must be a publicly accessible URL to a GeoTIFF or COG file
			</p>
		</div>
	);
}

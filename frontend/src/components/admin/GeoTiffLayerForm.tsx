import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import {
	GEOTIFF_COLORMAPS,
	type UseGeoTiffFormReturn,
} from "../../hooks/admin-layer-form/useGeoTiffForm";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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

interface GeoTiffLayerFormProps {
	form: UseGeoTiffFormReturn;
	onColormapChange?: (colormap: string) => void;
	onRescaleMinChange?: (rescaleMin: string) => void;
	onRescaleMaxChange?: (rescaleMax: string) => void;
	onInfoFetched?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function GeoTiffLayerForm({
	form,
	onColormapChange,
	onRescaleMinChange,
	onRescaleMaxChange,
	onInfoFetched,
}: GeoTiffLayerFormProps) {
	const {
		url,
		colormap,
		rescaleMin,
		rescaleMax,
		info,
		isLoading,
		error,
		setUrl,
		setColormap,
		setRescaleMin,
		setRescaleMax,
		fetchInfo,
		getPreviewUrl,
	} = form;

	const handleFetchInfo = async () => {
		await fetchInfo(url);
		// Sync legend after info is fetched (which updates rescale values)
		onInfoFetched?.();
	};

	const handleColormapChange = (value: string) => {
		if (onColormapChange) {
			onColormapChange(value);
		} else {
			setColormap(value);
		}
	};

	const handleRescaleMinChange = (value: string) => {
		if (onRescaleMinChange) {
			onRescaleMinChange(value);
		} else {
			setRescaleMin(value);
		}
	};

	const handleRescaleMaxChange = (value: string) => {
		if (onRescaleMaxChange) {
			onRescaleMaxChange(value);
		} else {
			setRescaleMax(value);
		}
	};

	const previewUrl = getPreviewUrl();

	return (
		<div className="space-y-4">
			{/* URL Input with Fetch Button */}
			<div className="space-y-2">
				<Label htmlFor="geotiffUrl">GeoTIFF URL</Label>
				<div className="flex gap-2">
					<Input
						id="geotiffUrl"
						value={url}
						onChange={(e) => setUrl(e.target.value.trim())}
						placeholder="https://example.com/data.tif"
						className="flex-1"
					/>
					<Button
						type="button"
						variant="outline"
						onClick={handleFetchInfo}
						disabled={!url || isLoading}
					>
						{isLoading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
						<span className="ml-2">Fetch Info</span>
					</Button>
				</div>
				<p className="text-xs text-slate-500">
					Enter a publicly accessible URL to a GeoTIFF or Cloud-Optimized
					GeoTIFF (COG) file
				</p>
			</div>

			{/* Error Display */}
			{error && (
				<div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
					<AlertCircle className="h-4 w-4 flex-shrink-0" />
					<span>{error}</span>
				</div>
			)}

			{/* Info Display */}
			{info && (
				<div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm space-y-1">
					<div className="font-medium text-slate-700 mb-2">
						GeoTIFF Information
					</div>
					<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
						<span>Dimensions:</span>
						<span className="font-mono">
							{info.width} x {info.height} px
						</span>
						<span>Bands:</span>
						<span className="font-mono">{info.bandCount}</span>
						<span>Data Type:</span>
						<span className="font-mono">{info.dtype}</span>
						<span>Zoom Range:</span>
						<span className="font-mono">
							{info.minzoom} - {info.maxzoom}
						</span>
						{info.nodata !== null && (
							<>
								<span>NoData:</span>
								<span className="font-mono">{info.nodata}</span>
							</>
						)}
					</div>
					{info.bounds && (
						<div className="mt-2 pt-2 border-t border-slate-200">
							<span className="text-slate-600">Bounds: </span>
							<span className="font-mono text-xs">
								[{info.bounds.map((b) => b.toFixed(4)).join(", ")}]
							</span>
						</div>
					)}
				</div>
			)}

			{/* Colormap Selection */}
			<div className="space-y-2">
				<Label htmlFor="colormap">Colormap</Label>
				<Select value={colormap} onValueChange={handleColormapChange}>
					<SelectTrigger id="colormap">
						<SelectValue placeholder="Select a colormap" />
					</SelectTrigger>
					<SelectContent>
						{GEOTIFF_COLORMAPS.map((cm) => (
							<SelectItem key={cm.value || "default"} value={cm.value || " "}>
								{cm.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-xs text-slate-500">
					Choose a color scheme for visualizing the data
				</p>
			</div>

			{/* Rescale Inputs */}
			<div className="space-y-2">
				<Label>Rescale Range</Label>
				<div className="flex gap-2 items-center">
					<div className="flex-1">
						<Input
							type="number"
							value={rescaleMin}
							onChange={(e) => handleRescaleMinChange(e.target.value)}
							placeholder="Min"
						/>
					</div>
					<span className="text-slate-400">to</span>
					<div className="flex-1">
						<Input
							type="number"
							value={rescaleMax}
							onChange={(e) => handleRescaleMaxChange(e.target.value)}
							placeholder="Max"
						/>
					</div>
				</div>
				<p className="text-xs text-slate-500">
					Map data values to display range. Click "Fetch Info" to auto-detect
					optimal values.
				</p>
			</div>

			{/* Preview */}
			{previewUrl && url && (
				<div className="space-y-2">
					<Label>Preview</Label>
					<div className="relative border border-slate-200 rounded-md overflow-hidden bg-slate-100">
						<img
							src={previewUrl}
							alt="GeoTIFF preview"
							className="w-full h-auto max-h-48 object-contain"
							onError={(e) => {
								const target = e.target as HTMLImageElement;
								target.style.display = "none";
								const parent = target.parentElement;
								if (parent) {
									const errorDiv = document.createElement("div");
									errorDiv.className = "p-4 text-center text-slate-500 text-sm";
									errorDiv.textContent =
										"Preview not available. Configure TiTiler URL in backend.";
									parent.appendChild(errorDiv);
								}
							}}
						/>
					</div>
					<p className="text-xs text-slate-500">
						Preview shows the full extent with current colormap and rescale
						settings
					</p>
				</div>
			)}
		</div>
	);
}

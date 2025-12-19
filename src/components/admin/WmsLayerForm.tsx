import { Database, Loader2, Search, X } from "lucide-react";
import type { WmsLayerInfo } from "../../hooks/admin-layer-form";
import type { WmsServer } from "../../services/wmsServerService";
import { Badge } from "../ui/badge";
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
import { Textarea } from "../ui/textarea";

// ============================================================================
// Types
// ============================================================================

interface WmsLayerFormProps {
	// URL and layer
	url: string;
	layerName: string;
	onUrlChange: (url: string) => void;
	onLayerNameChange: (name: string) => void;

	// Discovery
	availableLayers: WmsLayerInfo[];
	fetchingCapabilities: boolean;
	error: string | null;
	layerFilter: string;
	onLayerFilterChange: (filter: string) => void;
	onFetchCapabilities: () => void;
	onSelectLayer: (layerName: string) => void;

	// Style
	style: string;
	availableStyles: Array<{ name: string; title: string; legendUrl?: string }>;
	onStyleChange: (style: string) => void;

	// Service info
	version: "1.1.1" | "1.3.0" | null;
	crs: string[];
	getMapFormats: string[];

	// Time dimension
	timeDimension: { extent: string; default?: string } | null;

	// CQL Filter
	cqlFilter: string;
	onCqlFilterChange: (filter: string) => void;
	discoveredProperties: Array<{
		name: string;
		sampleValue: string | null;
		type: string;
	}>;
	discoveringProperties: boolean;
	onDiscoverProperties: () => void;
	onAddPropertyToFilter: (property: {
		name: string;
		sampleValue: string | null;
	}) => void;

	// Optional: WMS server integration
	wmsServers?: WmsServer[];
	onSelectFromServer?: (server: WmsServer) => void;
}

// ============================================================================
// Component
// ============================================================================

export function WmsLayerForm({
	url,
	layerName,
	onUrlChange,
	onLayerNameChange,
	availableLayers,
	fetchingCapabilities,
	error,
	layerFilter,
	onLayerFilterChange,
	onFetchCapabilities,
	onSelectLayer,
	style,
	availableStyles,
	onStyleChange,
	version,
	crs,
	getMapFormats,
	timeDimension,
	cqlFilter,
	onCqlFilterChange,
	discoveredProperties,
	discoveringProperties,
	onDiscoverProperties,
	onAddPropertyToFilter,
	wmsServers,
	onSelectFromServer,
}: WmsLayerFormProps) {
	// Filter layers based on search
	const filteredLayers = availableLayers.filter((layer) => {
		if (!layerFilter.trim()) return true;
		const filter = layerFilter.toLowerCase();
		return (
			layer.name.toLowerCase().includes(filter) ||
			layer.title.toLowerCase().includes(filter) ||
			(layer.abstract?.toLowerCase().includes(filter) ?? false)
		);
	});

	return (
		<>
			{/* Saved WMS Servers (optional) */}
			{wmsServers && wmsServers.length > 0 && onSelectFromServer && (
				<div className="space-y-2">
					<Label>Select from Saved Servers</Label>
					<div className="flex flex-wrap gap-2">
						{wmsServers.slice(0, 5).map((server) => (
							<Button
								key={server.id}
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onSelectFromServer(server)}
								className="text-xs"
							>
								<Database className="w-3 h-3 mr-1" />
								{server.name}
								<span className="ml-1 text-slate-400">
									({server.layerCount})
								</span>
							</Button>
						))}
					</div>
					{wmsServers.length > 5 && (
						<p className="text-xs text-slate-500">
							+{wmsServers.length - 5} more servers available in WMS Servers tab
						</p>
					)}
					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t border-slate-200" />
						</div>
						<div className="relative flex justify-center text-xs">
							<span className="bg-white px-2 text-slate-500">
								or enter URL manually
							</span>
						</div>
					</div>
				</div>
			)}

			{/* WMS URL Input */}
			<div className="space-y-2">
				<Label htmlFor="wmsUrl">WMS Service URL</Label>
				<div className="flex gap-2">
					<Input
						id="wmsUrl"
						value={url}
						onChange={(e) => onUrlChange(e.target.value)}
						placeholder="https://example.com/wms"
						className="flex-1"
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onFetchCapabilities}
						disabled={!url.trim() || fetchingCapabilities}
					>
						{fetchingCapabilities ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Search className="w-4 h-4" />
						)}
					</Button>
				</div>
				<p className="text-xs text-slate-500">
					Enter URL and click search to discover available layers
				</p>
			</div>

			{/* Error message */}
			{error && (
				<div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
					{error}
				</div>
			)}

			{/* Layer selection with filter */}
			{availableLayers.length > 0 && (
				<div className="space-y-2">
					<Label>Available Layers ({availableLayers.length})</Label>
					{/* Filter input */}
					<div className="relative">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
						<Input
							value={layerFilter}
							onChange={(e) => onLayerFilterChange(e.target.value)}
							placeholder="Filter layers..."
							className="pl-8"
						/>
						{layerFilter && (
							<Button
								variant="ghost"
								size="sm"
								className="absolute right-1 top-1 h-6 w-6 p-0"
								onClick={() => onLayerFilterChange("")}
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>
					{/* Filtered layer list */}
					<div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md">
						{filteredLayers.map((layer) => {
							const hasTimeDimension = layer.dimensions.some(
								(d) => d.name.toLowerCase() === "time",
							);
							return (
								<button
									key={layer.name}
									type="button"
									onClick={() => onSelectLayer(layer.name)}
									className={`w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 ${
										layerName === layer.name ? "bg-teal-50" : ""
									}`}
								>
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">
											{layer.title || layer.name}
										</span>
										{hasTimeDimension && (
											<Badge
												variant="outline"
												className="text-xs bg-blue-50 text-blue-700 border-blue-200"
											>
												Temporal
											</Badge>
										)}
									</div>
									{layer.title !== layer.name && (
										<div className="text-xs text-slate-500">{layer.name}</div>
									)}
									{layer.abstract && (
										<div className="text-xs text-slate-400 mt-1 line-clamp-2">
											{layer.abstract}
										</div>
									)}
								</button>
							);
						})}
						{filteredLayers.length === 0 && (
							<div className="px-3 py-4 text-sm text-slate-500 text-center">
								No layers match "{layerFilter}"
							</div>
						)}
					</div>
				</div>
			)}

			{/* Manual layer name input */}
			<div className="space-y-2">
				<Label htmlFor="wmsLayerName">
					Layer Name {availableLayers.length > 0 && "(or enter manually)"}
				</Label>
				<Input
					id="wmsLayerName"
					value={layerName}
					onChange={(e) => onLayerNameChange(e.target.value)}
					placeholder="layer_name"
				/>
			</div>

			{/* Style selection dropdown */}
			{availableStyles.length > 1 && (
				<div className="space-y-2">
					<Label htmlFor="wmsStyle">Style</Label>
					<Select value={style} onValueChange={onStyleChange}>
						<SelectTrigger id="wmsStyle">
							<SelectValue placeholder="Select style" />
						</SelectTrigger>
						<SelectContent>
							{availableStyles.map((s) => (
								<SelectItem key={s.name} value={s.name}>
									{s.title || s.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			{/* WMS Service Info */}
			{version && layerName && (
				<div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
					<div className="flex items-center gap-2 mb-2">
						<span className="font-medium text-slate-700">WMS Version:</span>
						<Badge variant="outline" className="text-xs">
							{version}
						</Badge>
					</div>
					{crs.length > 0 && (
						<div className="text-xs text-slate-500">
							<span className="font-medium">Supported CRS:</span>{" "}
							{crs.slice(0, 3).join(", ")}
							{crs.length > 3 && ` +${crs.length - 3} more`}
						</div>
					)}
					{getMapFormats.length > 0 && (
						<div className="text-xs text-slate-500 mt-1">
							<span className="font-medium">Formats:</span>{" "}
							{getMapFormats
								.filter((f) => f.includes("image/"))
								.slice(0, 3)
								.map((f) => f.replace("image/", ""))
								.join(", ")}
						</div>
					)}
				</div>
			)}

			{/* Temporal dimension info */}
			{timeDimension && (
				<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
					<div className="flex items-center gap-2 text-sm font-medium text-blue-800">
						<svg
							className="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						Temporal Layer Detected
					</div>
					<p className="text-xs text-blue-700 mt-1">
						Time range: {timeDimension.extent}
					</p>
					<p className="text-xs text-blue-600 mt-1">
						This layer supports time-based filtering. The TimeSlider will appear
						when added to a map.
					</p>
				</div>
			)}

			{/* CQL Filter */}
			{layerName && (
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label htmlFor="wmsCqlFilter">CQL Filter (optional)</Label>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onDiscoverProperties}
							disabled={discoveringProperties}
							className="text-xs h-7"
						>
							{discoveringProperties ? (
								<>
									<Loader2 className="w-3 h-3 mr-1 animate-spin" />
									Discovering...
								</>
							) : (
								<>
									<Search className="w-3 h-3 mr-1" />
									Discover Properties
								</>
							)}
						</Button>
					</div>
					<Textarea
						id="wmsCqlFilter"
						value={cqlFilter}
						onChange={(e) => onCqlFilterChange(e.target.value)}
						placeholder="e.g. category_column='All' AND category='All'"
						rows={2}
						className="font-mono text-xs"
					/>

					{/* Discovered properties */}
					{discoveredProperties.length > 0 && (
						<div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
							<p className="text-xs font-medium text-slate-700 mb-2">
								Available Properties (click to add):
							</p>
							<div className="flex flex-wrap gap-1">
								{discoveredProperties.map((prop) => (
									<button
										key={prop.name}
										type="button"
										onClick={() => onAddPropertyToFilter(prop)}
										className="inline-flex items-center px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
										title={`Sample value: ${prop.sampleValue ?? "null"}`}
									>
										<span className="font-mono text-slate-700">
											{prop.name}
										</span>
										{prop.sampleValue && (
											<span className="ml-1 text-slate-400">
												= "{prop.sampleValue}"
											</span>
										)}
									</button>
								))}
							</div>
							<p className="text-xs text-slate-400 mt-2">
								Sample values shown. Modify as needed.
							</p>
						</div>
					)}

					<p className="text-xs text-slate-500">
						Server-side filter expression (GeoServer CQL). Click "Discover
						Properties" to find available filter fields.
					</p>
				</div>
			)}
		</>
	);
}

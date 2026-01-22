import { Clock, Layers, Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { WmsServer } from "@/services/wmsServerService";
import type { WmsLayerInfo, WmsServerLayersResponse } from "@/types/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface WmsServerLayerBrowserProps {
	server: WmsServer;
	onSelectLayer: (server: WmsServer, layer: WmsLayerInfo) => void;
	onBack: () => void;
	onLoadLayers: (serverId: string) => Promise<WmsServerLayersResponse>;
}

export function WmsServerLayerBrowser({
	server,
	onSelectLayer,
	onBack,
	onLoadLayers,
}: WmsServerLayerBrowserProps) {
	const [layers, setLayers] = useState<WmsLayerInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState("");

	useEffect(() => {
		const loadLayers = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await onLoadLayers(server.id);
				setLayers(response.layers);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load layers");
			} finally {
				setLoading(false);
			}
		};

		loadLayers();
	}, [server.id, onLoadLayers]);

	const filteredLayers = layers.filter((layer) => {
		if (!filter.trim()) return true;
		const searchLower = filter.toLowerCase();
		return (
			layer.name.toLowerCase().includes(searchLower) ||
			(layer.title?.toLowerCase().includes(searchLower) ?? false) ||
			(layer.abstract?.toLowerCase().includes(searchLower) ?? false)
		);
	});

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="px-4 py-3 border-b border-slate-200">
				<Button variant="outline" onClick={onBack} size="sm">
					← Back to Servers
				</Button>
			</div>

			{/* Server Info */}
			<div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
				<h3 className="font-medium text-slate-900 truncate">{server.name}</h3>
				<p className="text-xs text-slate-500 truncate">{server.baseUrl}</p>
				<div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
					<Layers className="w-3 h-3" />
					<span>{layers.length} layers available</span>
				</div>
			</div>

			{/* Search */}
			<div className="px-4 py-3 border-b border-slate-200">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
					<Input
						type="text"
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						placeholder="Search layers..."
						className="pl-9 text-sm"
					/>
				</div>
			</div>

			{/* Layer List */}
			<div className="flex-1 overflow-y-auto">
				{loading ? (
					<div className="flex items-center justify-center p-8">
						<Loader2 className="w-6 h-6 animate-spin text-slate-400" />
					</div>
				) : error ? (
					<div className="flex flex-col items-center justify-center p-8 text-center">
						<p className="text-sm text-red-600 mb-4">{error}</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setLoading(true);
								setError(null);
								onLoadLayers(server.id)
									.then((response) => setLayers(response.layers))
									.catch((err) =>
										setError(
											err instanceof Error
												? err.message
												: "Failed to load layers",
										),
									)
									.finally(() => setLoading(false));
							}}
						>
							Retry
						</Button>
					</div>
				) : filteredLayers.length === 0 ? (
					<div className="flex items-center justify-center p-8">
						<p className="text-sm text-slate-500 text-center">
							{filter
								? "No layers match your search."
								: "No layers available from this server."}
						</p>
					</div>
				) : (
					filteredLayers.map((layer) => (
						<button
							type="button"
							key={layer.name}
							onClick={() => onSelectLayer(server, layer)}
							className="w-full text-left border-b border-slate-200 p-4 hover:bg-teal-50 transition-colors"
						>
							<div className="flex items-start justify-between gap-2">
								<div className="flex-1 min-w-0">
									<h4 className="font-medium text-slate-900 text-sm truncate">
										{layer.title || layer.name}
									</h4>
									{layer.title && layer.title !== layer.name && (
										<p className="text-xs text-slate-500 truncate">
											{layer.name}
										</p>
									)}
									{layer.abstract && (
										<p className="text-xs text-slate-600 mt-1 line-clamp-2">
											{layer.abstract}
										</p>
									)}

									{/* Layer badges */}
									<div className="flex flex-wrap items-center gap-2 mt-2">
										{layer.queryable && (
											<span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
												<MapPin className="w-3 h-3" />
												Queryable
											</span>
										)}
										{layer.dimensions.some(
											(d) => d.name.toLowerCase() === "time",
										) && (
											<span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
												<Clock className="w-3 h-3" />
												Temporal
											</span>
										)}
										{layer.styles.length > 1 && (
											<span className="text-xs text-slate-500">
												{layer.styles.length} styles
											</span>
										)}
									</div>
								</div>
							</div>
						</button>
					))
				)}
			</div>

			{/* Footer hint */}
			<div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
				<p className="text-xs text-slate-500 text-center">
					Click a layer to add it to the library
				</p>
			</div>
		</div>
	);
}

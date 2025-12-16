import { useMemo } from "react";
import type { Layer } from "../App";
import type {
	LayerCreate,
	LayerListResponse,
	LayerResponse,
	LayerUpdate,
	MapLayerCreate,
	MapLayerReorder,
	MapLayerResponse,
} from "../types/api";
import { useApiClient } from "./api";

/**
 * Service for layer-related API operations
 */
export class LayerService {
	constructor(client) {
		this.client = client;
	}

	/**
	 * List all layers with optional filtering
	 * GET /api/v1/layers
	 */
	async listLayers(params?: {
		source_type?: string;
		category?: string;
		is_global?: boolean;
		search?: string;
	}) {
		const queryParams = new URLSearchParams();

		if (params?.source_type) {
			queryParams.append("source_type", params.source_type);
		}
		if (params?.category) {
			queryParams.append("category", params.category);
		}
		if (params?.is_global !== undefined) {
			queryParams.append("is_global", String(params.is_global));
		}
		if (params?.search) {
			queryParams.append("search", params.search);
		}

		const queryString = queryParams.toString();
		const path = queryString
			? `/api/v1/layers?${queryString}`
			: "/api/v1/layers";

		return this.client.get<LayerListResponse[]>(path);
	}

	/**
	 * Get a single layer by ID with full details
	 * GET /api/v1/layers/{id}
	 */
	async getLayer(id: string) {
		return this.client.get<LayerResponse>(`/api/v1/layers/${id}`);
	}

	/**
	 * Create a new layer
	 * POST /api/v1/layers
	 */
	async createLayer(data: LayerCreate) {
		return this.client.post<LayerResponse, LayerCreate>("/api/v1/layers", data);
	}

	/**
	 * Update an existing layer
	 * PUT /api/v1/layers/{id}
	 */
	async updateLayer(id: string, data: LayerUpdate) {
		return this.client.put<LayerResponse, LayerUpdate>(
			`/api/v1/layers/${id}`,
			data,
		);
	}

	/**
	 * Delete a layer
	 * DELETE /api/v1/layers/{id}
	 */
	async deleteLayer(id: string) {
		return this.client.delete<void>(`/api/v1/layers/${id}`);
	}

	/**
	 * Add a layer to a map
	 * POST /api/v1/maps/{id}/layers
	 */
	async addLayerToMap(
		mapId: string,
		layerId: string,
		displayOrder?: number,
		visible?: boolean,
		opacity?: number,
	) {
		const data: MapLayerCreate = {
			layer_id: layerId,
			order: displayOrder,
			visible,
			opacity,
		};

		return this.client.post<MapLayerResponse, MapLayerCreate>(
			`/api/v1/maps/${mapId}/layers`,
			data,
		);
	}

	/**
	 * Remove a layer from a map
	 * DELETE /api/v1/maps/{id}/layers/{layer_id}
	 */
	async removeLayerFromMap(mapId: string, layerId: string) {
		return this.client.delete<void>(`/api/v1/maps/${mapId}/layers/${layerId}`);
	}

	/**
	 * Reorder layers in a map
	 * PUT /api/v1/maps/{id}/layers/reorder
	 */
	async reorderMapLayers(
		mapId: string,
		layerOrders: Array<{ layer_id: string; order: number }>,
	) {
		const data: MapLayerReorder = { layer_orders: layerOrders };

		return this.client.put<MapLayerResponse[], MapLayerReorder>(
			`/api/v1/maps/${mapId}/layers/reorder`,
			data,
		);
	}

	/**
	 * Update layer display properties in a map (visibility, opacity, order)
	 * PUT /api/v1/maps/{map_id}/layers/{layer_id}
	 */
	async updateMapLayer(
		mapId: string,
		layerId: string,
		updates: { visible?: boolean; opacity?: number; order?: number },
	) {
		return this.client.put<MapLayerResponse, typeof updates>(
			`/api/v1/maps/${mapId}/layers/${layerId}`,
			updates,
		);
	}

	/**
	 * Transform backend LayerResponse to frontend Layer format
	 */
	transformToLayer(layerResponse: LayerResponse): Layer {
		// Determine frontend layer type based on source_type
		let frontendType: Layer["type"] = "vector";

		if (layerResponse.source_type === "wms") {
			frontendType = "raster";
		} else if (layerResponse.source_type === "geotiff") {
			frontendType = "raster";
		} else if (layerResponse.source_type === "vector") {
			// Use "geojson" type for vector layers so MapView can render them
			frontendType = "geojson";
		}

		// Extract WMS configuration if present
		const wmsConfig = layerResponse.source_config as {
			url?: string;
			layers?: string;
		};

		// Extract GeoTIFF configuration if present
		const geotiffConfig = layerResponse.source_config as {
			url?: string;
			cogUrl?: string;
		};

		// Extract vector configuration if present
		// Note: vectorConfig is defined but not currently used in transformation
		// It's available for future enhancements when vector-specific properties need to be extracted

		// Extract style configuration if present
		const styleConfig = layerResponse.style_config as {
			color?: string;
			lineWidth?: number;
			fillPolygons?: boolean;
			markerIcon?: "default" | "anchor" | "ship" | "warning" | "circle";
		};

		// Build the frontend Layer object
		const layer: Layer = {
			id: layerResponse.id,
			name: layerResponse.name,
			type: frontendType,
			visible: true, // Default visibility - will be overridden by MapLayer settings
			opacity: 0.7, // Default opacity 70% (0-1 range) - will be overridden by MapLayer settings
			description: layerResponse.description || undefined,
			category: layerResponse.category || undefined,
			createdBy: layerResponse.created_by,
			editable: layerResponse.editable as "creator-only" | "everyone",
			// Style properties from style_config
			color: styleConfig?.color,
			lineWidth: styleConfig?.lineWidth,
			fillPolygons: styleConfig?.fillPolygons,
			markerIcon: styleConfig?.markerIcon,
		};

		// Add WMS-specific fields
		if (layerResponse.source_type === "wms" && wmsConfig) {
			layer.wmsUrl = wmsConfig.url;
			layer.wmsLayerName = wmsConfig.layers;
		}

		// Add GeoTIFF-specific fields
		if (layerResponse.source_type === "geotiff" && geotiffConfig) {
			layer.geotiffUrl = geotiffConfig.url || geotiffConfig.cogUrl;
		}

		// Add vector-specific fields - convert features to GeoJSON data format for MapView
		if (layerResponse.source_type === "vector") {
			// First try to get GeoJSON from source_config (where we store it)
			const vectorConfig = layerResponse.source_config as {
				geojson?: { type: string; features: unknown[] };
			};
			if (vectorConfig?.geojson) {
				layer.data = vectorConfig.geojson as {
					type: "FeatureCollection";
					features: unknown[];
				};
			} else if (layerResponse.features && layerResponse.features.length > 0) {
				// Fallback: try to construct from features array
				layer.data = {
					type: "FeatureCollection",
					features: layerResponse.features,
				};
			}
			layer.features = layerResponse.features;
		}

		// Add legend configuration if present
		if (
			layerResponse.legend_config &&
			Object.keys(layerResponse.legend_config).length > 0
		) {
			const legendConfig = layerResponse.legend_config as {
				type?: "gradient" | "categories";
				items?: Array<{ color: string; label: string; value?: number }>;
			};

			if (legendConfig.type && legendConfig.items) {
				layer.legend = {
					type: legendConfig.type,
					items: legendConfig.items,
				};
			}
		}

		// Add temporal properties if present in metadata
		const metadata = layerResponse.layer_metadata as {
			temporal?: boolean;
			timeRange?: { start: string; end: string };
			temporalData?: Array<{ timestamp: string; data: unknown }>;
		};

		if (metadata?.temporal) {
			layer.temporal = true;

			if (metadata.timeRange) {
				layer.timeRange = {
					start: new Date(metadata.timeRange.start),
					end: new Date(metadata.timeRange.end),
				};
			}

			if (metadata.temporalData) {
				layer.temporalData = metadata.temporalData.map((item) => ({
					timestamp: new Date(item.timestamp),
					data: item.data,
				}));
			}
		}

		return layer;
	}

	/**
	 * Transform frontend Layer to backend LayerCreate format
	 */
	transformToLayerCreate(layer: Partial<Layer>): LayerCreate {
		// Determine backend source_type from frontend type
		let sourceType: "wms" | "geotiff" | "vector" = "vector";

		if (layer.type === "raster" && layer.wmsUrl) {
			sourceType = "wms";
		} else if (layer.type === "raster" && layer.geotiffUrl) {
			sourceType = "geotiff";
		} else if (layer.type === "vector" || layer.type === "geojson") {
			sourceType = "vector";
		}

		// Build source_config based on layer type
		const sourceConfig: Record<string, unknown> = {};

		if (sourceType === "wms") {
			sourceConfig.url = layer.wmsUrl;
			sourceConfig.layers = layer.wmsLayerName;
			sourceConfig.version = "1.3.0";
			sourceConfig.format = "image/png";
			sourceConfig.transparent = true;
		} else if (sourceType === "geotiff") {
			sourceConfig.delivery = "direct";
			sourceConfig.url = layer.geotiffUrl;
		} else if (sourceType === "vector") {
			sourceConfig.geometryType = "Polygon"; // Default, should be determined by actual geometry
			sourceConfig.featureCount =
				layer.data?.features?.length || layer.features?.length || 0;
			// Store the GeoJSON data in source_config for retrieval
			if (layer.data) {
				sourceConfig.geojson = layer.data;
			}
		}

		// Build style_config
		const styleConfig: Record<string, unknown> = {};
		if (layer.color) {
			styleConfig.color = layer.color;
		}
		if (layer.lineWidth !== undefined) {
			styleConfig.lineWidth = layer.lineWidth;
		}
		if (layer.fillPolygons !== undefined) {
			styleConfig.fillPolygons = layer.fillPolygons;
		}
		if (layer.markerIcon) {
			styleConfig.markerIcon = layer.markerIcon;
		}

		// Build legend_config
		const legendConfig: Record<string, unknown> = {};
		if (layer.legend) {
			legendConfig.type = layer.legend.type;
			legendConfig.items = layer.legend.items;
		}

		// Build layer_metadata with temporal info if present
		const layerMetadata: Record<string, unknown> = {};
		if (layer.temporal) {
			layerMetadata.temporal = true;

			if (layer.timeRange) {
				layerMetadata.timeRange = {
					start: layer.timeRange.start.toISOString(),
					end: layer.timeRange.end.toISOString(),
				};
			}

			if (layer.temporalData) {
				layerMetadata.temporalData = layer.temporalData.map((item) => ({
					timestamp: item.timestamp.toISOString(),
					data: item.data,
				}));
			}
		}

		// Add author and DOI to metadata if present
		if (layer.author) {
			layerMetadata.author = layer.author;
		}
		if (layer.doi) {
			layerMetadata.doi = layer.doi;
		}

		return {
			name: layer.name || "Untitled Layer",
			source_type: sourceType,
			description: layer.description || null,
			category: layer.category || null,
			editable: layer.editable || "creator-only",
			is_global: false, // Default to false for user-created layers
			source_config: sourceConfig,
			style_config:
				Object.keys(styleConfig).length > 0 ? styleConfig : undefined,
			legend_config:
				Object.keys(legendConfig).length > 0 ? legendConfig : undefined,
			layer_metadata:
				Object.keys(layerMetadata).length > 0 ? layerMetadata : undefined,
		};
	}

	/**
	 * Transform frontend Layer updates to backend LayerUpdate format
	 */
	transformToLayerUpdate(updates: Partial<Layer>): LayerUpdate {
		const layerUpdate: LayerUpdate = {};

		if (updates.name !== undefined) {
			layerUpdate.name = updates.name;
		}

		if (updates.description !== undefined) {
			layerUpdate.description = updates.description;
		}

		if (updates.category !== undefined) {
			layerUpdate.category = updates.category;
		}

		if (updates.editable !== undefined) {
			layerUpdate.editable = updates.editable;
		}

		// Update source_config if relevant fields changed
		if (
			updates.wmsUrl !== undefined ||
			updates.wmsLayerName !== undefined ||
			updates.geotiffUrl !== undefined ||
			updates.data !== undefined
		) {
			const sourceConfig: Record<string, unknown> = {};

			if (updates.wmsUrl || updates.wmsLayerName) {
				sourceConfig.url = updates.wmsUrl;
				sourceConfig.layers = updates.wmsLayerName;
				sourceConfig.version = "1.3.0";
				sourceConfig.format = "image/png";
				sourceConfig.transparent = true;
			} else if (updates.geotiffUrl) {
				sourceConfig.delivery = "direct";
				sourceConfig.url = updates.geotiffUrl;
			} else if (updates.data) {
				// Update vector layer GeoJSON data (for feature edits/deletions)
				const geoJsonData = updates.data as {
					type: string;
					features?: unknown[];
				};
				sourceConfig.geometryType = "Polygon";
				sourceConfig.featureCount = geoJsonData.features?.length || 0;
				sourceConfig.geojson = updates.data;
			}

			if (Object.keys(sourceConfig).length > 0) {
				layerUpdate.source_config = sourceConfig;
			}
		}

		// Update style_config if style properties changed
		if (
			updates.color !== undefined ||
			updates.lineWidth !== undefined ||
			updates.fillPolygons !== undefined ||
			updates.markerIcon !== undefined
		) {
			const styleConfig: Record<string, unknown> = {};
			if (updates.color !== undefined) {
				styleConfig.color = updates.color;
			}
			if (updates.lineWidth !== undefined) {
				styleConfig.lineWidth = updates.lineWidth;
			}
			if (updates.fillPolygons !== undefined) {
				styleConfig.fillPolygons = updates.fillPolygons;
			}
			if (updates.markerIcon !== undefined) {
				styleConfig.markerIcon = updates.markerIcon;
			}
			layerUpdate.style_config = styleConfig;
		}

		// Update legend_config if legend changed
		if (updates.legend !== undefined) {
			layerUpdate.legend_config = {
				type: updates.legend.type,
				items: updates.legend.items,
			};
		}

		// Update layer_metadata for temporal properties or author/doi
		if (
			updates.temporal !== undefined ||
			updates.timeRange !== undefined ||
			updates.temporalData !== undefined ||
			updates.author !== undefined ||
			updates.doi !== undefined
		) {
			const layerMetadata: Record<string, unknown> = {};

			if (updates.temporal) {
				layerMetadata.temporal = true;

				if (updates.timeRange) {
					layerMetadata.timeRange = {
						start: updates.timeRange.start.toISOString(),
						end: updates.timeRange.end.toISOString(),
					};
				}

				if (updates.temporalData) {
					layerMetadata.temporalData = updates.temporalData.map((item) => ({
						timestamp: item.timestamp.toISOString(),
						data: item.data,
					}));
				}
			}

			if (updates.author !== undefined) {
				layerMetadata.author = updates.author;
			}

			if (updates.doi !== undefined) {
				layerMetadata.doi = updates.doi;
			}

			if (Object.keys(layerMetadata).length > 0) {
				layerUpdate.layer_metadata = layerMetadata;
			}
		}

		return layerUpdate;
	}
}

/**
 * React hook to get LayerService instance with authenticated API client
 */
export function useLayerService(): LayerService {
	const client = useApiClient();
	return useMemo(() => new LayerService(client), [client]);
}

import { useMemo } from "react";
import type {
	MapCollaboratorCreate,
	MapCollaboratorResponse,
	MapCollaboratorUpdate,
	MapCreate,
	MapListResponse,
	MapResponse,
	MapUpdate,
} from "../types/api";
import { useApiClient } from "./api";

/**
 * Service for map-related API operations
 */
export class MapService {
	constructor(client) {
		this.client = client;
	}

	/**
	 * List all maps accessible to the current user
	 * GET /api/v1/maps
	 */
	async listMaps() {
		return this.client.get<MapListResponse[]>("/api/v1/maps");
	}

	/**
	 * Get a single map by ID with full details
	 * GET /api/v1/maps/{id}
	 */
	async getMap(id: string) {
		return this.client.get<MapResponse>(`/api/v1/maps/${id}`);
	}

	/**
	 * Create a new map
	 * POST /api/v1/maps
	 */
	async createMap(data: MapCreate) {
		return this.client.post<MapResponse, MapCreate>("/api/v1/maps", data);
	}

	/**
	 * Update an existing map
	 * PUT /api/v1/maps/{id}
	 */
	async updateMap(id: string, data: MapUpdate) {
		return this.client.put<MapResponse, MapUpdate>(`/api/v1/maps/${id}`, data);
	}

	/**
	 * Delete a map
	 * DELETE /api/v1/maps/{id}
	 */
	async deleteMap(id: string) {
		return this.client.delete<void>(`/api/v1/maps/${id}`);
	}

	/**
	 * List collaborators for a map
	 * GET /api/v1/maps/{id}/collaborators
	 */
	async listCollaborators(mapId: string) {
		return this.client.get<MapCollaboratorResponse[]>(
			`/api/v1/maps/${mapId}/collaborators`,
		);
	}

	/**
	 * Add a collaborator to a map by email
	 * POST /api/v1/maps/{id}/collaborators
	 */
	async addCollaborator(
		mapId: string,
		email: string,
		role: "viewer" | "editor" = "viewer",
	) {
		const data: MapCollaboratorCreate = { email, role };
		return this.client.post<MapCollaboratorResponse, MapCollaboratorCreate>(
			`/api/v1/maps/${mapId}/collaborators`,
			data,
		);
	}

	/**
	 * Update a collaborator's role
	 * PUT /api/v1/maps/{id}/collaborators/{user_id}
	 */
	async updateCollaborator(
		mapId: string,
		userId: string,
		role: "viewer" | "editor",
	) {
		const data: MapCollaboratorUpdate = { role };
		return this.client.put<MapCollaboratorResponse, MapCollaboratorUpdate>(
			`/api/v1/maps/${mapId}/collaborators/${userId}`,
			data,
		);
	}

	/**
	 * Remove a collaborator from a map
	 * DELETE /api/v1/maps/{id}/collaborators/{user_id}
	 */
	async removeCollaborator(mapId: string, userId: string) {
		return this.client.delete<void>(
			`/api/v1/maps/${mapId}/collaborators/${userId}`,
		);
	}

	/**
	 * Transform backend MapResponse to frontend UserMap format
	 */
	transformToUserMap(mapResponse: MapResponse) {
		// Transform map_layers to frontend Layer format
		const layers = mapResponse.map_layers
			.filter((ml) => ml.layer) // Only include layers that have full layer data
			.map((mapLayer) => {
				const layerResponse = mapLayer.layer!;

				// Determine frontend layer type based on source_type
				let frontendType: "geojson" | "raster" | "vector" | "heatmap" =
					"vector";
				if (layerResponse.source_type === "wms") {
					frontendType = "raster";
				} else if (layerResponse.source_type === "geotiff") {
					frontendType = "raster";
				} else if (layerResponse.source_type === "vector") {
					frontendType = "geojson";
				}

				// Extract style config for color and other style properties
				const styleConfig = layerResponse.style_config as {
					color?: string;
					lineWidth?: number;
					fillPolygons?: boolean;
					markerIcon?: "default" | "anchor" | "ship" | "warning" | "circle";
				};

				// Extract WMS configuration if present
				const wmsConfig = layerResponse.source_config as {
					url?: string;
					layers?: string;
				};

				// Extract GFW 4Wings configuration if present
				const gfw4wingsConfig = (
					layerResponse.source_config as {
						gfw4wings?: {
							dataset: string;
							interval: "DAY" | "MONTH" | "YEAR";
							dateRange: { start: string; end: string };
						};
					}
				).gfw4wings;

				// Extract GeoTIFF configuration if present
				const geotiffConfig = layerResponse.source_config as {
					url?: string;
					cogUrl?: string;
					bounds?: [number, number, number, number];
					processing?: {
						colormap?: string;
						rescale?: string;
						bidx?: string;
					};
				};

				// If this is a GFW layer, override the frontend type to vector
				if (gfw4wingsConfig) {
					frontendType = "vector";
				}

				// Build GeoJSON data from source_config.geojson or features
				let data:
					| { type: "FeatureCollection"; features: unknown[] }
					| undefined;
				if (layerResponse.source_type === "vector") {
					// First try to get GeoJSON from source_config (where we store it)
					const vectorConfig = layerResponse.source_config as {
						geojson?: { type: string; features: unknown[] };
					};
					if (vectorConfig?.geojson) {
						data = vectorConfig.geojson as {
							type: "FeatureCollection";
							features: unknown[];
						};
					} else if (
						layerResponse.features &&
						layerResponse.features.length > 0
					) {
						// Fallback: try to construct from features array
						data = {
							type: "FeatureCollection",
							features: layerResponse.features.map((f) => ({
								type: "Feature",
								properties: f.properties || {},
								geometry: f.properties?.geometry || {
									type: f.geometry_type,
									coordinates: f.properties?.coordinates,
								},
							})),
						};
					}
				}

				// Build legend from legend_config
				const legendConfig = layerResponse.legend_config as {
					type?: "gradient" | "categories";
					items?: Array<{ color: string; label: string; value?: number }>;
				};
				const legend =
					legendConfig?.type && legendConfig?.items
						? { type: legendConfig.type, items: legendConfig.items }
						: undefined;

				return {
					id: layerResponse.id,
					name: layerResponse.name,
					type: frontendType,
					visible: mapLayer.visible,
					opacity: mapLayer.opacity / 100, // Convert backend 0-100 to frontend 0-1
					description: layerResponse.description || undefined,
					category: layerResponse.category || undefined,
					createdBy: layerResponse.created_by,
					editable: layerResponse.editable as "creator-only" | "everyone",
					isGlobal: layerResponse.is_global, // Whether layer is a library layer
					color: styleConfig?.color,
					lineWidth: styleConfig?.lineWidth,
					fillPolygons: styleConfig?.fillPolygons,
					markerIcon: styleConfig?.markerIcon,
					data,
					legend,
					wmsUrl:
						layerResponse.source_type === "wms" ? wmsConfig?.url : undefined,
					wmsLayerName:
						layerResponse.source_type === "wms" ? wmsConfig?.layers : undefined,
					// GeoTIFF properties
					geotiffUrl:
						layerResponse.source_type === "geotiff"
							? geotiffConfig?.url || geotiffConfig?.cogUrl
							: undefined,
					geotiffBounds:
						layerResponse.source_type === "geotiff"
							? geotiffConfig?.bounds
							: undefined,
					geotiffColormap:
						layerResponse.source_type === "geotiff"
							? geotiffConfig?.processing?.colormap
							: undefined,
					geotiffRescale:
						layerResponse.source_type === "geotiff"
							? geotiffConfig?.processing?.rescale
							: undefined,
					geotiffBidx:
						layerResponse.source_type === "geotiff"
							? geotiffConfig?.processing?.bidx
							: undefined,
					// GFW 4Wings properties
					gfw4WingsDataset: gfw4wingsConfig?.dataset,
					gfw4WingsInterval: gfw4wingsConfig?.interval,
					gfw4WingsDateRange: gfw4wingsConfig?.dateRange,
					// Temporal properties for TimeSlider (enabled for GFW layers)
					temporal: gfw4wingsConfig ? true : undefined,
					timeRange: gfw4wingsConfig
						? {
								start: new Date(gfw4wingsConfig.dateRange.start),
								end: new Date(gfw4wingsConfig.dateRange.end),
							}
						: undefined,
				};
			});

		return {
			id: mapResponse.id,
			name: mapResponse.name,
			description: mapResponse.description || "",
			center: [mapResponse.center_lat, mapResponse.center_lng],
			zoom: mapResponse.zoom,
			layers,
			createdBy: mapResponse.created_by,
			user_role: mapResponse.user_role,
			permissions: {
				editAccess: mapResponse.edit_permission as
					| "private"
					| "collaborators"
					| "public",
				collaborators: mapResponse.collaborators
					.map((c) => c.user?.email)
					.filter((email): email is string => !!email),
				visibility:
					mapResponse.view_permission === "public" ? "public" : "private",
			},
		};
	}

	/**
	 * Transform frontend UserMap to backend MapCreate format
	 */
	transformToMapCreate(userMap: {
		name: string;
		description: string;
		center: [number, number];
		zoom: number;
		permissions?: {
			editAccess: "private" | "collaborators" | "public";
			collaborators: string[];
			visibility: "private" | "public";
		};
	}): MapCreate {
		return {
			name: userMap.name,
			description: userMap.description || undefined,
			center_lat: userMap.center[0],
			center_lng: userMap.center[1],
			zoom: userMap.zoom,
			view_permission: userMap.permissions?.visibility || "private", // View access
			edit_permission: userMap.permissions?.editAccess || "private", // Edit access
		};
	}

	/**
	 * Transform frontend UserMap updates to backend MapUpdate format
	 */
	transformToMapUpdate(updates: {
		name?: string;
		description?: string;
		center?: [number, number];
		zoom?: number;
		permissions?: {
			editAccess: "private" | "collaborators" | "public";
			collaborators: string[];
			visibility: "private" | "public";
		};
	}): MapUpdate {
		const mapUpdate: MapUpdate = {};

		if (updates.name !== undefined) {
			mapUpdate.name = updates.name;
		}
		if (updates.description !== undefined) {
			mapUpdate.description = updates.description;
		}
		if (updates.center !== undefined) {
			mapUpdate.center_lat = updates.center[0];
			mapUpdate.center_lng = updates.center[1];
		}
		if (updates.zoom !== undefined) {
			mapUpdate.zoom = updates.zoom;
		}
		if (updates.permissions?.visibility !== undefined) {
			mapUpdate.view_permission = updates.permissions.visibility; // View access
		}
		if (updates.permissions?.editAccess !== undefined) {
			mapUpdate.edit_permission = updates.permissions.editAccess; // Edit access
		}

		return mapUpdate;
	}
}

/**
 * React hook to get MapService instance with authenticated API client
 */
export function useMapService(): MapService {
	const client = useApiClient();
	return useMemo(() => new MapService(client), [client]);
}

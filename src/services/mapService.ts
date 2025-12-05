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
		return {
			id: mapResponse.id,
			name: mapResponse.name,
			description: mapResponse.description || "",
			center: [mapResponse.center_lat, mapResponse.center_lng],
			zoom: mapResponse.zoom,
			layers: [], // Layers will be populated separately
			createdBy: mapResponse.created_by,
			user_role: mapResponse.user_role,
			permissions: {
				editAccess: mapResponse.edit_permission as
					| "private"
					| "collaborators"
					| "public",
				collaborators: mapResponse.collaborators.map((c) => c.user_id),
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
	return new MapService(client);
}

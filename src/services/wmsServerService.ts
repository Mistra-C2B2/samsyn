import { useMemo } from "react";
import type {
	WmsServerCreate,
	WmsServerListResponse,
	WmsServerResponse,
	WmsServerUpdate,
	WmsServerLayersResponse,
} from "../types/api";
import { useApiClient } from "./api";

/**
 * Frontend representation of a WMS server
 */
export interface WmsServer {
	id: string;
	name: string;
	baseUrl: string;
	description: string | null;
	version: string | null;
	serviceTitle: string | null;
	serviceProvider: string | null;
	layerCount: number;
	cachedAt: Date | null;
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Service for WMS server-related API operations
 */
export class WmsServerService {
	private client: ReturnType<typeof useApiClient>;

	constructor(client: ReturnType<typeof useApiClient>) {
		this.client = client;
	}

	/**
	 * List all WMS servers
	 * GET /api/v1/wms-servers
	 */
	async listServers(): Promise<WmsServer[]> {
		const response =
			await this.client.get<WmsServerListResponse[]>("/api/v1/wms-servers");
		return response.map(this.transformToWmsServer);
	}

	/**
	 * Get a single WMS server by ID with full details
	 * GET /api/v1/wms-servers/{id}
	 */
	async getServer(id: string): Promise<WmsServer> {
		const response = await this.client.get<WmsServerResponse>(
			`/api/v1/wms-servers/${id}`,
		);
		return this.transformToWmsServer(response);
	}

	/**
	 * Create a new WMS server
	 * POST /api/v1/wms-servers
	 */
	async createServer(data: {
		name: string;
		baseUrl: string;
		description?: string;
	}): Promise<WmsServer> {
		const createData: WmsServerCreate = {
			name: data.name,
			base_url: data.baseUrl,
			description: data.description,
		};

		const response = await this.client.post<
			WmsServerResponse,
			WmsServerCreate
		>("/api/v1/wms-servers", createData);
		return this.transformToWmsServer(response);
	}

	/**
	 * Update a WMS server
	 * PUT /api/v1/wms-servers/{id}
	 */
	async updateServer(
		id: string,
		data: { name?: string; description?: string },
	): Promise<WmsServer> {
		const updateData: WmsServerUpdate = {};
		if (data.name !== undefined) updateData.name = data.name;
		if (data.description !== undefined)
			updateData.description = data.description;

		const response = await this.client.put<
			WmsServerResponse,
			WmsServerUpdate
		>(`/api/v1/wms-servers/${id}`, updateData);
		return this.transformToWmsServer(response);
	}

	/**
	 * Delete a WMS server
	 * DELETE /api/v1/wms-servers/{id}
	 */
	async deleteServer(id: string): Promise<void> {
		await this.client.delete<void>(`/api/v1/wms-servers/${id}`);
	}

	/**
	 * Refresh capabilities cache for a WMS server
	 * POST /api/v1/wms-servers/{id}/refresh
	 */
	async refreshCapabilities(id: string): Promise<WmsServer> {
		const response = await this.client.post<WmsServerResponse, undefined>(
			`/api/v1/wms-servers/${id}/refresh`,
			undefined,
		);
		return this.transformToWmsServer(response);
	}

	/**
	 * Get available layers from a WMS server
	 * GET /api/v1/wms-servers/{id}/layers
	 */
	async getLayers(id: string): Promise<WmsServerLayersResponse> {
		return this.client.get<WmsServerLayersResponse>(
			`/api/v1/wms-servers/${id}/layers`,
		);
	}

	/**
	 * Transform API response to frontend WmsServer type
	 */
	private transformToWmsServer(
		response: WmsServerResponse | WmsServerListResponse,
	): WmsServer {
		return {
			id: response.id,
			name: response.name,
			baseUrl: response.base_url,
			description: response.description,
			version: response.version,
			serviceTitle: response.service_title,
			serviceProvider: response.service_provider,
			layerCount: response.layer_count,
			cachedAt: response.cached_at ? new Date(response.cached_at) : null,
			createdBy: response.created_by,
			createdAt: new Date(response.created_at),
			updatedAt:
				"updated_at" in response ? new Date(response.updated_at) : new Date(response.created_at),
		};
	}
}

/**
 * React hook to get WmsServerService instance with authenticated API client
 */
export function useWmsServerService(): WmsServerService {
	const client = useApiClient();
	return useMemo(() => new WmsServerService(client), [client]);
}

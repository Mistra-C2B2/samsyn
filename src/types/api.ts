/**
 * TypeScript API types for SamSyn frontend.
 *
 * These types match the backend Pydantic schemas exactly.
 * All snake_case field names are preserved to match the API.
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Standard API error response structure
 */
export interface APIError {
	detail: string | Record<string, unknown>;
	status_code?: number;
}

// ============================================================================
// User Types (Phase 3)
// ============================================================================

/**
 * User response from API
 */
export interface UserResponse {
	id: string; // UUID
	clerk_id: string;
	email: string;
	username: string | null;
	first_name: string | null;
	last_name: string | null;
	profile_image_url: string | null;
	created_at: string; // ISO datetime
	updated_at: string; // ISO datetime
}

// ============================================================================
// Map Types (Phase 4)
// ============================================================================

/**
 * Map permission levels
 */
export type MapPermission = "private" | "collaborators" | "public";

/**
 * Collaborator role types
 */
export type CollaboratorRole = "viewer" | "editor";

/**
 * Schema for creating a new map
 */
export interface MapCreate {
	name: string;
	description?: string | null;
	center_lat?: number; // default: 0.0, range: -90 to 90
	center_lng?: number; // default: 0.0, range: -180 to 180
	zoom?: number; // default: 2.0, range: 0 to 22
	map_metadata?: Record<string, unknown>;
	view_permission?: MapPermission; // default: "private" - controls VIEW access
	edit_permission?: MapPermission; // default: "private" - controls EDIT access
}

/**
 * Schema for updating a map (all fields optional)
 */
export interface MapUpdate {
	name?: string;
	description?: string | null;
	center_lat?: number;
	center_lng?: number;
	zoom?: number;
	view_permission?: MapPermission; // Controls VIEW access
	edit_permission?: MapPermission; // Controls EDIT access
	map_metadata?: Record<string, unknown>;
}

/**
 * Collaborator in map context
 */
export interface MapCollaboratorResponse {
	id: string; // UUID
	user_id: string; // UUID
	role: string;
	created_at: string; // ISO datetime
	user?: UserResponse | null;
}

/**
 * Layer association in map context
 */
export interface MapLayerResponse {
	id: string; // UUID
	layer_id: string; // UUID
	order: number;
	visible: boolean;
	opacity: number; // 0-100
	created_at: string; // ISO datetime
	layer?: LayerResponse | null;
}

/**
 * Full map response with relationships
 */
export interface MapResponse {
	id: string; // UUID
	name: string;
	description: string | null;
	created_by: string; // UUID
	view_permission: string; // Controls VIEW access
	edit_permission: string; // Controls EDIT access
	center_lat: number;
	center_lng: number;
	zoom: number;
	map_metadata: Record<string, unknown>;
	created_at: string; // ISO datetime
	updated_at: string; // ISO datetime
	collaborators: MapCollaboratorResponse[];
	map_layers: MapLayerResponse[];
	creator?: UserResponse | null;
	user_role?: string | null; // "owner", "editor", "viewer", or null
}

/**
 * Simplified map list response (for performance)
 */
export interface MapListResponse {
	id: string; // UUID
	name: string;
	description: string | null;
	created_by: string; // UUID
	view_permission: string; // Controls VIEW access
	edit_permission: string; // Controls EDIT access
	center_lat: number;
	center_lng: number;
	zoom: number;
	created_at: string; // ISO datetime
	updated_at: string; // ISO datetime
	collaborator_count: number;
	layer_count: number;
	user_role?: string | null; // "owner", "editor", "viewer", or null
}

/**
 * Schema for adding a collaborator to a map
 */
export interface MapCollaboratorCreate {
	email: string; // Email address of user to add
	role?: CollaboratorRole; // default: "viewer"
}

/**
 * Schema for updating a collaborator's role
 */
export interface MapCollaboratorUpdate {
	role: CollaboratorRole;
}

/**
 * Schema for adding a layer to a map
 */
export interface MapLayerCreate {
	layer_id: string; // UUID
	order?: number; // default: 0, min: 0
	visible?: boolean; // default: true
	opacity?: number; // default: 100, range: 0-100
}

/**
 * Schema for updating layer in map (visibility/opacity/order)
 */
export interface MapLayerUpdate {
	order?: number;
	visible?: boolean;
	opacity?: number;
}

/**
 * Schema for reordering layers in a map
 */
export interface MapLayerReorder {
	layer_orders: Array<{
		layer_id: string; // UUID
		order: number;
	}>;
}

// ============================================================================
// Layer Types (Phase 5)
// ============================================================================

/**
 * Layer source types
 */
export type LayerSourceType = "wms" | "geotiff" | "vector";

/**
 * Layer editability levels
 */
export type LayerEditability = "creator-only" | "everyone";

/**
 * GeoJSON geometry types
 */
export type GeometryType =
	| "Point"
	| "LineString"
	| "Polygon"
	| "MultiPoint"
	| "MultiLineString"
	| "MultiPolygon";

/**
 * WMS dimension from GetCapabilities (e.g., TIME, ELEVATION)
 */
export interface WMSDimension {
	name: string; // "time", "elevation", etc.
	extent: string; // "2011-01-01/2024-09-01/P1M" or comma-separated values
	units?: string | null; // "ISO8601" for time
	default?: string | null; // default value
}

/**
 * WMS time dimension configuration for temporal layers
 */
export interface WMSTimeDimension {
	extent: string; // Original extent from GetCapabilities
	default?: string; // Default value
	current?: string; // Currently selected time value (e.g., "2024-01-01/2024-06-01")
}

/**
 * WMS (Web Map Service) source configuration
 */
export interface WMSSourceConfig {
	url: string;
	layers: string; // comma-separated layer names
	version?: string; // default: "1.3.0"
	format?: string; // default: "image/png"
	transparent?: boolean; // default: true
	temporal?: boolean | null;
	dimensions?: Record<string, string> | null; // e.g., TIME, ELEVATION
	timeDimension?: WMSTimeDimension | null; // Parsed time dimension config
}

/**
 * GeoTIFF/COG source configuration
 */
export interface GeoTIFFSourceConfig {
	delivery: "direct" | "tiles";
	url?: string | null; // for direct delivery
	cogUrl?: string | null; // Cloud-Optimized GeoTIFF URL
	cogUrlTemplate?: string | null; // template with placeholders
	tileServer?: string | null; // for tiles delivery
	bounds?: number[] | null; // [west, south, east, north]
	temporal?: boolean | null;
	tileParams?: Record<string, unknown> | null;
	processing?: Record<string, unknown> | null; // color ramps, scaling, etc.
}

/**
 * Vector source configuration
 */
export interface VectorSourceConfig {
	geometryType: GeometryType;
	featureCount?: number; // default: 0
	bounds?: number[] | null; // [west, south, east, north]
}

/**
 * Union type for all source configs
 */
export type SourceConfig =
	| WMSSourceConfig
	| GeoTIFFSourceConfig
	| VectorSourceConfig;

/**
 * Schema for creating a new layer
 */
export interface LayerCreate {
	name: string;
	source_type: LayerSourceType;
	description?: string | null;
	category?: string | null;
	editable?: LayerEditability; // default: "creator-only"
	is_global?: boolean; // default: false
	source_config: Record<string, unknown>;
	style_config?: Record<string, unknown>;
	legend_config?: Record<string, unknown>;
	layer_metadata?: Record<string, unknown>;
}

/**
 * Schema for updating a layer (all fields optional)
 */
export interface LayerUpdate {
	name?: string;
	source_type?: LayerSourceType;
	description?: string | null;
	category?: string | null;
	editable?: LayerEditability;
	is_global?: boolean;
	source_config?: Record<string, unknown>;
	style_config?: Record<string, unknown>;
	legend_config?: Record<string, unknown>;
	layer_metadata?: Record<string, unknown>;
}

/**
 * Feature in layer context
 */
export interface LayerFeatureResponse {
	id: string; // UUID
	geometry_type: string;
	properties: Record<string, unknown>;
	created_at: string; // ISO datetime
}

/**
 * Map association in layer context
 */
export interface LayerMapResponse {
	id: string; // UUID
	map_id: string; // UUID
	order: number;
	visible: boolean;
	opacity: number;
	created_at: string; // ISO datetime
	map?: MapResponse | null;
}

/**
 * Full layer response with relationships
 */
export interface LayerResponse {
	id: string; // UUID
	name: string;
	source_type: string;
	description: string | null;
	category: string | null;
	created_by: string; // UUID
	editable: string;
	is_global: boolean;
	source_config: Record<string, unknown>;
	style_config: Record<string, unknown>;
	legend_config: Record<string, unknown>;
	layer_metadata: Record<string, unknown>;
	created_at: string; // ISO datetime
	updated_at: string; // ISO datetime
	features: LayerFeatureResponse[];
	map_layers: LayerMapResponse[];
	creator?: UserResponse | null;
}

/**
 * Optimized layer list response (for library listing)
 */
export interface LayerListResponse {
	id: string; // UUID
	name: string;
	source_type: string;
	category: string | null;
	is_global: boolean;
	created_by: string; // UUID
	created_at: string; // ISO datetime
	feature_count: number;
	map_count: number;
}

/**
 * Schema for adding a feature to a vector layer
 */
export interface LayerFeatureCreate {
	geometry_type: GeometryType;
	geometry: Record<string, unknown>; // GeoJSON geometry object
	properties?: Record<string, unknown>;
}

/**
 * Schema for updating a feature in a vector layer
 */
export interface LayerFeatureUpdate {
	geometry?: Record<string, unknown>;
	properties?: Record<string, unknown>;
}

/**
 * Schema for bulk deleting layers
 */
export interface LayerBulkDelete {
	layer_ids: string[]; // UUIDs, min length: 1
}

/**
 * Schema for bulk updating layer properties
 */
export interface LayerBulkUpdate {
	layer_ids: string[]; // UUIDs, min length: 1
	updates: Record<string, unknown>;
}

// ============================================================================
// Feature Types (Phase 5)
// ============================================================================

/**
 * GeoJSON geometry object
 */
export interface FeatureGeometry {
	type: GeometryType;
	coordinates:
		| number[] // Point
		| number[][] // LineString, MultiPoint
		| number[][][] // Polygon, MultiLineString
		| number[][][][]; // MultiPolygon
}

/**
 * Schema for creating a new feature
 */
export interface FeatureCreate {
	geometry: Record<string, unknown>; // GeoJSON geometry object
	properties?: Record<string, unknown>;
	feature_type?: string | null;
}

/**
 * Schema for updating a feature
 */
export interface FeatureUpdate {
	geometry?: Record<string, unknown>;
	properties?: Record<string, unknown>;
	feature_type?: string | null;
}

/**
 * Feature response from API
 */
export interface FeatureResponse {
	id: string; // UUID
	layer_id: string; // UUID
	geometry: Record<string, unknown>; // GeoJSON geometry object
	properties: Record<string, unknown>;
	feature_type: string | null;
	created_at: string; // ISO datetime
	updated_at: string; // ISO datetime
}

/**
 * GeoJSON Feature format response
 */
export interface FeatureGeoJSONResponse {
	type: "Feature";
	id: string; // UUID
	geometry: Record<string, unknown>;
	properties: Record<string, unknown>;
}

/**
 * Individual GeoJSON Feature for bulk operations
 */
export interface GeoJSONFeature {
	type: "Feature";
	geometry: Record<string, unknown>;
	properties?: Record<string, unknown>;
	id?: string | number | null;
}

/**
 * GeoJSON FeatureCollection
 */
export interface FeatureCollection {
	type: "FeatureCollection";
	features: GeoJSONFeature[];
}

/**
 * Schema for importing GeoJSON FeatureCollections
 */
export interface BulkFeatureCreate {
	type: "FeatureCollection";
	features: Record<string, unknown>[]; // min length: 1
	feature_type?: string | null;
}

/**
 * Bulk feature operation response
 */
export interface BulkFeatureResponse {
	success: boolean;
	created_count: number;
	failed_count: number;
	feature_ids: string[]; // UUIDs
	errors: Array<Record<string, unknown>>;
}

/**
 * Schema for bulk deleting features
 */
export interface BulkFeatureDelete {
	feature_ids: string[]; // UUIDs, min length: 1
}

/**
 * Bulk delete operation response
 */
export interface BulkFeatureDeleteResponse {
	success: boolean;
	deleted_count: number;
	failed_count: number;
	errors: Array<Record<string, unknown>>;
}

/**
 * Spatial and pagination query parameters
 */
export interface FeatureQueryParams {
	bbox?: string | null; // "west,south,east,north"
	intersects?: string | null; // GeoJSON geometry as string
	feature_type?: string | null;
	limit?: number; // default: 100, range: 1-1000
	offset?: number; // default: 0, min: 0
}

// ============================================================================
// Comment Types (Phase 6)
// ============================================================================

/**
 * Schema for creating a new comment.
 *
 * Comments must be attached to either a map OR a layer (XOR logic).
 * Comments can optionally be replies to parent comments.
 */
export interface CommentCreate {
	content: string; // min length: 1, cannot be empty or whitespace
	map_id?: string | null; // UUID
	layer_id?: string | null; // UUID
	parent_id?: string | null; // UUID
}

/**
 * Schema for updating a comment.
 *
 * Only content can be updated.
 */
export interface CommentUpdate {
	content?: string | null; // min length: 1 if provided
}

/**
 * Schema for comment API responses.
 *
 * Returns complete comment data including metadata and computed fields.
 */
export interface CommentResponse {
	id: string; // UUID
	content: string;
	author_id: string; // UUID
	map_id: string | null; // UUID
	layer_id: string | null; // UUID
	parent_id: string | null; // UUID
	is_resolved: boolean;
	created_at: string; // ISO datetime
	updated_at: string; // ISO datetime

	// Computed fields (populated by service layer)
	author_name: string | null; // Display name from User relationship
	reply_count: number; // Number of direct replies, default: 0
}

/**
 * Schema for threaded comment responses.
 *
 * Extends CommentResponse to include nested replies for building comment threads.
 */
export interface CommentWithReplies extends CommentResponse {
	replies: CommentResponse[]; // List of direct replies
}

// ============================================================================
// WMS Server Types
// ============================================================================

/**
 * Schema for creating a new WMS server
 */
export interface WmsServerCreate {
	name: string;
	base_url: string;
	description?: string | null;
}

/**
 * Schema for updating a WMS server
 */
export interface WmsServerUpdate {
	name?: string;
	description?: string | null;
}

/**
 * WMS server response from API
 */
export interface WmsServerResponse {
	id: string; // UUID
	name: string;
	base_url: string;
	description: string | null;
	version: string | null;
	service_title: string | null;
	service_provider: string | null;
	layer_count: number;
	capabilities_cache: Record<string, unknown>;
	cached_at: string | null; // ISO datetime
	created_by: string | null; // UUID
	created_at: string; // ISO datetime
	updated_at: string; // ISO datetime
}

/**
 * Simplified WMS server list response
 */
export interface WmsServerListResponse {
	id: string; // UUID
	name: string;
	base_url: string;
	description: string | null;
	version: string | null;
	service_title: string | null;
	service_provider: string | null;
	layer_count: number;
	cached_at: string | null; // ISO datetime
	created_by: string | null; // UUID
	created_at: string; // ISO datetime
}

/**
 * WMS layer info from capabilities
 */
export interface WmsLayerInfo {
	name: string;
	title: string | null;
	abstract: string | null;
	queryable: boolean;
	bounds: number[] | null; // [west, south, east, north]
	crs: string[];
	styles: Array<{
		name: string;
		title: string;
		legendUrl?: string | null;
	}>;
	dimensions: Array<{
		name: string;
		extent: string;
		units?: string | null;
		default?: string | null;
	}>;
}

/**
 * WMS server layers response
 */
export interface WmsServerLayersResponse {
	server_id: string; // UUID
	server_name: string;
	base_url: string;
	version: string | null;
	layers: WmsLayerInfo[];
	cached_at: string | null; // ISO datetime
}

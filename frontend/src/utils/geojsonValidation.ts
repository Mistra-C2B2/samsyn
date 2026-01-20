/**
 * GeoJSON validation utilities for the admin panel.
 * Validates GeoJSON structure and extracts statistics.
 */

// ============================================================================
// Types
// ============================================================================

export interface GeoJSONValidationResult {
	valid: boolean;
	error?: string;
	errorLine?: number;
	featureCount?: number;
	geometryTypes?: string[];
	bounds?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
	hasProperties?: boolean;
	propertyKeys?: string[];
}

export interface ParsedGeoJSON {
	type: string;
	features?: Array<{
		type: string;
		geometry?: {
			type: string;
			coordinates: unknown;
		};
		properties?: Record<string, unknown>;
	}>;
	geometry?: {
		type: string;
		coordinates: unknown;
	};
	properties?: Record<string, unknown>;
}

// ============================================================================
// Validation Functions
// ============================================================================

const VALID_GEOMETRY_TYPES = [
	"Point",
	"MultiPoint",
	"LineString",
	"MultiLineString",
	"Polygon",
	"MultiPolygon",
	"GeometryCollection",
];

/**
 * Parse and validate GeoJSON string.
 * Returns validation result with statistics if valid.
 */
export function validateGeoJSON(jsonString: string): GeoJSONValidationResult {
	// Trim whitespace
	const trimmed = jsonString.trim();

	if (!trimmed) {
		return { valid: false, error: "GeoJSON input is empty" };
	}

	// Try to parse JSON
	let parsed: ParsedGeoJSON;
	try {
		parsed = JSON.parse(trimmed);
	} catch (e) {
		const error = e as SyntaxError;
		// Try to extract line number from error message
		const lineMatch = error.message.match(/position (\d+)/);
		let errorLine: number | undefined;

		if (lineMatch) {
			const position = parseInt(lineMatch[1], 10);
			// Count newlines up to the error position
			errorLine = trimmed.substring(0, position).split("\n").length;
		}

		return {
			valid: false,
			error: `Invalid JSON: ${error.message}`,
			errorLine,
		};
	}

	// Validate GeoJSON structure
	if (!parsed || typeof parsed !== "object") {
		return { valid: false, error: "GeoJSON must be an object" };
	}

	// Check for valid GeoJSON types
	const validTypes = ["FeatureCollection", "Feature", ...VALID_GEOMETRY_TYPES];
	if (!validTypes.includes(parsed.type)) {
		return {
			valid: false,
			error: `Invalid GeoJSON type: "${parsed.type}". Expected one of: ${validTypes.join(", ")}`,
		};
	}

	// Handle different GeoJSON types
	if (parsed.type === "FeatureCollection") {
		return validateFeatureCollection(parsed);
	}
	if (parsed.type === "Feature") {
		return validateFeature(parsed);
	}
	// It's a geometry object
	return validateGeometry(parsed);
}

/**
 * Validate a FeatureCollection
 */
function validateFeatureCollection(fc: ParsedGeoJSON): GeoJSONValidationResult {
	if (!Array.isArray(fc.features)) {
		return {
			valid: false,
			error: 'FeatureCollection must have a "features" array',
		};
	}

	if (fc.features.length === 0) {
		return { valid: false, error: "FeatureCollection has no features" };
	}

	const geometryTypes = new Set<string>();
	const propertyKeys = new Set<string>();
	let hasProperties = false;
	let minLng = Infinity;
	let minLat = Infinity;
	let maxLng = -Infinity;
	let maxLat = -Infinity;

	for (let i = 0; i < fc.features.length; i++) {
		const feature = fc.features[i];

		if (!feature || typeof feature !== "object") {
			return {
				valid: false,
				error: `Feature at index ${i} is not a valid object`,
			};
		}

		if (feature.type !== "Feature") {
			return {
				valid: false,
				error: `Feature at index ${i} has invalid type: "${feature.type}"`,
			};
		}

		// Validate geometry
		if (feature.geometry) {
			const geomResult = validateGeometryObject(feature.geometry, i);
			if (!geomResult.valid) {
				return geomResult;
			}
			geometryTypes.add(feature.geometry.type);

			// Update bounds
			const bounds = extractBounds(feature.geometry);
			if (bounds) {
				minLng = Math.min(minLng, bounds[0]);
				minLat = Math.min(minLat, bounds[1]);
				maxLng = Math.max(maxLng, bounds[2]);
				maxLat = Math.max(maxLat, bounds[3]);
			}
		}

		// Collect property keys
		if (feature.properties && typeof feature.properties === "object") {
			hasProperties = true;
			for (const key of Object.keys(feature.properties)) {
				propertyKeys.add(key);
			}
		}
	}

	return {
		valid: true,
		featureCount: fc.features.length,
		geometryTypes: Array.from(geometryTypes).sort(),
		bounds: minLng !== Infinity ? [minLng, minLat, maxLng, maxLat] : undefined,
		hasProperties,
		propertyKeys: Array.from(propertyKeys).sort(),
	};
}

/**
 * Validate a single Feature
 */
function validateFeature(feature: ParsedGeoJSON): GeoJSONValidationResult {
	if (!feature.geometry) {
		return { valid: false, error: "Feature must have a geometry" };
	}

	const geomResult = validateGeometryObject(feature.geometry, 0);
	if (!geomResult.valid) {
		return geomResult;
	}

	const bounds = extractBounds(feature.geometry);
	const propertyKeys = feature.properties
		? Object.keys(feature.properties)
		: [];

	return {
		valid: true,
		featureCount: 1,
		geometryTypes: [feature.geometry.type],
		bounds: bounds || undefined,
		hasProperties: propertyKeys.length > 0,
		propertyKeys,
	};
}

/**
 * Validate a bare Geometry object
 */
function validateGeometry(geometry: ParsedGeoJSON): GeoJSONValidationResult {
	const geomResult = validateGeometryObject(
		geometry as { type: string; coordinates: unknown },
		0,
	);
	if (!geomResult.valid) {
		return geomResult;
	}

	const bounds = extractBounds(
		geometry as { type: string; coordinates: unknown },
	);

	return {
		valid: true,
		featureCount: 1,
		geometryTypes: [geometry.type],
		bounds: bounds || undefined,
		hasProperties: false,
		propertyKeys: [],
	};
}

/**
 * Validate a geometry object
 */
function validateGeometryObject(
	geometry: { type: string; coordinates: unknown },
	featureIndex: number,
): GeoJSONValidationResult {
	if (!geometry || typeof geometry !== "object") {
		return {
			valid: false,
			error: `Feature at index ${featureIndex} has invalid geometry`,
		};
	}

	if (!VALID_GEOMETRY_TYPES.includes(geometry.type)) {
		return {
			valid: false,
			error: `Feature at index ${featureIndex} has invalid geometry type: "${geometry.type}"`,
		};
	}

	// GeometryCollection doesn't have coordinates
	if (geometry.type === "GeometryCollection") {
		return { valid: true };
	}

	if (!geometry.coordinates) {
		return {
			valid: false,
			error: `Feature at index ${featureIndex} geometry is missing coordinates`,
		};
	}

	// Validate coordinates structure based on geometry type
	const coordResult = validateCoordinates(
		geometry.type,
		geometry.coordinates,
		featureIndex,
	);
	if (!coordResult.valid) {
		return coordResult;
	}

	return { valid: true };
}

/**
 * Validate coordinates based on geometry type
 */
function validateCoordinates(
	type: string,
	coordinates: unknown,
	featureIndex: number,
): GeoJSONValidationResult {
	switch (type) {
		case "Point":
			return validatePoint(coordinates, featureIndex);
		case "MultiPoint":
		case "LineString":
			return validateLineString(coordinates, featureIndex);
		case "MultiLineString":
		case "Polygon":
			return validatePolygon(coordinates, featureIndex);
		case "MultiPolygon":
			return validateMultiPolygon(coordinates, featureIndex);
		default:
			return { valid: true };
	}
}

function validatePoint(
	coords: unknown,
	featureIndex: number,
): GeoJSONValidationResult {
	if (!Array.isArray(coords) || coords.length < 2) {
		return {
			valid: false,
			error: `Feature at index ${featureIndex}: Point must have at least [lng, lat] coordinates`,
		};
	}

	const [lng, lat] = coords as number[];
	if (typeof lng !== "number" || typeof lat !== "number") {
		return {
			valid: false,
			error: `Feature at index ${featureIndex}: coordinates must be numbers`,
		};
	}

	if (lng < -180 || lng > 180) {
		return {
			valid: false,
			error: `Feature at index ${featureIndex}: longitude ${lng} is out of range [-180, 180]`,
		};
	}

	if (lat < -90 || lat > 90) {
		return {
			valid: false,
			error: `Feature at index ${featureIndex}: latitude ${lat} is out of range [-90, 90]`,
		};
	}

	return { valid: true };
}

function validateLineString(
	coords: unknown,
	featureIndex: number,
): GeoJSONValidationResult {
	if (!Array.isArray(coords)) {
		return {
			valid: false,
			error: `Feature at index ${featureIndex}: LineString coordinates must be an array`,
		};
	}

	for (let i = 0; i < coords.length; i++) {
		const result = validatePoint(coords[i], featureIndex);
		if (!result.valid) {
			return result;
		}
	}

	return { valid: true };
}

function validatePolygon(
	coords: unknown,
	featureIndex: number,
): GeoJSONValidationResult {
	if (!Array.isArray(coords)) {
		return {
			valid: false,
			error: `Feature at index ${featureIndex}: Polygon coordinates must be an array of rings`,
		};
	}

	for (let i = 0; i < coords.length; i++) {
		const result = validateLineString(coords[i], featureIndex);
		if (!result.valid) {
			return result;
		}
	}

	return { valid: true };
}

function validateMultiPolygon(
	coords: unknown,
	featureIndex: number,
): GeoJSONValidationResult {
	if (!Array.isArray(coords)) {
		return {
			valid: false,
			error: `Feature at index ${featureIndex}: MultiPolygon coordinates must be an array`,
		};
	}

	for (let i = 0; i < coords.length; i++) {
		const result = validatePolygon(coords[i], featureIndex);
		if (!result.valid) {
			return result;
		}
	}

	return { valid: true };
}

/**
 * Extract bounding box from geometry
 */
function extractBounds(geometry: {
	type: string;
	coordinates: unknown;
}): [number, number, number, number] | null {
	if (!geometry.coordinates) return null;

	let minLng = Infinity;
	let minLat = Infinity;
	let maxLng = -Infinity;
	let maxLat = -Infinity;

	function processCoordinate(coord: number[]) {
		const [lng, lat] = coord;
		if (typeof lng === "number" && typeof lat === "number") {
			minLng = Math.min(minLng, lng);
			minLat = Math.min(minLat, lat);
			maxLng = Math.max(maxLng, lng);
			maxLat = Math.max(maxLat, lat);
		}
	}

	function processCoordinates(coords: unknown, depth: number) {
		if (!Array.isArray(coords)) return;

		if (depth === 0) {
			// It's a single coordinate
			processCoordinate(coords as number[]);
		} else {
			// It's an array of coordinates or deeper
			for (const item of coords) {
				processCoordinates(item, depth - 1);
			}
		}
	}

	// Determine depth based on geometry type
	let depth = 0;
	switch (geometry.type) {
		case "Point":
			depth = 0;
			break;
		case "MultiPoint":
		case "LineString":
			depth = 1;
			break;
		case "MultiLineString":
		case "Polygon":
			depth = 2;
			break;
		case "MultiPolygon":
			depth = 3;
			break;
	}

	processCoordinates(geometry.coordinates, depth);

	if (minLng === Infinity) return null;
	return [minLng, minLat, maxLng, maxLat];
}

/**
 * Normalize GeoJSON to always be a FeatureCollection
 */
export function normalizeToFeatureCollection(parsed: ParsedGeoJSON): {
	type: "FeatureCollection";
	features: Array<{
		type: "Feature";
		geometry: { type: string; coordinates: unknown };
		properties: Record<string, unknown>;
	}>;
} {
	if (parsed.type === "FeatureCollection") {
		return parsed as ReturnType<typeof normalizeToFeatureCollection>;
	}

	if (parsed.type === "Feature") {
		return {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					geometry: parsed.geometry as { type: string; coordinates: unknown },
					properties: (parsed.properties as Record<string, unknown>) || {},
				},
			],
		};
	}

	// It's a bare geometry
	return {
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				geometry: parsed as unknown as { type: string; coordinates: unknown },
				properties: {},
			},
		],
	};
}

/**
 * Format bounds for display
 */
export function formatBounds(bounds: [number, number, number, number]): string {
	const [minLng, minLat, maxLng, maxLat] = bounds;
	const formatCoord = (val: number) => val.toFixed(2);
	return `${formatCoord(minLng)}°E to ${formatCoord(maxLng)}°E, ${formatCoord(minLat)}°N to ${formatCoord(maxLat)}°N`;
}

/**
 * Format geometry types for display
 */
export function formatGeometryTypes(types: string[]): string {
	const counts: Record<string, number> = {};
	for (const type of types) {
		counts[type] = (counts[type] || 0) + 1;
	}
	return Object.entries(counts)
		.map(([type]) => type)
		.join(", ");
}

// ============================================================================
// Feature Popup Content Generator
// ============================================================================
// Generates HTML content for MapLibre popups when clicking on map features.
// Extracted from MapView for better maintainability.

export interface FeaturePopupData {
	layerName: string;
	featureName?: string;
	description?: string;
	properties?: Record<string, unknown>;
}

/**
 * Generates styled HTML content for a map feature popup.
 * Shows the layer name, and optionally the feature name, description, and all other properties.
 */
export function generateFeaturePopupHTML(data: FeaturePopupData): string {
	const { layerName, featureName, description, properties } = data;
	const hasFeatureData = featureName || description;

	// Filter out internal properties that are already displayed separately
	const additionalProperties = properties
		? Object.entries(properties).filter(
				([key]) =>
					key !== "name" &&
					key !== "description" &&
					key !== "featureType" &&
					!key.startsWith("_"), // Exclude internal properties starting with _
			)
		: [];

	const hasAdditionalProperties = additionalProperties.length > 0;

	// Helper to format property values
	const formatValue = (value: unknown): string => {
		if (value === null || value === undefined) return "—";
		const str = String(value);
		// Truncate long values
		return str.length > 100 ? `${str.substring(0, 100)}...` : str;
	};

	return `
		<div style="font-size: 13px; min-width: 150px;">
			<div style="margin-bottom: 4px;">
				<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
				<div style="font-weight: 600; color: #1e293b;">${layerName}</div>
			</div>
			${
				hasFeatureData
					? `
				<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
					${
						featureName
							? `
						<div style="margin-bottom: 4px;">
							<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Feature</span>
							<div style="color: #334155;">${featureName}</div>
						</div>
					`
							: ""
					}
					${
						description
							? `
						<div>
							<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Description</span>
							<div style="color: #334155;">${description}</div>
						</div>
					`
							: ""
					}
				</div>
			`
					: ""
			}
			${
				hasAdditionalProperties
					? `
				<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
					<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Properties</span>
					<div style="margin-top: 4px;">
						${additionalProperties
							.map(
								([key, value]) => `
							<div style="display: flex; margin-bottom: 2px;">
								<span style="color: #64748b; min-width: 80px; font-size: 12px;">${key}:</span>
								<span style="color: #334155; font-size: 12px; word-break: break-word;">${formatValue(value)}</span>
							</div>
						`,
							)
							.join("")}
					</div>
				</div>
			`
					: ""
			}
		</div>
	`.trim();
}

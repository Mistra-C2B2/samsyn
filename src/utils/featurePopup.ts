// ============================================================================
// Feature Popup Content Generator
// ============================================================================
// Generates HTML content for MapLibre popups when clicking on map features.
// Extracted from MapView for better maintainability.

export interface FeaturePopupData {
	layerName: string;
	featureName?: string;
	description?: string;
}

/**
 * Generates styled HTML content for a map feature popup.
 * Shows the layer name, and optionally the feature name and description.
 */
export function generateFeaturePopupHTML(data: FeaturePopupData): string {
	const { layerName, featureName, description } = data;
	const hasFeatureData = featureName || description;

	return `
		<div style="font-size: 13px; min-width: 150px;">
			<div style="margin-bottom: 4px;">
				<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
				<div style="font-weight: 600; color: #1e293b;">${layerName}</div>
			</div>
			${hasFeatureData ? `
				<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
					${featureName ? `
						<div style="margin-bottom: 4px;">
							<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Feature</span>
							<div style="color: #334155;">${featureName}</div>
						</div>
					` : ""}
					${description ? `
						<div>
							<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Description</span>
							<div style="color: #334155;">${description}</div>
						</div>
					` : ""}
				</div>
			` : ""}
		</div>
	`.trim();
}

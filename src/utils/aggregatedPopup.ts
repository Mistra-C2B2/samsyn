/**
 * Utility functions for creating and managing aggregated multi-layer popups
 */

export interface PopupSection {
	layerId: string;
	layerName: string;
	content: string; // HTML content
	isLoading?: boolean; // For WMS layers still fetching
	layerIndex: number; // For sorting (0 = top layer)
}

/**
 * Generates HTML for an aggregated popup with multiple layer sections
 * @param sections Array of popup sections (will be sorted by layerIndex)
 * @returns HTML string with scrollable container and styled sections
 */
export function generateAggregatedPopupHTML(sections: PopupSection[]): string {
	// Sort sections by layer index (top layers first)
	const sortedSections = [...sections].sort(
		(a, b) => a.layerIndex - b.layerIndex,
	);

	// Generate section HTML
	const sectionsHTML = sortedSections
		.map((section, index) => {
			// Use darker divider between layers for better visual separation
			const divider =
				index > 0
					? '<div class="popup-divider" style="border-top: 2px solid #cbd5e1; margin: 12px 0;"></div>'
					: "";

			return `
			${divider}
			<div class="popup-section" data-layer-id="${section.layerId}">
				${section.content}
			</div>
		`;
		})
		.join("");

	// Wrap in scrollable container
	return `
		<div class="aggregated-popup" style="
			max-height: 400px;
			overflow-y: auto;
			font-size: 13px;
			scrollbar-width: thin;
			scrollbar-color: #cbd5e1 #f1f5f9;
		">
			<style>
				.aggregated-popup::-webkit-scrollbar {
					width: 6px;
				}
				.aggregated-popup::-webkit-scrollbar-track {
					background: #f1f5f9;
					border-radius: 3px;
				}
				.aggregated-popup::-webkit-scrollbar-thumb {
					background: #cbd5e1;
					border-radius: 3px;
				}
				.aggregated-popup::-webkit-scrollbar-thumb:hover {
					background: #94a3b8;
				}
			</style>
			${sectionsHTML}
		</div>
	`;
}

/**
 * Updates a specific section within an existing popup
 * @param popupElement The popup's DOM element
 * @param layerId The layer ID to update
 * @param newContent New HTML content for the section
 */
export function updatePopupSection(
	popupElement: HTMLElement,
	layerId: string,
	newContent: string,
): void {
	// Find the section with matching data-layer-id
	const section = popupElement.querySelector(
		`[data-layer-id="${layerId}"]`,
	) as HTMLElement;

	if (section) {
		section.innerHTML = newContent;
	}
}

/**
 * Creates a loading placeholder section for WMS layers
 * @param layerId Layer ID
 * @param layerName Display name of the layer
 * @param layerIndex Layer's position in the layers array
 * @returns PopupSection with loading indicator
 */
export function createLoadingSection(
	layerId: string,
	layerName: string,
	layerIndex: number,
): PopupSection {
	const content = `
		<div style="font-size: 13px; min-width: 150px;">
			<div style="margin-bottom: 4px;">
				<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
				<div style="font-weight: 600; color: #1e293b;">${layerName}</div>
			</div>
			<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
				<div style="font-size: 12px; color: #64748b;">Loading...</div>
			</div>
		</div>
	`;

	return {
		layerId,
		layerName,
		content,
		isLoading: true,
		layerIndex,
	};
}

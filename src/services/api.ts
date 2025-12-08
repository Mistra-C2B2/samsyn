import { useAuth } from "@clerk/clerk-react";
import { useMemo } from "react";

/**
 * HTTP Client for SamSyn API with Clerk authentication
 */
export class ApiClient {
	constructor(baseURL, getToken) {
		this.baseURL = baseURL;
		this.getToken = getToken;
	}

	/**
	 * Build headers with authentication and content type
	 */
	async buildHeaders() {
		const headers = {
			"Content-Type": "application/json",
		};

		const token = await this.getToken();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		return headers;
	}

	/**
	 * Handle HTTP response and parse JSON or handle no content
	 */
	async handleResponse(response) {
		// Handle 204 No Content
		if (response.status === 204) {
			return undefined;
		}

		// Parse response body
		const contentType = response.headers.get("content-type");
		const isJson = contentType?.includes("application/json");

		if (!response.ok) {
			// Try to parse error response
			let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

			if (isJson) {
				try {
					const errorData = await response.json();
					// Log full error response for debugging
					console.log("API Error Response:", JSON.stringify(errorData, null, 2));

					// Handle various API error response formats
					if (typeof errorData === "string") {
						errorMessage = errorData;
					} else if (errorData.message) {
						errorMessage = errorData.message;
					} else if (errorData.detail) {
						// FastAPI often returns { detail: "message" } or { detail: [...] }
						if (typeof errorData.detail === "string") {
							errorMessage = errorData.detail;
						} else if (Array.isArray(errorData.detail)) {
							// Pydantic validation errors: [{ loc: [...], msg: "...", type: "..." }]
							errorMessage = errorData.detail
								.map((e: { loc?: string[]; msg?: string; message?: string }) => {
									const location = e.loc ? e.loc.join(".") : "";
									const msg = e.msg || e.message || JSON.stringify(e);
									return location ? `${location}: ${msg}` : msg;
								})
								.join("; ");
						} else {
							errorMessage = JSON.stringify(errorData.detail);
						}
					} else if (errorData.error) {
						errorMessage = errorData.error;
					} else {
						// Fallback: stringify the whole object
						errorMessage = JSON.stringify(errorData);
					}
				} catch {
					// If JSON parsing fails, use default error message
				}
			} else {
				try {
					const errorText = await response.text();
					if (errorText) {
						errorMessage = errorText;
					}
				} catch {
					// Use default error message
				}
			}

			throw new Error(errorMessage);
		}

		// Parse successful response
		if (isJson) {
			return response.json();
		}

		// Return empty object for non-JSON responses
		return {};
	}

	/**
	 * GET request
	 */
	async get(path: string) {
		const headers = await this.buildHeaders();
		const response = await fetch(`${this.baseURL}${path}`, {
			method: "GET",
			headers,
		});

		return this.handleResponse(response);
	}

	/**
	 * POST request
	 */
	async post(path: string, data?: D) {
		const headers = await this.buildHeaders();
		const response = await fetch(`${this.baseURL}${path}`, {
			method: "POST",
			headers,
			body: data ? JSON.stringify(data) : undefined,
		});

		return this.handleResponse(response);
	}

	/**
	 * PUT request
	 */
	async put(path: string, data?: D) {
		const headers = await this.buildHeaders();
		const body = data ? JSON.stringify(data) : undefined;

		// Debug logging for reorder requests
		if (path.includes("reorder")) {
			console.log("PUT reorder request:", {
				url: `${this.baseURL}${path}`,
				body: body,
				parsedBody: data,
			});
		}

		const response = await fetch(`${this.baseURL}${path}`, {
			method: "PUT",
			headers,
			body,
		});

		return this.handleResponse(response);
	}

	/**
	 * DELETE request
	 */
	async delete(path: string) {
		const headers = await this.buildHeaders();
		const response = await fetch(`${this.baseURL}${path}`, {
			method: "DELETE",
			headers,
		});

		return this.handleResponse(response);
	}
}

/**
 * React hook to get configured API client with Clerk authentication
 */
export function useApiClient(): ApiClient {
	const { getToken } = useAuth();

	const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

	return useMemo(() => new ApiClient(baseURL, getToken), [getToken]);
}

import { useMemo } from "react";
import type {
	CommentCreate,
	CommentResponse,
	CommentUpdate,
} from "../types/api";
import { useApiClient } from "./api";

/**
 * Service for comment-related API operations
 */
export class CommentService {
	constructor(client) {
		this.client = client;
	}

	/**
	 * List comments with optional filtering
	 * GET /api/v1/comments
	 */
	async listComments(params: {
		map_id?: string;
		layer_id?: string;
		parent_id?: string;
		include_resolved?: boolean;
		limit?: number;
		offset?: number;
	}) {
		const queryString = new URLSearchParams(
			Object.entries(params)
				.filter(([_, v]) => v !== undefined)
				.map(([k, v]) => [k, String(v)]),
		).toString();

		const path = queryString
			? `/api/v1/comments?${queryString}`
			: "/api/v1/comments";
		return this.client.get<CommentResponse[]>(path);
	}

	/**
	 * Get a single comment by ID
	 * GET /api/v1/comments/{id}
	 */
	async getComment(id: string) {
		return this.client.get<CommentResponse>(`/api/v1/comments/${id}`);
	}

	/**
	 * Get a comment thread (comment with nested replies)
	 * GET /api/v1/comments/{id}/thread
	 */
	async getCommentThread(id: string, maxDepth?: number) {
		const queryString = maxDepth !== undefined ? `?max_depth=${maxDepth}` : "";
		return this.client.get<CommentResponse>(
			`/api/v1/comments/${id}/thread${queryString}`,
		);
	}

	/**
	 * Create a new comment
	 * POST /api/v1/comments
	 */
	async createComment(data: CommentCreate) {
		return this.client.post<CommentResponse, CommentCreate>(
			"/api/v1/comments",
			data,
		);
	}

	/**
	 * Update a comment
	 * PUT /api/v1/comments/{id}
	 */
	async updateComment(id: string, data: CommentUpdate) {
		return this.client.put<CommentResponse, CommentUpdate>(
			`/api/v1/comments/${id}`,
			data,
		);
	}

	/**
	 * Delete a comment
	 * DELETE /api/v1/comments/{id}
	 */
	async deleteComment(id: string) {
		return this.client.delete<void>(`/api/v1/comments/${id}`);
	}

	/**
	 * Resolve or unresolve a comment
	 * PUT /api/v1/comments/{id}/resolve?is_resolved=true/false
	 */
	async resolveComment(id: string, isResolved: boolean) {
		return this.client.put<CommentResponse, Record<string, never>>(
			`/api/v1/comments/${id}/resolve?is_resolved=${isResolved}`,
			{},
		);
	}
}

/**
 * React hook to get CommentService instance with authenticated API client
 */
export function useCommentService(): CommentService {
	const client = useApiClient();
	return useMemo(() => new CommentService(client), [client]);
}

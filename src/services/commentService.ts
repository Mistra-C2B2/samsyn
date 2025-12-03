import {
  CommentCreate,
  CommentUpdate,
  CommentResponse,
  CommentWithReplies,
} from '../types/api';
import { ApiClient, useApiClient } from './api';

/**
 * Query parameters for listing comments
 */
interface ListCommentsParams {
  map_id?: string;
  layer_id?: string;
  parent_id?: string;
  include_resolved?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Service for comment-related API operations
 */
export class CommentService {
  constructor(private client: ApiClient) {}

  /**
   * List comments with optional filtering
   * GET /api/v1/comments
   */
  async listComments(params: ListCommentsParams = {}): Promise<CommentResponse[]> {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();

    const path = queryString ? `/api/v1/comments?${queryString}` : '/api/v1/comments';
    return this.client.get<CommentResponse[]>(path);
  }

  /**
   * Get a single comment by ID
   * GET /api/v1/comments/{id}
   */
  async getComment(id: string): Promise<CommentResponse> {
    return this.client.get<CommentResponse>(`/api/v1/comments/${id}`);
  }

  /**
   * Get a comment thread (comment with nested replies)
   * GET /api/v1/comments/{id}/thread
   */
  async getCommentThread(id: string, maxDepth?: number): Promise<CommentWithReplies> {
    const queryString = maxDepth !== undefined ? `?max_depth=${maxDepth}` : '';
    return this.client.get<CommentWithReplies>(`/api/v1/comments/${id}/thread${queryString}`);
  }

  /**
   * Create a new comment
   * POST /api/v1/comments
   */
  async createComment(data: CommentCreate): Promise<CommentResponse> {
    return this.client.post<CommentResponse, CommentCreate>('/api/v1/comments', data);
  }

  /**
   * Update a comment
   * PUT /api/v1/comments/{id}
   */
  async updateComment(id: string, data: CommentUpdate): Promise<CommentResponse> {
    return this.client.put<CommentResponse, CommentUpdate>(`/api/v1/comments/${id}`, data);
  }

  /**
   * Delete a comment
   * DELETE /api/v1/comments/{id}
   */
  async deleteComment(id: string): Promise<void> {
    return this.client.delete<void>(`/api/v1/comments/${id}`);
  }

  /**
   * Resolve or unresolve a comment
   * PUT /api/v1/comments/{id}/resolve
   */
  async resolveComment(id: string, isResolved: boolean): Promise<CommentResponse> {
    return this.client.put<CommentResponse, { is_resolved: boolean }>(
      `/api/v1/comments/${id}/resolve`,
      { is_resolved: isResolved }
    );
  }
}

/**
 * React hook to get CommentService instance with authenticated API client
 */
export function useCommentService(): CommentService {
  const client = useApiClient();
  return new CommentService(client);
}

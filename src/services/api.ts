import { useAuth } from '@clerk/clerk-react';

/**
 * HTTP Client for SamSyn API with Clerk authentication
 */
export class ApiClient {
  private baseURL: string;
  private getToken: () => Promise<string | null>;

  constructor(baseURL: string, getToken: () => Promise<string | null>) {
    this.baseURL = baseURL;
    this.getToken = getToken;
  }

  /**
   * Build headers with authentication and content type
   */
  private async buildHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = await this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Handle HTTP response and parse JSON or handle no content
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    // Parse response body
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (isJson) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.detail || errorMessage;
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
    return {} as T;
  }

  /**
   * GET request
   */
  async get<T>(path: string): Promise<T> {
    const headers = await this.buildHeaders();
    const response = await fetch(`${this.baseURL}${path}`, {
      method: 'GET',
      headers,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * POST request
   */
  async post<T, D = unknown>(path: string, data?: D): Promise<T> {
    const headers = await this.buildHeaders();
    const response = await fetch(`${this.baseURL}${path}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * PUT request
   */
  async put<T, D = unknown>(path: string, data?: D): Promise<T> {
    const headers = await this.buildHeaders();
    const response = await fetch(`${this.baseURL}${path}`, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string): Promise<T> {
    const headers = await this.buildHeaders();
    const response = await fetch(`${this.baseURL}${path}`, {
      method: 'DELETE',
      headers,
    });

    return this.handleResponse<T>(response);
  }
}

/**
 * React hook to get configured API client with Clerk authentication
 */
export function useApiClient(): ApiClient {
  const { getToken } = useAuth();

  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  return new ApiClient(baseURL, getToken);
}

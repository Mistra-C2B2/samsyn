# Phase 7 Implementation Plan: Frontend Integration

**Status**: ✅ **COMPLETED**
**Date**: December 2, 2025
**Phase**: Frontend Integration with Backend API

---

## Overview

Phase 7 integrates the React frontend with the completed backend API (Phases 1-6). This phase replaces all mock data with real API calls, adds loading states, error handling, and completes end-to-end testing of the SamSyn application.

---

## Current State

### Backend (Completed ✅)
- ✅ **Phase 1**: Database setup, FastAPI, models
- ✅ **Phase 2**: Authentication (Clerk webhooks, JWT)
- ✅ **Phase 3**: Maps CRUD API
- ✅ **Phase 4**: Layers CRUD API
- ✅ **Phase 5**: Vector Features API with PostGIS
- ✅ **Phase 6**: Comments System with threading

**Backend URL**: `http://localhost:8000`
**API Docs**: `http://localhost:8000/docs`

### Frontend (Current State)
- ✅ React + Vite + TypeScript setup
- ✅ Clerk authentication configured (`.env.local`)
- ✅ UI components (MapView, LayerManager, CommentSection, etc.)
- ⚠️ **Mock data** in `src/App.tsx` (lines 77-382)
- ❌ No API client services
- ❌ No backend integration
- ❌ No loading/error states

---

## Architecture Changes

### Before (Phase 6)
```
Frontend (React)
  └─ Mock Data (in-memory state)
  └─ Components render from mock data
```

### After (Phase 7)
```
Frontend (React)
  └─ API Services Layer
      └─ HTTP Client (fetch/axios)
      └─ TypeScript Interfaces (match backend schemas)
      └─ Error Handling
      └─ Loading States
  └─ Components render from API data
  └─ Vite Proxy (/api/* → http://localhost:8000/api/*)
```

---

## Implementation Tasks

### Task 1: Create TypeScript API Types
**File**: `src/types/api.ts`

**Purpose**: Define TypeScript interfaces matching backend schemas

**Interfaces to create**:

```typescript
// Comment types (match backend schemas from Phase 6)
export interface CommentCreate {
  content: string;
  map_id?: string;
  layer_id?: string;
  parent_id?: string;
}

export interface CommentUpdate {
  content: string;
}

export interface CommentResponse {
  id: string;
  content: string;
  author_id: string;
  author_name: string | null;
  map_id: string | null;
  layer_id: string | null;
  parent_id: string | null;
  is_resolved: boolean;
  reply_count: number;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface CommentWithReplies extends CommentResponse {
  replies: CommentResponse[];
}

// Map types (from Phase 3)
export interface MapCreate {
  name: string;
  description?: string;
  center: [number, number];
  zoom: number;
  permissions?: {
    edit_access: 'private' | 'collaborators' | 'public';
    collaborators?: string[];
    visibility: 'private' | 'public';
  };
}

export interface MapResponse {
  id: string;
  name: string;
  description: string | null;
  center: [number, number];
  zoom: number;
  created_by: string;
  permissions: {
    edit_access: string;
    collaborators: string[];
    visibility: string;
  };
  created_at: string;
  updated_at: string;
}

// Layer types (from Phase 4)
export interface LayerCreate {
  name: string;
  layer_type: string;
  description?: string;
  visible?: boolean;
  opacity?: number;
  editable?: 'creator-only' | 'everyone';
  style?: Record<string, any>;
  legend?: Record<string, any>;
}

export interface LayerResponse {
  id: string;
  map_id: string;
  name: string;
  layer_type: string;
  description: string | null;
  visible: boolean;
  opacity: number;
  created_by: string;
  editable: string;
  style: Record<string, any> | null;
  legend: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

// Feature types (from Phase 5)
export interface FeatureCreate {
  geometry: GeoJSON.Geometry;
  properties?: Record<string, any>;
  feature_type?: string;
}

export interface FeatureResponse {
  id: string;
  layer_id: string;
  geometry: GeoJSON.Geometry;
  properties: Record<string, any>;
  feature_type: string | null;
  created_at: string;
  updated_at: string;
}

// API Error types
export interface APIError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>;
}
```

---

### Task 2: Create Base API Client
**File**: `src/services/api.ts`

**Purpose**: HTTP client with authentication and error handling

**Implementation**:

```typescript
import { useAuth } from '@clerk/clerk-react';

// Get backend URL from environment or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiClient {
  private baseUrl: string;
  private getToken: () => Promise<string | null>;

  constructor(baseUrl: string, getToken: () => Promise<string | null>) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: 'An error occurred',
      }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Hook to use API client with Clerk authentication
export function useApiClient() {
  const { getToken } = useAuth();
  return new ApiClient(API_BASE_URL, getToken);
}
```

---

### Task 3: Create Comment Service
**File**: `src/services/commentService.ts`

**Purpose**: Type-safe API calls for all comment endpoints

**Methods**:

```typescript
import { ApiClient } from './api';
import { CommentCreate, CommentUpdate, CommentResponse, CommentWithReplies } from '../types/api';

export class CommentService {
  constructor(private client: ApiClient) {}

  // GET /api/v1/comments
  async listComments(params: {
    map_id?: string;
    layer_id?: string;
    parent_id?: string;
    include_resolved?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<CommentResponse[]> {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return this.client.get(`/api/v1/comments?${queryString}`);
  }

  // GET /api/v1/comments/{id}
  async getComment(id: string): Promise<CommentResponse> {
    return this.client.get(`/api/v1/comments/${id}`);
  }

  // GET /api/v1/comments/{id}/thread
  async getCommentThread(id: string, maxDepth = 10): Promise<CommentWithReplies> {
    return this.client.get(`/api/v1/comments/${id}/thread?max_depth=${maxDepth}`);
  }

  // POST /api/v1/comments
  async createComment(data: CommentCreate): Promise<CommentResponse> {
    return this.client.post('/api/v1/comments', data);
  }

  // PUT /api/v1/comments/{id}
  async updateComment(id: string, data: CommentUpdate): Promise<CommentResponse> {
    return this.client.put(`/api/v1/comments/${id}`, data);
  }

  // DELETE /api/v1/comments/{id}
  async deleteComment(id: string): Promise<void> {
    return this.client.delete(`/api/v1/comments/${id}`);
  }

  // PUT /api/v1/comments/{id}/resolve
  async resolveComment(id: string, isResolved: boolean): Promise<CommentResponse> {
    return this.client.put(`/api/v1/comments/${id}/resolve?is_resolved=${isResolved}`, {});
  }
}

// Hook to use comment service
export function useCommentService() {
  const client = useApiClient();
  return new CommentService(client);
}
```

---

### Task 4: Configure Vite Proxy
**File**: `vite.config.ts`

**Changes**:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // ... rest of config
});
```

**Purpose**:
- Proxies `/api/*` requests to backend at `http://localhost:8000/api/*`
- Avoids CORS issues during development
- Allows frontend to use relative URLs like `/api/v1/comments`

---

### Task 5: Update Environment Configuration
**File**: `.env.local` (add to existing file)

**Add**:
```env
VITE_API_URL=http://localhost:8000
```

**Note**: Keep existing `VITE_CLERK_PUBLISHABLE_KEY` unchanged

---

### Task 6: Update Comment Interfaces in App.tsx
**File**: `src/App.tsx`

**Changes**:

1. **Update Comment interface** (around line 15-24):
```typescript
// Remove old Comment interface from CommentSection.tsx imports
import { CommentResponse } from './types/api';

// Use CommentResponse from API types
// Rename internal state to match backend
```

2. **Replace mock comments** (lines 342-382):
```typescript
const [comments, setComments] = useState<CommentResponse[]>([]);
const [commentsLoading, setCommentsLoading] = useState(false);
const [commentsError, setCommentsError] = useState<string | null>(null);
```

3. **Add API integration hooks**:
```typescript
const commentService = useCommentService();

// Load comments when map changes
useEffect(() => {
  if (currentMap?.id) {
    loadComments(currentMap.id);
  }
}, [currentMap?.id]);

const loadComments = async (mapId: string) => {
  setCommentsLoading(true);
  setCommentsError(null);
  try {
    const data = await commentService.listComments({ map_id: mapId });
    setComments(data);
  } catch (error) {
    setCommentsError(error.message);
    toast.error('Failed to load comments');
  } finally {
    setCommentsLoading(false);
  }
};

const handleAddComment = async (commentData: Omit<CommentCreate, 'author_id'>) => {
  try {
    const newComment = await commentService.createComment(commentData);
    setComments([...comments, newComment]);
    toast.success('Comment added');
  } catch (error) {
    toast.error('Failed to add comment');
  }
};
```

---

### Task 7: Update CommentSection Component
**File**: `src/components/CommentSection.tsx`

**Changes**:

1. **Update imports**:
```typescript
import { CommentResponse } from '../types/api';
import { useCommentService } from '../services/commentService';
```

2. **Update props interface**:
```typescript
interface CommentSectionProps {
  mapId: string;
  mapName: string;
  layers: Layer[];
  initialLayerId?: string | null;
  comments: CommentResponse[];
  loading?: boolean;
  error?: string | null;
  onAddComment: (comment: { content: string; map_id?: string; layer_id?: string; parent_id?: string }) => void;
  onDeleteComment?: (commentId: string) => void;
  onResolveComment?: (commentId: string, isResolved: boolean) => void;
  onClose: () => void;
}
```

3. **Add loading and error states**:
```typescript
if (loading) {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin" />
      <span className="ml-2">Loading comments...</span>
    </div>
  );
}

if (error) {
  return (
    <div className="p-4 bg-red-50 text-red-600">
      Error: {error}
    </div>
  );
}
```

4. **Update comment rendering** to use backend fields:
- `author_name` instead of `author`
- `created_at` instead of `timestamp`
- Add resolve button for `is_resolved` status
- Handle `reply_count` display

---

### Task 8: Add Map and Layer Services (Optional - if needed)
**Files**:
- `src/services/mapService.ts`
- `src/services/layerService.ts`
- `src/services/featureService.ts`

**Priority**: Lower priority - focus on comments first
**Reason**: Maps, layers, and features are more complex and can be added incrementally

---

### Task 9: End-to-End Testing
**Manual testing checklist**:

1. **Backend Running**:
   ```bash
   cd /workspace/backend
   .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Frontend Running**:
   ```bash
   cd /workspace
   npm run dev
   ```

3. **Test Scenarios**:
   - [ ] Load comments for a map
   - [ ] Add a new comment on map
   - [ ] Add a comment on a specific layer
   - [ ] Reply to a comment (threading)
   - [ ] Edit own comment
   - [ ] Delete own comment
   - [ ] Resolve/unresolve a comment
   - [ ] View comment thread with nested replies
   - [ ] Filter comments by layer
   - [ ] Verify loading states show correctly
   - [ ] Verify error handling (disconnect backend and try actions)
   - [ ] Verify authentication (JWT token in requests)

4. **Browser Console Checks**:
   - No console errors
   - API requests show in Network tab
   - JWT token in Authorization headers

5. **Backend API Logs**:
   - Verify requests are received
   - Check for any server errors

---

## API Integration Summary

### Comment Endpoints Used

| Frontend Action | Backend Endpoint | HTTP Method |
|----------------|------------------|-------------|
| Load comments for map | `GET /api/v1/comments?map_id={id}` | GET |
| Load comments for layer | `GET /api/v1/comments?layer_id={id}` | GET |
| Add comment | `POST /api/v1/comments` | POST |
| Get comment thread | `GET /api/v1/comments/{id}/thread` | GET |
| Edit comment | `PUT /api/v1/comments/{id}` | PUT |
| Delete comment | `DELETE /api/v1/comments/{id}` | DELETE |
| Resolve comment | `PUT /api/v1/comments/{id}/resolve` | PUT |

---

## Data Flow

### Loading Comments
```
User opens CommentSection
  → App.tsx calls loadComments(mapId)
    → CommentService.listComments({ map_id: mapId })
      → ApiClient.get('/api/v1/comments?map_id=...')
        → Vite proxy forwards to http://localhost:8000/api/v1/comments
          → Backend returns CommentResponse[]
        → Update comments state
      → CommentSection renders comments
```

### Adding Comment
```
User types comment and submits
  → CommentSection calls onAddComment({ content, map_id })
    → App.tsx calls handleAddComment()
      → CommentService.createComment(data)
        → ApiClient.post('/api/v1/comments', data)
          → Backend creates comment, returns CommentResponse
        → Add to comments state
      → Toast success message
    → CommentSection re-renders with new comment
```

---

## Expected Deliverables

1. ✅ TypeScript API types matching backend schemas
2. ✅ Base API client with authentication
3. ✅ Comment service with all 7 endpoints
4. ✅ Vite proxy configuration
5. ✅ Environment variable setup
6. ✅ Updated App.tsx with API integration
7. ✅ Updated CommentSection with loading/error states
8. ✅ End-to-end testing completed
9. ✅ Documentation (this plan + summary)

---

## Success Criteria

- ✅ No mock data in frontend (except for map/layer examples)
- ✅ All comment operations work via API
- ✅ Loading states show during API calls
- ✅ Error messages display on failures
- ✅ Authentication tokens sent in requests
- ✅ CORS issues resolved via proxy
- ✅ TypeScript types match backend schemas
- ✅ No console errors in browser
- ✅ Backend logs show successful requests

---

## Estimated Effort

- Task 1 (API Types): 30 minutes
- Task 2 (Base API Client): 45 minutes
- Task 3 (Comment Service): 30 minutes
- Task 4 (Vite Proxy): 15 minutes
- Task 5 (Environment): 10 minutes
- Task 6 (Update App.tsx): 1 hour
- Task 7 (Update CommentSection): 45 minutes
- Task 8 (Other Services): 2 hours (optional, can defer)
- Task 9 (Testing): 1 hour

**Total (Core Tasks 1-7, 9)**: ~4-5 hours
**Total (All Tasks)**: ~6-7 hours

---

## Known Limitations & Future Enhancements

### Current Scope (Phase 7)
- Comments API only (maps/layers/features remain mock for now)
- No real-time updates (manual refresh required)
- No offline support
- No optimistic UI updates

### Future Enhancements (Post-Phase 7)
1. **Map/Layer/Feature API Integration**: Full backend integration
2. **Real-time Updates**: WebSocket for live comments
3. **Optimistic UI**: Immediate UI updates before API confirmation
4. **Offline Support**: Service workers and local caching
5. **Infinite Scroll**: Pagination for large comment lists
6. **Rich Text Editor**: Markdown support in comments
7. **File Attachments**: Upload images/documents in comments
8. **Notifications**: Email/push notifications for new comments
9. **Comment Search**: Full-text search across comments
10. **Comment Reactions**: Like/emoji reactions on comments

---

## Integration with Existing System

### Dependencies
- **Backend**: Phases 1-6 completed (all endpoints available)
- **Clerk Auth**: Already configured in frontend
- **Vite Dev Server**: Running on port 3000
- **Backend Server**: Running on port 8000
- **PostgreSQL**: Database with PostGIS

### Phase Alignment
- ✅ **Phase 1-6**: Backend complete
- 🚧 **Phase 7**: Frontend Integration ← **CURRENT**
- 🔜 **Post-MVP**: Real-time features, advanced UI

---

## Next Steps After Phase 7

1. **Deploy to Production**:
   - Backend: Deploy to cloud (AWS/GCP/Heroku)
   - Frontend: Deploy to Vercel/Netlify
   - Database: Managed PostgreSQL with PostGIS

2. **Performance Optimization**:
   - Add React Query for caching
   - Implement virtual scrolling for large lists
   - Optimize bundle size with code splitting

3. **Security Hardening**:
   - Add CSRF protection
   - Implement rate limiting
   - Add content security policy

4. **Monitoring & Analytics**:
   - Add error tracking (Sentry)
   - Add analytics (Mixpanel/PostHog)
   - Add performance monitoring

---

## Troubleshooting Guide

### Common Issues

**Issue**: CORS errors in browser console
**Solution**: Ensure Vite proxy is configured and both servers are running

**Issue**: 401 Unauthorized errors
**Solution**: Check Clerk authentication, verify token in network requests

**Issue**: 404 Not Found for `/api/v1/comments`
**Solution**: Verify backend is running and migration is applied

**Issue**: TypeScript errors for API types
**Solution**: Ensure types match backend schemas exactly (check OpenAPI docs)

**Issue**: Comments not loading
**Solution**: Check browser network tab, verify API request is sent, check backend logs

---

## Resources

- **Backend API Docs**: http://localhost:8000/docs
- **Phase 6 Summary**: `/workspace/PHASE6_IMPLEMENTATION_SUMMARY.md`
- **Clerk Docs**: https://clerk.com/docs
- **Vite Proxy Docs**: https://vitejs.dev/config/server-options.html#server-proxy

---

**Ready to begin Phase 7 implementation!**

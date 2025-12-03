import { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Layer } from '../App';
import { CommentResponse } from '../types/api';
import { X, Send, Loader2 } from 'lucide-react';

interface CommentSectionProps {
  mapId: string;
  mapName: string;
  layers: Layer[];
  initialLayerId?: string | null;
  comments: CommentResponse[];
  loading?: boolean;
  error?: string | null;
  onAddComment: (comment: {
    content: string;
    map_id?: string;
    layer_id?: string;
    parent_id?: string;
  }) => void;
  onClose: () => void;
}

interface CommentItemProps {
  comment: CommentResponse & { replies?: CommentResponse[] };
  onReply: (commentId: string) => void;
  depth?: number;
}

function CommentItem({ comment, onReply, depth = 0 }: CommentItemProps) {
  const [collapsed, setCollapsed] = useState(false);

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  // Check if this comment has nested replies in the tree we built
  const hasReplies = comment.replies && comment.replies.length > 0;
  const authorName = comment.author_name || 'Unknown User';

  // Generate initials from author name
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {hasReplies && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-0 h-auto hover:bg-transparent flex-shrink-0 mt-1 text-slate-400 hover:text-slate-600"
          >
            {collapsed ? '▶' : '▼'}
          </button>
        )}
        {!hasReplies && depth > 0 && (
          <div className="w-4" />
        )}
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="bg-slate-200 text-slate-600 text-xs">
            {getInitials(authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-slate-900">{authorName}</span>
            <span className="text-xs text-slate-400">
              {formatTimestamp(comment.created_at)}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">{comment.content}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReply(comment.id)}
            className="mt-1 h-auto p-1 text-xs text-slate-500 hover:text-teal-600"
          >
            Reply {comment.reply_count > 0 && `(${comment.reply_count})`}
          </Button>
        </div>
      </div>

      {/* Nested replies */}
      {hasReplies && !collapsed && (
        <div className="ml-8 pl-4 border-l-2 border-slate-200 space-y-3">
          {comment.replies!.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentSection({ mapId, mapName, layers, initialLayerId, comments, loading, error, onAddComment, onClose }: CommentSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [commentTarget, setCommentTarget] = useState<string>(initialLayerId || mapId);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Loading state
  if (loading) {
    return (
      <div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg z-40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-slate-900">Comments</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading comments...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg z-40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-slate-900">Comments</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-600 mb-2">Error loading comments</p>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Simple inline SVG icons to match lucide-react style
  const MapIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );

  const LayersIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );

  // Build nested comment tree from flat list using parent_id
  const buildCommentTree = (comments: CommentResponse[]): (CommentResponse & { replies?: CommentResponse[] })[] => {
    const commentMap = new Map<string, CommentResponse & { replies?: CommentResponse[] }>();
    const rootComments: (CommentResponse & { replies?: CommentResponse[] })[] = [];

    // First pass: create a map of all comments with empty replies arrays
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: organize into tree structure
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies!.push(commentWithReplies);
        } else {
          // If parent not found, treat as root comment
          rootComments.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments;
  };

  // Filter comments based on selected target using backend field names
  const filteredComments = comments.filter(comment => {
    if (commentTarget === mapId) {
      // Show comments on the map (map_id matches and layer_id is null)
      return comment.map_id === mapId && comment.layer_id === null;
    } else {
      // Show comments on specific layer
      return comment.layer_id === commentTarget;
    }
  });
  const commentTree = buildCommentTree(filteredComments);

  // Get comment count for a specific target (including replies)
  const getCommentCount = (targetId: string) => {
    if (targetId === mapId) {
      return comments.filter(c => c.map_id === mapId && c.layer_id === null).length;
    } else {
      return comments.filter(c => c.layer_id === targetId).length;
    }
  };

  const handleSubmit = () => {
    if (newComment.trim()) {
      setIsSubmitting(true);
      onAddComment({
        content: newComment,
        map_id: commentTarget === mapId ? mapId : undefined,
        layer_id: commentTarget === mapId ? undefined : commentTarget,
        parent_id: replyingTo || undefined,
      });
      setNewComment('');
      setReplyingTo(null);
      setIsSubmitting(false);
    }
  };

  const currentTargetName = commentTarget === mapId
    ? mapName
    : layers.find(l => l.id === commentTarget)?.name || 'Unknown';

  // Get the comment being replied to
  const replyingToComment = replyingTo ? comments.find(c => c.id === replyingTo) : null;
  const replyingToAuthor = replyingToComment?.author_name || 'Unknown User';

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg z-40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-slate-900">Comments</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X />
        </Button>
      </div>

      {/* Context Selector */}
      <div className="px-4 py-3 border-b border-slate-200 space-y-2">
        <label className="text-xs text-slate-600">Commenting on:</label>
        <Select onValueChange={setCommentTarget} value={commentTarget}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={mapId}>
              <div className="flex items-center gap-2">
                <MapIcon />
                <span>{mapName}</span>
                {getCommentCount(mapId) > 0 && (
                  <span className="ml-auto text-xs text-slate-500">({getCommentCount(mapId)})</span>
                )}
              </div>
            </SelectItem>
            {layers.map(layer => (
              <SelectItem key={layer.id} value={layer.id}>
                <div className="flex items-center gap-2">
                  <LayersIcon />
                  <span>{layer.name}</span>
                  {getCommentCount(layer.id) > 0 && (
                    <span className="ml-auto text-xs text-slate-500">({getCommentCount(layer.id)})</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {commentTree.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onReply={setReplyingTo}
          />
        ))}

        {filteredComments.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">
            No comments on "{currentTargetName}" yet. Be the first to comment!
          </p>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 space-y-2">
        {replyingToComment && (
          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-500">Replying to <span className="font-medium text-slate-700">{replyingToAuthor}</span></span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(null)}
                className="h-auto p-0 text-slate-400 hover:text-slate-600"
              >
                ✕
              </Button>
            </div>
            <p className="text-slate-600 line-clamp-2">{replyingToComment.content}</p>
          </div>
        )}
        <Textarea
          placeholder={replyingToComment ? "Write your reply..." : "Add a comment..."}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />
        <Button onClick={handleSubmit} className="w-full" disabled={!newComment.trim() || isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              {replyingToComment ? 'Post Reply' : 'Post Comment'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
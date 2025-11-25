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
import { X, Send, Loader2 } from 'lucide-react';

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
  targetType: 'map' | 'layer';
  targetId: string;
  parentId?: string; // ID of parent comment if this is a reply
  replies?: Comment[]; // Nested replies
}

interface CommentSectionProps {
  mapId: string;
  mapName: string;
  layers: Layer[];
  initialLayerId?: string | null;
  comments: Comment[];
  onAddComment: (comment: Omit<Comment, 'id' | 'timestamp'>) => void;
  onClose: () => void;
}

interface CommentItemProps {
  comment: Comment;
  onReply: (commentId: string) => void;
  depth?: number;
}

function CommentItem({ comment, onReply, depth = 0 }: CommentItemProps) {
  const [collapsed, setCollapsed] = useState(false);
  
  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const hasReplies = comment.replies && comment.replies.length > 0;

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
            {comment.author.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-slate-900">{comment.author}</span>
            <span className="text-xs text-slate-400">
              {formatTimestamp(comment.timestamp)}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">{comment.content}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReply(comment.id)}
            className="mt-1 h-auto p-1 text-xs text-slate-500 hover:text-teal-600"
          >
            Reply
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

export function CommentSection({ mapId, mapName, layers, initialLayerId, comments, onAddComment, onClose }: CommentSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [commentTarget, setCommentTarget] = useState<string>(initialLayerId || mapId);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Build nested comment tree
  const buildCommentTree = (comments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // First pass: create a map of all comments with empty replies arrays
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: organize into tree structure
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
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

  // Filter comments based on selected target and build tree
  const filteredComments = comments.filter(comment => comment.targetId === commentTarget);
  const commentTree = buildCommentTree(filteredComments);

  // Get comment count for a specific target (including replies)
  const getCommentCount = (targetId: string) => {
    return comments.filter(c => c.targetId === targetId).length;
  };

  const handleSubmit = () => {
    if (newComment.trim()) {
      setIsSubmitting(true);
      onAddComment({
        author: 'Current User',
        content: newComment,
        targetType: commentTarget === mapId ? 'map' : 'layer',
        targetId: commentTarget,
        parentId: replyingTo || undefined,
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
              <span className="text-slate-500">Replying to <span className="font-medium text-slate-700">{replyingToComment.author}</span></span>
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
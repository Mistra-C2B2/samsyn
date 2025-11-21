import { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback } from './ui/avatar';
import { X, Send, Map, Layers } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Layer } from '../App';

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
  targetType: 'map' | 'layer';
  targetId: string;
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

export function CommentSection({ mapId, mapName, layers, initialLayerId, comments, onAddComment, onClose }: CommentSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [commentTarget, setCommentTarget] = useState<string>(initialLayerId || mapId);

  // Filter comments based on selected target
  const filteredComments = comments.filter(comment => comment.targetId === commentTarget);

  // Get comment count for a specific target
  const getCommentCount = (targetId: string) => {
    return comments.filter(c => c.targetId === targetId).length;
  };

  const handleSubmit = () => {
    if (newComment.trim()) {
      onAddComment({
        author: 'Current User',
        content: newComment,
        targetType: commentTarget === mapId ? 'map' : 'layer',
        targetId: commentTarget,
      });
      setNewComment('');
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const currentTargetName = commentTarget === mapId 
    ? mapName 
    : layers.find(l => l.id === commentTarget)?.name || 'Unknown';

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-slate-900">Comments</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
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
                <Map className="w-4 h-4" />
                <span>{mapName}</span>
                {getCommentCount(mapId) > 0 && (
                  <span className="ml-auto text-xs text-slate-500">({getCommentCount(mapId)})</span>
                )}
              </div>
            </SelectItem>
            {layers.map(layer => (
              <SelectItem key={layer.id} value={layer.id}>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
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
        {filteredComments.map((comment) => (
          <div key={comment.id} className="space-y-2">
            <div className="flex items-start gap-3">
              <Avatar className="w-8 h-8">
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
              </div>
            </div>
          </div>
        ))}

        {filteredComments.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">
            No comments on "{currentTargetName}" yet. Be the first to comment!
          </p>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 space-y-2">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />
        <Button onClick={handleSubmit} className="w-full">
          <Send className="w-4 h-4" />
          Post Comment
        </Button>
      </div>
    </div>
  );
}
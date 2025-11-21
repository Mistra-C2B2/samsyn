import { Layer } from '../App';

interface LegendProps {
  layer: Layer;
}

export function Legend({ layer }: LegendProps) {
  if (!layer.legend) return null;

  return (
    <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200 p-3 shadow-lg max-w-xs">
      <h3 className="text-sm text-slate-900 mb-2">{layer.name}</h3>
      
      {layer.legend.type === 'gradient' ? (
        <div className="space-y-1">
          <div
            className="h-4 w-full rounded"
            style={{
              background: `linear-gradient(to right, ${layer.legend.items
                .map(item => item.color)
                .join(', ')})`,
            }}
          />
          <div className="flex justify-between text-xs text-slate-600">
            {layer.legend.items.map((item, index) => (
              <span key={index}>{item.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {layer.legend.items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-slate-300"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-slate-700">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui/button";

interface Props {
	children: ReactNode;
	onReset?: () => void;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class LayerCreatorErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("LayerCreator error:", error, errorInfo);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
		this.props.onReset?.();
	};

	render() {
		if (this.state.hasError) {
			return (
				<div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg">
					<div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
						<div className="p-3 bg-red-100 rounded-full mb-4">
							<AlertTriangle className="w-8 h-8 text-red-600" />
						</div>
						<h3 className="text-lg font-medium text-slate-900 mb-2">
							Something went wrong
						</h3>
						<p className="text-sm text-slate-600 mb-4">
							An error occurred while working with the layer editor.
						</p>
						<Button onClick={this.handleReset} variant="outline">
							<RefreshCw className="w-4 h-4 mr-2" />
							Try Again
						</Button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

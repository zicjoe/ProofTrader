import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export function PageLoading({ label = "Loading trading snapshot..." }: { label?: string }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <Card className="w-full max-w-xl border-zinc-800 bg-zinc-900">
        <CardContent className="flex items-center justify-center gap-3 py-16 text-zinc-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{label}</span>
        </CardContent>
      </Card>
    </div>
  );
}

export function PageError({
  title = "Could not load data",
  message,
  onRetry
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <Card className="w-full max-w-xl border-red-950 bg-zinc-900">
        <CardContent className="space-y-4 py-10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
            <div>
              <h2 className="font-semibold text-white">{title}</h2>
              <p className="mt-1 text-sm text-zinc-400">{message}</p>
            </div>
          </div>
          {onRetry ? (
            <Button onClick={onRetry} variant="outline" className="gap-2 border-zinc-700 bg-zinc-800">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function EmptyState({
  title,
  message
}: {
  title: string;
  message: string;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardContent className="py-14 text-center">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>
      </CardContent>
    </Card>
  );
}

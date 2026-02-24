"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function ClawDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Claw detail error:", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <Card className="max-w-md glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Claw
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground/80">
            {error.message || "Failed to load claw details."}
          </p>
          <div className="flex gap-2">
            <Button onClick={reset} className="btn-gradient text-white rounded-xl">Try again</Button>
            <Link href="/dashboard">
              <Button variant="outline" className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300">Back to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

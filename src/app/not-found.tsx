import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md w-full text-center glass gradient-border">
        <CardHeader>
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 ring-1 ring-white/[0.06]">
              <FileQuestion className="h-8 w-8 text-indigo-400/60" />
            </div>
          </div>
          <CardTitle className="text-2xl mt-4">Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground/80">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link href="/dashboard">
            <Button className="btn-gradient text-white rounded-xl">Go to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

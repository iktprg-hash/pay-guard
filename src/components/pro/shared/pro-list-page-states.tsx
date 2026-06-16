"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProRefreshingIndicator } from "@/components/pro/pro-refreshing-indicator";

interface ProListErrorCardProps {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
}

/** Error card with retry — matches dashboard/forecast UX on list pages. */
export function ProListErrorCard({
  title,
  description,
  retryLabel,
  onRetry,
}: ProListErrorCardProps) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

interface ProListRefreshingProps {
  visible: boolean;
  label: string;
}

/** Background refetch indicator for Pro list pages. */
export function ProListRefreshing({ visible, label }: ProListRefreshingProps) {
  return <ProRefreshingIndicator visible={visible} label={label} />;
}

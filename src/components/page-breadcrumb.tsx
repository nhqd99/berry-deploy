import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";

export function PageBreadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && <BreadcrumbSeparator className="text-muted-foreground/30" />}
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href} className="text-muted-foreground/60 hover:text-foreground transition-colors duration-200">{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-foreground/90">{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

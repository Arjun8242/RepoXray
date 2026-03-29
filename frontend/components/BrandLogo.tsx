import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  priority?: boolean;
};

const DIMENSIONS: Record<NonNullable<BrandLogoProps["size"]>, { width: number; height: number }> = {
  sm: { width: 180, height: 109 },
  md: { width: 260, height: 158 },
  lg: { width: 360, height: 219 },
};

export function BrandLogo({ size = "md", className, priority = false }: BrandLogoProps) {
  const dimension = DIMENSIONS[size];

  return (
    <Image
      src="/repoxray-logo.svg"
      alt="RepoXray"
      width={dimension.width}
      height={dimension.height}
      priority={priority}
      className={cn("h-auto", className)}
    />
  );
}
"use client";

import { useState } from "react";

interface ProjectLogoProps {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}

/**
 * ProjectLogo — renders a project logo image with fallback.
 * If no logo URL is available, generates a colored placeholder
 * with the project's first letter.
 */
export function ProjectLogo({ src, name, size = 24, className }: ProjectLogoProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;
  const hue = stringToHue(name);

  const placeholderStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: `${size * 0.45}px`,
    fontWeight: 700,
    color: "var(--bg)",
    background: `linear-gradient(135deg, hsl(${hue}, 65%, 45%), hsl(${(hue + 40) % 360}, 65%, 45%))`,
    flexShrink: 0,
  };

  if (!showImage) {
    return (
      <div className={`project-logo-fallback ${className ?? ""}`} style={placeholderStyle}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`project-logo ${className ?? ""}`}
      style={{ borderRadius: "4px", flexShrink: 0, objectFit: "cover" }}
      onError={() => setImgError(true)}
    />
  );
}

function stringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

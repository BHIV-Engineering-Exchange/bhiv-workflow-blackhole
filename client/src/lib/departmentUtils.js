/**
 * Utility to safely normalize department colors (Tailwind classes, hex colors, or color names)
 * into format suitable for className, inline style, and hex color values.
 */
export function getDeptColor(color) {
  if (!color) {
    return {
      bgClass: "bg-emerald-500",
      style: { backgroundColor: "#10b981" },
      borderLeftStyle: { borderLeftColor: "#10b981" },
      hexColor: "#10b981"
    }
  }

  // Handle Hex, RGB, HSL strings (e.g. #3b82f6, rgb(59, 130, 246))
  if (color.startsWith("#") || color.startsWith("rgb") || color.startsWith("hsl")) {
    return {
      bgClass: "",
      style: { backgroundColor: color },
      borderLeftStyle: { borderLeftColor: color },
      hexColor: color
    }
  }

  // Map known Tailwind bg-* class names to corresponding hex codes for inline styling fallback
  const tailwindHexMap = {
    "bg-blue-500": "#3b82f6",
    "bg-green-500": "#22c55e",
    "bg-emerald-500": "#10b981",
    "bg-purple-500": "#a855f7",
    "bg-orange-500": "#f97316",
    "bg-amber-500": "#f59e0b",
    "bg-red-500": "#ef4444",
    "bg-indigo-500": "#6366f1",
    "bg-pink-500": "#ec4899",
    "bg-teal-500": "#14b8a6",
    "bg-cyan-500": "#06b6d4",
    "bg-slate-500": "#64748b",
    "bg-gray-500": "#6b7280",
    "bg-rose-500": "#f43f5e",
    "bg-violet-500": "#8b5cf6"
  }

  if (color.startsWith("bg-")) {
    const hex = tailwindHexMap[color] || "#3b82f6"
    return {
      bgClass: color,
      style: { backgroundColor: hex },
      borderLeftStyle: { borderLeftColor: hex },
      hexColor: hex
    }
  }

  // Handle color names like "blue", "green", "purple"
  const simpleColor = color.toLowerCase().trim()
  const colorMap = {
    blue: "#3b82f6",
    green: "#22c55e",
    emerald: "#10b981",
    purple: "#a855f7",
    orange: "#f97316",
    amber: "#f59e0b",
    red: "#ef4444",
    indigo: "#6366f1",
    pink: "#ec4899",
    teal: "#14b8a6",
    cyan: "#06b6d4",
    slate: "#64748b",
    gray: "#6b7280"
  }

  if (colorMap[simpleColor]) {
    const hex = colorMap[simpleColor]
    return {
      bgClass: `bg-${simpleColor}-500`,
      style: { backgroundColor: hex },
      borderLeftStyle: { borderLeftColor: hex },
      hexColor: hex
    }
  }

  // Fallback
  return {
    bgClass: "bg-emerald-500",
    style: { backgroundColor: "#10b981" },
    borderLeftStyle: { borderLeftColor: "#10b981" },
    hexColor: "#10b981"
  }
}

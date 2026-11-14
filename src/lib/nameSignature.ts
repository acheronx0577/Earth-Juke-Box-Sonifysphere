/** One bar per A–Z letter. The same name always draws the same mark. */
export function nameSignature(name: string, h = 34) {
  return name
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .map((letter, index) => ({
      x: index * 6,
      h: 6 + Math.round(((letter.charCodeAt(0) - 65) / 25) * (h - 6)),
    }));
}

export function nameInitials(name: string): string {
  return name
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part[0])
    .join("");
}

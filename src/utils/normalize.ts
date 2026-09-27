export function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        // Remove accents
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        // Remove common tags and platforms
        .replace(/\b(ps4|ps5|playstation 4|playstation 5|edition|edição|standard|deluxe|ultimate|premium|bundle)\b/g, '')
        // Remove special characters, keep alphanumeric and spaces
        .replace(/[^a-z0-9 ]/g, ' ')
        // Remove extra spaces
        .replace(/\s+/g, ' ')
        .trim();
}

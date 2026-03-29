const SUPPORTED_EXTENSIONS = [
  ".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".go", ".cpp", ".c", ".cs"
];

const SKIPPED_DIRECTORIES = [
  "node_modules", ".git", "dist", "build", "coverage", ".next", "out"
];

const SKIPPED_FILES = [
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "bun.lockb", "composer.lock", "poetry.lock"
];

const IMAGE_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico", ".tiff"
];

const BINARY_EXTENSIONS = [
  ".pdf", ".zip", ".gz", ".tar", ".7z", ".jar", ".exe",
  ".dll", ".so", ".dylib", ".bin", ".class"
];

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export function getFileFilterConfig(overrides = {}) {
  return {
    supportedCodeExtensions: overrides.supportedCodeExtensions || new Set(SUPPORTED_EXTENSIONS),
    skippedDirectories: overrides.skippedDirectories || new Set(SKIPPED_DIRECTORIES),
    skippedFileNames: overrides.skippedFileNames || new Set(SKIPPED_FILES),
    imageExtensions: overrides.imageExtensions || new Set(IMAGE_EXTENSIONS),
    knownBinaryExtensions: overrides.knownBinaryExtensions || new Set(BINARY_EXTENSIONS),
    maxFileSizeBytes: overrides.maxFileSizeBytes || MAX_FILE_SIZE
  };
}

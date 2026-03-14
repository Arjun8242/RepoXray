import path from "path";

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

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

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

export function shouldProcessFile(filePath, fileSizeBytes, options = {}) {
  const config = getFileFilterConfig(options);

  const normalized = filePath.replace(/\\/g, "/");
  const fileName = path.basename(normalized);
  const ext = path.extname(fileName).toLowerCase();

  // invalid path
  if (!normalized || normalized.endsWith("/")) {
    return { accepted: false, reason: "invalid_path" };
  }

  // skip directories
  for (const dir of config.skippedDirectories) {
    if (normalized.includes(`/${dir}/`)) {
      return { accepted: false, reason: "skipped_directory" };
    }
  }

  // skip lock/generated files
  if (config.skippedFileNames.has(fileName.toLowerCase())) {
    return { accepted: false, reason: "lock_or_generated_file" };
  }

  // skip minified code
  if (/\.min\.(js|ts|jsx|tsx)$/i.test(fileName)) {
    return { accepted: false, reason: "minified_file" };
  }

  // skip images
  if (config.imageExtensions.has(ext)) {
    return { accepted: false, reason: "image_file" };
  }

  // skip binaries
  if (config.knownBinaryExtensions.has(ext)) {
    return { accepted: false, reason: "binary_file" };
  }

  // only allow supported code files
  if (!config.supportedCodeExtensions.has(ext)) {
    return { accepted: false, reason: "unsupported_extension" };
  }

  // size limit
  if (typeof fileSizeBytes === "number" && fileSizeBytes > config.maxFileSizeBytes) {
    return { accepted: false, reason: "file_too_large" };
  }

  return { accepted: true, reason: null };
}
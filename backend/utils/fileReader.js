import fs from "fs/promises";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const BINARY_PROBE_BYTES = 4096;
const MAX_LINE_LENGTH = 20000;

export async function readSourceFile(filePath) {
  try {
    // 1️⃣ Check file stats
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      return { skipped: true, reason: "not_a_file" };
    }

    if (stats.size > MAX_FILE_SIZE) {
      return { skipped: true, reason: "file_too_large", sizeBytes: stats.size };
    }

    // 2️⃣ Detect binary files
    const handle = await fs.open(filePath, "r");
    const buffer = Buffer.alloc(Math.min(BINARY_PROBE_BYTES, stats.size));

    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    await handle.close();

    if (isBinary(buffer.slice(0, bytesRead))) {
      return { skipped: true, reason: "binary_file" };
    }

    // 3️⃣ Read full content
    let content = await fs.readFile(filePath, "utf8");

    // 4️⃣ Sanitize long lines
    const lines = content.split("\n").map((line) => {
      if (line.length > MAX_LINE_LENGTH) {
        return line.slice(0, MAX_LINE_LENGTH) + " /* truncated */";
      }
      return line;
    });

    content = lines.join("\n");

    return {
      skipped: false,
      sizeBytes: stats.size,
      content
    };

  } catch (error) {
    return { skipped: true, reason: "read_error", error };
  }
}

function isBinary(buffer) {
  let suspicious = 0;

  for (const byte of buffer) {
    if (byte === 0) return true;

    const isControl = byte < 7 || (byte > 14 && byte < 32);
    if (isControl) suspicious++;
  }

  return suspicious / buffer.length > 0.3;
}
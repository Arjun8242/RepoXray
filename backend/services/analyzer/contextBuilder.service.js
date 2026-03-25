const MAX_TOTAL_CONTEXT_CHARS = 80000;
const MAX_FILE_CONTEXT_CHARS = 12000;

// Infer execution role based on file path and execution score
function inferExecutionRole(file) {
  const path = file.path.toLowerCase();
  const executionScore = file.executionScore || 0;

  if (executionScore >= 10 && /server|app|main|index/.test(path)) {
    return "ENTRY_POINT";
  }

  if (/route|router/.test(path)) {
    return "ROUTER";
  }

  if (/controller|handler/.test(path)) {
    return "HANDLER";
  }

  if (/service/.test(path)) {
    return "SERVICE";
  }

  if (/config/.test(path)) {
    return "CONFIG";
  }

  return "IMPLEMENTATION";
}

// 🔥 Smart trimming: capture both start + end of file
function trimFileContent(content) {
  if (!content) return { text: "", truncated: false };

  if (content.length <= MAX_FILE_CONTEXT_CHARS) {
    return { text: content, truncated: false };
  }

  const headSize = Math.floor(MAX_FILE_CONTEXT_CHARS / 2);
  const tailSize = Math.floor(MAX_FILE_CONTEXT_CHARS / 2);

  const head = content.slice(0, headSize);
  const tail = content.slice(-tailSize);

  return {
    text: `${head}\n\n/* ... content truncated due to size limit ... */\n\n${tail}`,
    truncated: true,
  };
}

export function buildStructuredContext({ repoName, files }) {
  let totalChars = 0;
  const sections = [];
  const truncation = [];
  
  const roleCounts = {
    entryPoint: 0,
    router: 0,
    handler: 0,
    service: 0,
  };

  const sortedFiles = [...files].sort(
    (a, b) => (a.content?.length || 0) - (b.content?.length || 0)
  );

  for (const file of sortedFiles) {
    const prepared = trimFileContent(file.content);
    const role = inferExecutionRole(file);
    const executionScore = file.executionScore || 0;
    const queryScore = file.queryScore || 0;
    const reason = file.reason || "unknown";

    const section = [
      `[FILE: ${file.path}]`,
      `ROLE: ${role}`,
      `EXECUTION_SCORE: ${executionScore}`,
      `QUERY_SCORE: ${queryScore}`,
      `REASON: ${reason}`,
      `SIZE: ${file.content?.length || 0} chars`,
      prepared.text,
    ].join("\n");

    if (totalChars + section.length > MAX_TOTAL_CONTEXT_CHARS) {
      truncation.push({ file: file.path, reason: "global_context_limit" });
      continue;
    }

    totalChars += section.length;
    sections.push(section);
    
    if (role === "ENTRY_POINT") roleCounts.entryPoint++;
    else if (role === "ROUTER") roleCounts.router++;
    else if (role === "HANDLER") roleCounts.handler++;
    else if (role === "SERVICE") roleCounts.service++;

    if (prepared.truncated) {
      truncation.push({ file: file.path, reason: "file_context_limit" });
    }
  }

  const contextMeta = [
    `PROJECT: ${repoName}`,
    `FILES_INCLUDED: ${sections.length}`,
    `CONTEXT_CHAR_COUNT: ${totalChars}`,
    `EXECUTION_STRUCTURE: ${roleCounts.entryPoint} entry points, ${roleCounts.router} routers, ${roleCounts.handler} handlers, ${roleCounts.service} services`,
    "NOTE: Some files may include truncated sections due to context limits.",
  ].join("\n");

  const context = `${contextMeta}\n\n${sections.join("\n\n")}`;

  return {
    context,
    truncation,
    totalChars,
  };
}
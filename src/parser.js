/**
 * Parser for unified diff output (`git diff`, `git diff --cached`, patch files).
 * Extracts affected files, chunks, added lines, and exact line numbers.
 */

function parseDiff(diffText) {
  if (!diffText || typeof diffText !== 'string') {
    return [];
  }

  const files = [];
  const lines = diffText.split(/\r?\n/);
  let currentFile = null;
  let currentHunk = null;
  let currentNewLineno = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file header: diff --git a/path b/path
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const filePath = match ? match[2] : line.replace('diff --git ', '').trim();
      currentFile = {
        filePath,
        oldPath: match ? match[1] : filePath,
        isNew: false,
        isDeleted: false,
        additions: [],
        deletions: [],
        rawLines: []
      };
      files.push(currentFile);
      currentHunk = null;
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith('new file mode ')) {
      currentFile.isNew = true;
      continue;
    }

    if (line.startsWith('deleted file mode ')) {
      currentFile.isDeleted = true;
      continue;
    }

    // Detect hunk header: @@ -1,5 +1,9 @@
    if (line.startsWith('@@ ')) {
      const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        currentNewLineno = parseInt(hunkMatch[1], 10);
      }
      currentHunk = line;
      continue;
    }

    // Process diff content lines inside hunk
    if (currentHunk) {
      if (line.startsWith('+++ b/') || line.startsWith('--- a/')) {
        // Redundant file headers occasionally repeated before hunks
        continue;
      }

      if (line.startsWith('+')) {
        const addedContent = line.slice(1);
        currentFile.additions.push({
          line: currentNewLineno,
          content: addedContent,
          raw: line
        });
        currentNewLineno++;
      } else if (line.startsWith('-')) {
        currentFile.deletions.push({
          content: line.slice(1),
          raw: line
        });
      } else if (!line.startsWith('\\')) {
        // Context line
        currentNewLineno++;
      }
    }
  }

  return files;
}

module.exports = {
  parseDiff
};

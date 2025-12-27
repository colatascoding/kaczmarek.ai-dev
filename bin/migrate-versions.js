#!/usr/bin/env node
/**
 * Migration script to convert old review/progress structure to new version folder structure
 */

const fs = require("fs");
const path = require("path");
const { createVersionFolder, writeVersionMetadata } = require("../lib/versions/file-operations");

const cwd = process.cwd();
const reviewDir = path.join(cwd, "review");
const progressDir = path.join(cwd, "progress");
// const versionsDir = path.join(cwd, "versions"); // Not used yet

/**
 * Parse version from filename
 */
function parseVersion(filename) {
  const match = filename.match(/^version(\d+)-(\d+)\.md$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    tag: `${match[1]}-${match[2]}`
  };
}

/**
 * Extract content sections from markdown
 */
function extractSections(content) {
  const sections = {
    goals: [],
    changes: [],
    nextSteps: [],
    summary: "",
    review: ""
  };

  const lines = content.split("\n");
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    // Detect section headers
    if (line.match(/^##\s+Goals/i)) {
      if (currentSection) sections[currentSection] = currentContent.join("\n");
      currentSection = "goals";
      currentContent = [];
    } else if (line.match(/^##\s+Changes/i)) {
      if (currentSection) sections[currentSection] = currentContent.join("\n");
      currentSection = "changes";
      currentContent = [];
    } else if (line.match(/^##\s+Next\s+Steps/i)) {
      if (currentSection) sections[currentSection] = currentContent.join("\n");
      currentSection = "nextSteps";
      currentContent = [];
    } else if (line.match(/^##\s+Summary/i)) {
      if (currentSection) sections[currentSection] = currentContent.join("\n");
      currentSection = "summary";
      currentContent = [];
    } else if (line.match(/^#\s+Version/i)) {
      // Skip main header
      continue;
    } else if (currentSection) {
      currentContent.push(line);
    } else {
      // Content before first section
      sections.summary += line + "\n";
    }
  }

  if (currentSection) {
    sections[currentSection] = currentContent.join("\n");
  }

  // Store full content as review
  sections.review = content;

  return sections;
}

/**
 * Migrate a single version
 */
function migrateVersion(version) {
  const { major, minor, tag } = version;
  const versionTag = `${major}-${minor}`;

  console.log(`Migrating version ${versionTag}...`);

  // Create version folder structure
  const versionPath = createVersionFolder(versionTag, cwd);
  console.log(`  Created folder: ${versionPath}`);

  // Read review file
  const reviewFile = path.join(reviewDir, `version${tag}.md`);
  let reviewContent = "";
  if (fs.existsSync(reviewFile)) {
    reviewContent = fs.readFileSync(reviewFile, "utf8");
    const sections = extractSections(reviewContent);

    // Write goals to 01_plan/goals.md
    if (sections.goals) {
      const goalsPath = path.join(versionPath, "01_plan", "goals.md");
      fs.writeFileSync(goalsPath, `# Version ${versionTag} Goals\n\n${sections.goals}`, "utf8");
      console.log(`  Wrote goals: ${goalsPath}`);
    }

    // Write review to 04_review/review.md
    const reviewPath = path.join(versionPath, "04_review", "review.md");
    fs.writeFileSync(reviewPath, reviewContent, "utf8");
    console.log(`  Wrote review: ${reviewPath}`);
  }

  // Read progress file
  const progressFile = path.join(progressDir, `version${tag}.md`);
  if (fs.existsSync(progressFile)) {
    const progressContent = fs.readFileSync(progressFile, "utf8");
    const progressPath = path.join(versionPath, "02_implement", "progress.md");
    fs.writeFileSync(progressPath, progressContent, "utf8");
    console.log(`  Wrote progress: ${progressPath}`);
  }

  // Create version.json
  const metadata = {
    version: versionTag,
    major,
    minor,
    type: minor === 0 ? "major" : "minor",
    status: "completed", // Will be updated manually
    started: new Date().toISOString().split("T")[0]
  };
  writeVersionMetadata(versionTag, metadata, cwd);
  console.log(`  Created metadata: version.json`);

  // Create README.md
  const readmePath = path.join(versionPath, "README.md");
  const readmeContent = `# Version ${versionTag}

**Status**: ${metadata.status}  
**Started**: ${metadata.started}

## Quick Links
- [Planning](./01_plan/goals.md)
- [Implementation](./02_implement/progress.md)
- [Testing](./03_test/)
- [Review](./04_review/review.md)

## Summary
Migrated from old review/progress structure.
`;
  fs.writeFileSync(readmePath, readmeContent, "utf8");
  console.log(`  Created README: ${readmePath}`);

  console.log(`  ✓ Version ${versionTag} migrated\n`);
}

/**
 * Main migration function
 */
function main() {
  console.log("Starting version migration...\n");

  if (!fs.existsSync(reviewDir)) {
    console.error(`Review directory not found: ${reviewDir}`);
    process.exit(1);
  }

  // Find all version files
  const reviewFiles = fs.readdirSync(reviewDir)
    .filter(f => f.match(/^version\d+-\d+\.md$/))
    .map(f => parseVersion(f))
    .filter(v => v !== null)
    .sort((a, b) => {
      if (a.major !== b.major) return b.major - a.major;
      return b.minor - a.minor;
    });

  if (reviewFiles.length === 0) {
    console.log("No version files found to migrate.");
    return;
  }

  console.log(`Found ${reviewFiles.length} version(s) to migrate:\n`);

  // Migrate each version
  for (const version of reviewFiles) {
    migrateVersion(version);
  }

  console.log("Migration complete!");
  console.log("\nNext steps:");
  console.log("1. Review migrated versions in versions/ directory");
  console.log("2. Update version.json files with correct status and dates");
  console.log("3. Test that workflows still work with new structure");
}

if (require.main === module) {
  main();
}

module.exports = { migrateVersion, extractSections };


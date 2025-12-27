#!/usr/bin/env node
/**
 * Migration script to move workflows to library structure
 */

const fs = require("fs");
const path = require("path");
const libraryOps = require("../lib/library/file-operations");

const cwd = process.cwd();
const workflowsDir = path.join(cwd, "workflows");
const libraryDir = path.join(cwd, "library");

/**
 * Workflow categorization mapping
 */
const workflowCategories = {
  "execute-features": {
    category: "implementation",
    subcategory: "execute-features",
    tags: ["features", "agents", "automation"],
    description: "Execute features from review by launching background agents"
  },
  "review-self": {
    category: "review",
    subcategory: "review-self",
    tags: ["review", "self-review", "documentation"],
    description: "Review workflow that uses kaczmarek.ai-dev methodology to review itself"
  },
  "review-self-auto": {
    category: "review",
    subcategory: "review-self-auto",
    tags: ["review", "self-review", "automation", "claude"],
    description: "Automated review workflow with Claude integration"
  },
  "example-simple": {
    category: "common",
    subcategory: "example-simple",
    tags: ["example", "template", "simple"],
    description: "Simple example workflow template"
  }
};

/**
 * Migrate a single workflow
 */
function migrateWorkflow(filename) {
  const workflowPath = path.join(workflowsDir, filename);
  if (!fs.existsSync(workflowPath)) {
    console.warn(`Workflow not found: ${filename}`);
    return false;
  }

  const baseName = path.basename(filename, path.extname(filename));
  const category = workflowCategories[baseName];
  
  if (!category) {
    console.warn(`No category mapping for: ${baseName}`);
    return false;
  }

  console.log(`Migrating ${filename}...`);

  // Read workflow content
  const workflowContent = fs.readFileSync(workflowPath, "utf8");
  
  // Parse workflow to get metadata
  let workflowName = baseName;
  let workflowVersion = "1.0.0";
  let workflowDescription = category.description;
  
  try {
    const lines = workflowContent.split("\n");
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].trim();
      if (line.startsWith("name:")) {
        workflowName = line.replace(/^name:\s*["']?/, "").replace(/["']$/, "").trim();
      } else if (line.startsWith("version:")) {
        workflowVersion = line.replace(/^version:\s*["']?/, "").replace(/["']$/, "").trim();
      } else if (line.startsWith("description:")) {
        workflowDescription = line.replace(/^description:\s*["']?/, "").replace(/["']$/, "").trim();
      }
    }
  } catch (e) {
    // Use defaults
  }

  // Create library item path
  const itemPath = `workflows/${category.category}/${category.subcategory}`;
  const itemFullPath = path.join(libraryDir, itemPath);

  // Create directory structure
  if (!fs.existsSync(itemFullPath)) {
    fs.mkdirSync(itemFullPath, { recursive: true });
  }

  // Copy workflow file
  const targetWorkflowPath = path.join(itemFullPath, filename);
  fs.writeFileSync(targetWorkflowPath, workflowContent, "utf8");
  console.log(`  Copied workflow: ${targetWorkflowPath}`);

  // Create metadata.json
  const metadata = {
    name: workflowName,
    id: category.subcategory,
    category: category.category,
    subcategory: category.subcategory,
    type: "workflow",
    version: workflowVersion,
    description: workflowDescription,
    tags: category.tags,
    created: new Date().toISOString().split("T")[0],
    updated: new Date().toISOString().split("T")[0],
    source: "migration",
    files: [filename]
  };

  const metadataPath = path.join(itemFullPath, "metadata.json");
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
  console.log(`  Created metadata: ${metadataPath}`);

  // Create README.md
  const readmePath = path.join(itemFullPath, "README.md");
  const readmeContent = `# ${workflowName}

**Category**: ${category.category}  
**Subcategory**: ${category.subcategory}  
**Version**: ${workflowVersion}

## Description

${workflowDescription}

## Usage

\`\`\`bash
kad workflow run ${category.subcategory}
\`\`\`

## Files

- \`${filename}\` - Main workflow definition

## Tags

${category.tags.map(t => `- ${t}`).join("\n")}
`;
  fs.writeFileSync(readmePath, readmeContent, "utf8");
  console.log(`  Created README: ${readmePath}`);

  console.log(`  ✓ Workflow ${filename} migrated\n`);
  return true;
}

/**
 * Main migration function
 */
function main() {
  console.log("Starting workflow migration...\n");

  if (!fs.existsSync(workflowsDir)) {
    console.error(`Workflows directory not found: ${workflowsDir}`);
    process.exit(1);
  }

  // Find all workflow files
  const workflowFiles = fs.readdirSync(workflowsDir)
    .filter(f => f.endsWith(".yaml") || f.endsWith(".yml"))
    .filter(f => workflowCategories[path.basename(f, path.extname(f))]);

  if (workflowFiles.length === 0) {
    console.log("No workflows found to migrate.");
    return;
  }

  console.log(`Found ${workflowFiles.length} workflow(s) to migrate:\n`);

  // Migrate each workflow
  let migrated = 0;
  for (const file of workflowFiles) {
    if (migrateWorkflow(file)) {
      migrated++;
    }
  }

  console.log(`Migration complete! Migrated ${migrated}/${workflowFiles.length} workflows.`);
  console.log("\nNext steps:");
  console.log("1. Review migrated workflows in library/ directory");
  console.log("2. Update workflows to use library discovery");
  console.log("3. Test that workflows still work from library");
  console.log("4. Optionally remove original workflow files (they're now in library)");
}

if (require.main === module) {
  main();
}

module.exports = { migrateWorkflow };


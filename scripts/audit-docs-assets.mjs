import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("docs/.vitepress/dist");
let totalChecked = 0;
let errors = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const regex = /(?:href|src)="([^"]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const uri = match[1];
    if (
      uri.startsWith("http://") ||
      uri.startsWith("https://") ||
      uri.startsWith("#") ||
      uri.startsWith("data:") ||
      uri.startsWith("mailto:")
    ) {
      continue;
    }
    totalChecked++;
    if (!uri.startsWith("/wiremint/")) {
      errors.push({
        file: path.relative(distDir, filePath),
        uri,
        reason: "Does not start with /wiremint/",
      });
      continue;
    }

    const relativePath = uri.slice("/wiremint/".length).split("#")[0].split("?")[0];
    if (relativePath === "" || relativePath.endsWith("/")) {
      const htmlPath = path.join(distDir, relativePath, "index.html");
      if (!fs.existsSync(htmlPath)) {
        errors.push({
          file: path.relative(distDir, filePath),
          uri,
          reason: "Target index.html does not exist: " + htmlPath,
        });
      }
    } else {
      const assetPath = path.join(distDir, relativePath);
      if (!fs.existsSync(assetPath)) {
        if (fs.existsSync(assetPath + ".html")) {
          // OK cleanUrls
        } else {
          errors.push({
            file: path.relative(distDir, filePath),
            uri,
            reason: "Asset or page does not exist: " + assetPath,
          });
        }
      }
    }
  }
}

function traverse(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      traverse(full);
    } else if (entry.name.endsWith(".html")) {
      checkFile(full);
    }
  }
}

traverse(distDir);
console.log("Total URI references checked across all HTML files:", totalChecked);
if (errors.length > 0) {
  console.error("Errors found:", JSON.stringify(errors, null, 2));
  process.exit(1);
} else {
  console.log("✔ All URI references start with /wiremint/ and resolve cleanly to files on disk!");
}

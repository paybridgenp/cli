import { intro, outro, text, select, isCancel, cancel } from "@clack/prompts";
import pc from "picocolors";
import fs from "fs";
import path from "path";
import { getApiKey } from "../lib/config.js";
import { blank } from "../lib/output.js";
import { getTemplateFiles, type Framework } from "../templates/index.js";

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function appendGitignore(dir: string): void {
  const gitignorePath = path.join(dir, ".gitignore");
  const entry = ".env\n";
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, entry, "utf8");
    return;
  }
  const existing = fs.readFileSync(gitignorePath, "utf8");
  if (!existing.split("\n").some((line) => line.trim() === ".env")) {
    fs.appendFileSync(gitignorePath, existing.endsWith("\n") ? entry : "\n" + entry, "utf8");
  }
}

function packageJsonFor(name: string, framework: Framework): string {
  if (framework === "nextjs") {
    return JSON.stringify(
      {
        name,
        version: "0.1.0",
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
        },
        dependencies: {
          "@paybridge-np/sdk": "^1.3.0",
          next: "^15.0.0",
          react: "^18.0.0",
          "react-dom": "^18.0.0",
        },
        devDependencies: {
          "@types/node": "^20.0.0",
          "@types/react": "^18.0.0",
          typescript: "^5.7.0",
        },
      },
      null,
      2
    ) + "\n";
  }

  if (framework === "node") {
    return JSON.stringify(
      {
        name,
        version: "0.1.0",
        type: "module",
        scripts: { start: "tsx index.ts", dev: "tsx --watch index.ts" },
        dependencies: { "@paybridge-np/sdk": "^1.3.0" },
        devDependencies: { "@types/node": "^20.0.0", tsx: "^4.0.0", typescript: "^5.7.0" },
      },
      null,
      2
    ) + "\n";
  }

  // bare
  return JSON.stringify(
    {
      name,
      version: "0.1.0",
      type: "module",
      scripts: { start: "tsx index.ts" },
      dependencies: { "@paybridge-np/sdk": "^1.3.0" },
      devDependencies: { "@types/node": "^20.0.0", tsx: "^4.0.0", typescript: "^5.7.0" },
    },
    null,
    2
  ) + "\n";
}

export async function initCommand(flags: { name?: string; framework?: string } = {}): Promise<void> {
  intro(pc.bold("PayBridgeNP — init"));

  const defaultName = path.basename(process.cwd());

  let projectName: string;
  if (flags.name) {
    projectName = flags.name.trim();
    console.log(`  ${pc.dim("Project name")}  ${projectName}`);
  } else {
    const nameResult = await text({
      message: "Project name",
      placeholder: defaultName,
      defaultValue: defaultName,
      validate(v) {
        if (!v.trim()) return "Name cannot be empty";
      },
    });
    if (isCancel(nameResult)) { cancel("Cancelled."); process.exit(0); }
    projectName = (nameResult as string).trim();
  }

  const validFrameworks = ["nextjs", "node", "bare"];
  let framework: Framework;
  if (flags.framework) {
    if (!validFrameworks.includes(flags.framework)) {
      console.log(pc.red(`  ✗ Invalid framework "${flags.framework}". Choose: nextjs, node, bare`));
      process.exit(1);
    }
    framework = flags.framework as Framework;
    console.log(`  ${pc.dim("Framework   ")}  ${framework}`);
  } else {
    const frameworkResult = await select({
      message: "Framework",
      options: [
        { value: "nextjs", label: "Next.js (App Router)" },
        { value: "node", label: "Node.js / Express" },
        { value: "bare", label: "Bare TypeScript" },
      ],
    });
    if (isCancel(frameworkResult)) { cancel("Cancelled."); process.exit(0); }
    framework = frameworkResult as Framework;
  }

  const targetDir = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(targetDir)) {
    console.log(pc.red(`  ✗ Directory already exists: ${targetDir}`));
    process.exit(1);
  }

  ensureDir(targetDir);

  const apiKey = getApiKey();
  const files = getTemplateFiles(framework, apiKey);

  for (const file of files) {
    const fullPath = path.join(targetDir, file.path);
    ensureDir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, file.content, "utf8");
  }

  // package.json
  fs.writeFileSync(
    path.join(targetDir, "package.json"),
    packageJsonFor(projectName, framework),
    "utf8"
  );

  // .gitignore — ensure .env is listed
  appendGitignore(targetDir);

  blank();
  outro(pc.green(`Project created in ./${projectName}`));

  blank();
  console.log("  " + pc.bold("Next steps"));
  blank();
  console.log(`  ${pc.dim("$")} cd ${projectName}`);
  console.log(`  ${pc.dim("$")} npm install`);
  if (framework === "nextjs") {
    console.log(`  ${pc.dim("$")} paybridgenp webhooks listen --port 4242`);
    console.log(`  ${pc.dim("$")} npm run dev`);
  } else {
    console.log(`  ${pc.dim("$")} paybridgenp webhooks listen --port 4242`);
    console.log(`  ${pc.dim("$")} npm run dev`);
  }
  blank();

  if (!apiKey) {
    console.log(
      "  " +
        pc.yellow("⚠") +
        pc.dim(" No API key found. Edit .env and add your PAYBRIDGE_API_KEY, or run ") +
        pc.bold("paybridgenp login")
    );
    blank();
  }
}

import fs from "fs";
import path from "path";
import type { Page } from "playwright";

/**
 * Names that appear in almost every fiber chain regardless of which page/component
 * actually failed — routing/auth/redux wrappers, not the thing a developer needs to
 * go fix. Skipped when picking the "nearest meaningful" component name.
 */
const GENERIC_NAME_PATTERNS: RegExp[] = [
  /^Connect\(/,
  /^\(anonymous/,
  /^withRouter\(/,
  /^ErrorBoundary$/,
  /^Provider$/,
  /^Router$/,
  /^BrowserRouter$/,
  /^HashRouter$/,
  /^Route$/,
  /^Routes$/,
  /^App$/,
  /^AuthenticateUser$/,
  /^LoadableComponent$/,
  /^Component$/,
];

function isGenericName(name: string): boolean {
  return GENERIC_NAME_PATTERNS.some((re) => re.test(name));
}

/**
 * Finds the nearest "real" React component name wrapping the element matched by
 * `selector`, by walking the fiber tree React attaches to every DOM node (works even
 * on production builds with no _debugSource — verified 2026-08-05: spvithlani's build
 * has no _debugSource, but fiber.type.name / displayName is still present).
 *
 * Returns null if the selector matches nothing, or if every ancestor is a generic
 * wrapper (routing/redux/error-boundary) with no more specific name in between.
 */
export async function getComponentNameForSelector(page: Page, selector: string): Promise<string | null> {
  return page.evaluate(
    ({ selector, genericPatternSources }) => {
      const el = document.querySelector(selector);
      if (!el) return null;

      const genericPatterns = genericPatternSources.map((s) => new RegExp(s));
      const isGeneric = (name: string) => genericPatterns.some((re) => re.test(name));

      const fiberKey = Object.keys(el).find(
        (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let node: any = fiberKey ? (el as any)[fiberKey] : null;

      while (node) {
        let name: string | null = null;
        if (typeof node.type === "function") {
          name = node.type.displayName || node.type.name || null;
        } else if (node.type && typeof node.type === "object" && node.type.render) {
          name = node.type.displayName || node.type.render.name || null;
        }
        if (name && !isGeneric(name)) return name;
        node = node.return;
      }
      return null;
    },
    { selector, genericPatternSources: GENERIC_NAME_PATTERNS.map((re) => re.source) }
  );
}

export interface ComponentSourceLocation {
  file: string; // relative to sourceDir
  line: number;
  ambiguous: boolean; // true if more than one file matched — file/line is a best guess
}

const DECLARATION_PATTERN = (name: string) =>
  new RegExp(`\\b(class|function)\\s+${name}\\b|\\bconst\\s+${name}\\s*=`);

const SKIP_DIRS = new Set(["node_modules", ".git", "build", "dist", "public"]);

function walkFiles(dir: string, exts: string[], out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkFiles(path.join(dir, entry.name), exts, out);
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(path.join(dir, entry.name));
    }
  }
}

/**
 * Greps `sourceDir` for a component named `componentName`. Not real AST analysis
 * (that's still out of scope, per the requirements doc §11) — a plain text search for
 * common declaration shapes (class/function/const). Good enough to point a developer
 * at the right file; ambiguous when a name matches in more than one place (common
 * component names, or the name appearing in a comment/string).
 */
export function locateComponentSource(componentName: string, sourceDir: string): ComponentSourceLocation | null {
  const files: string[] = [];
  walkFiles(sourceDir, [".js", ".jsx", ".ts", ".tsx"], files);

  const pattern = DECLARATION_PATTERN(componentName);
  const matches: ComponentSourceLocation[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        matches.push({ file: path.relative(sourceDir, file), line: i + 1, ambiguous: false });
        break; // one match per file is enough
      }
    }
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return { ...matches[0], ambiguous: true };
}
